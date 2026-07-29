import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp()
const db = getFirestore()

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY')
const MODEL = 'claude-sonnet-5'

async function assertAllowed(auth) {
  if (!auth?.token?.email) {
    throw new HttpsError('unauthenticated', 'Sign in required.')
  }
  const email = auth.token.email.toLowerCase()
  const doc = await db.collection('allowedUsers').doc(email).get()
  if (!doc.exists) {
    throw new HttpsError('permission-denied', 'This account is not authorized for this tracker.')
  }
  return email
}

// Calls Anthropic, asking for JSON-only output, and parses it. Throws a
// clear HttpsError (not a raw parse error) if the model doesn't cooperate,
// so the client always gets something actionable rather than a stack trace.
async function callAnthropicForJson(systemPrompt, userPrompt, maxTokens = 1024) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey.value(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt + '\n\nRespond with ONLY valid JSON. No markdown fences, no preamble, no commentary.',
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    console.error('Anthropic API error', response.status, body)
    throw new HttpsError('internal', `AI request failed (${response.status}). Try again in a moment.`)
  }

  const data = await response.json()
  const text = data.content?.find(b => b.type === 'text')?.text || ''
  try {
    return JSON.parse(text)
  } catch {
    console.error('Failed to parse model output as JSON:', text)
    throw new HttpsError('internal', 'The AI response was not valid JSON. Try again.')
  }
}

function requireString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpsError('invalid-argument', `${fieldName} is required.`)
  }
  return value.trim()
}

const secrets = [anthropicApiKey]

export const breakFeatureIntoTasks = onCall({ secrets }, async (request) => {
  await assertAllowed(request.auth)
  const description = requireString(request.data?.description, 'description')
  const sprintGoal = (request.data?.sprintGoal || '').trim()

  return callAnthropicForJson(
    'You break a feature description into a concrete task list for a small startup team building an AI cybersecurity product. Each founder works 8-12 hours/week. Keep tasks small enough to finish within a week.',
    `Feature description: ${description}\n${sprintGoal ? `Current sprint goal (for context): ${sprintGoal}\n` : ''}\nReturn JSON: {"tasks": [{"title": string, "estimatedHours": number, "dependencies": string[]}]}. dependencies should reference other task titles in this same list, or be empty.`
  )
})

export const estimateHours = onCall({ secrets }, async (request) => {
  await assertAllowed(request.auth)
  const title = requireString(request.data?.title, 'title')
  const description = (request.data?.description || '').trim()

  return callAnthropicForJson(
    'You estimate realistic effort for software/security tasks done by a small, part-time founder team (8-12 hrs/week each). Be conservative — teams reliably underestimate.',
    `Task: ${title}\n${description ? `Description: ${description}\n` : ''}\nReturn JSON: {"estimatedHours": number, "reasoning": string}.`
  )
})

export const generateDefinitionOfDone = onCall({ secrets }, async (request) => {
  await assertAllowed(request.auth)
  const title = requireString(request.data?.title, 'title')
  const description = (request.data?.description || '').trim()

  return callAnthropicForJson(
    'You write a short, concrete Definition of Done for a software/security task — specific enough that a reviewer (not the person who did the work) can check it objectively.',
    `Task: ${title}\n${description ? `Description: ${description}\n` : ''}\nReturn JSON: {"definitionOfDone": string}. One tight paragraph or short bullet list as a single string, not multiple JSON fields.`
  )
})

export const generateAcceptanceCriteria = onCall({ secrets }, async (request) => {
  await assertAllowed(request.auth)
  const title = requireString(request.data?.title, 'title')
  const description = (request.data?.description || '').trim()

  return callAnthropicForJson(
    'You write testable acceptance criteria for a software/security task.',
    `Task: ${title}\n${description ? `Description: ${description}\n` : ''}\nReturn JSON: {"criteria": string[]}. Each item should be independently verifiable, 3-7 items.`
  )
})

export const summarizeSprint = onCall({ secrets }, async (request) => {
  await assertAllowed(request.auth)
  const sprintId = requireString(request.data?.sprintId, 'sprintId')

  const [sprintDoc, tasksSnap] = await Promise.all([
    db.collection('sprints').doc(sprintId).get(),
    db.collection('deadlines').where('sprintId', '==', sprintId).get(),
  ])
  if (!sprintDoc.exists) throw new HttpsError('not-found', 'Sprint not found.')

  const sprint = sprintDoc.data()
  const tasks = tasksSnap.docs.map(d => d.data())
  const summary = tasks.map(t => `- [${t.status}] ${t.title} (${t.assigneeName || 'unassigned'})`).join('\n')

  return callAnthropicForJson(
    'You write a short, honest sprint review summary for a startup\'s Sunday planning meeting — what shipped, what slipped, and a plausible reason why, based only on the task list given.',
    `Sprint ${sprint.number} — goal: ${sprint.goal || 'none set'}\n\nTasks:\n${summary || '(no tasks in this sprint)'}\n\nReturn JSON: {"summary": string}. 3-5 sentences, plain prose, no bullet points.`
  )
})

export const identifyRisks = onCall({ secrets }, async (request) => {
  await assertAllowed(request.auth)
  const sprintId = requireString(request.data?.sprintId, 'sprintId')

  const tasksSnap = await db.collection('deadlines').where('sprintId', '==', sprintId).get()
  const now = new Date()
  const tasks = tasksSnap.docs.map(d => {
    const t = d.data()
    return {
      deadlineId: d.id,
      title: t.title,
      status: t.status,
      dueDate: t.dueDate,
      estimatedHours: t.estimatedHours ?? null,
      dependencies: t.dependencies || [],
      overdue: t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now,
    }
  })

  return callAnthropicForJson(
    'You flag at-risk tasks in a sprint: overdue, blocked, missing an hour estimate, or with unresolved dependencies. Be specific about which task and why.',
    `Tasks in this sprint:\n${JSON.stringify(tasks, null, 2)}\n\nReturn JSON: {"risks": [{"deadlineId": string, "title": string, "reason": string}]}. Only include tasks that are actually risky — an empty array is a fine, honest answer if nothing looks risky.`
  )
})

export const detectOverloadedFounders = onCall({ secrets }, async (request) => {
  await assertAllowed(request.auth)
  const availableHoursByMember = request.data?.availableHoursByMember
  if (!availableHoursByMember || typeof availableHoursByMember !== 'object') {
    throw new HttpsError('invalid-argument', 'availableHoursByMember is required — e.g. {"kanishka@x.com": 10}.')
  }

  const [membersSnap, deadlinesSnap] = await Promise.all([
    db.collection('members').get(),
    db.collection('deadlines').where('status', 'in', ['not_started', 'in_progress', 'blocked']).get(),
  ])

  const members = membersSnap.docs.map(d => d.data())
  const workloadByEmail = {}
  deadlinesSnap.docs.forEach(d => {
    const t = d.data()
    const email = (t.assigneeEmail || '').toLowerCase()
    if (!email) return
    workloadByEmail[email] = (workloadByEmail[email] || 0) + (t.estimatedHours || 0)
  })

  const rows = members.map(m => ({
    memberId: m.id,
    name: m.name,
    email: (m.email || '').toLowerCase(),
    assignedHours: workloadByEmail[(m.email || '').toLowerCase()] || 0,
    availableHours: availableHoursByMember[(m.email || '').toLowerCase()] ?? null,
  }))

  return callAnthropicForJson(
    'You identify which founders are overloaded this sprint — assigned hours exceeding their stated available hours.',
    `Founder workload:\n${JSON.stringify(rows, null, 2)}\n\nReturn JSON: {"overloaded": [{"memberId": string, "name": string, "overByHours": number}]}. Only include founders where assignedHours clearly exceeds availableHours. Skip founders with no availableHours given.`
  )
})

import { onSchedule } from 'firebase-functions/v2/scheduler'

const emailjsServiceId = defineSecret('EMAILJS_SERVICE_ID')
const emailjsTemplateId = defineSecret('EMAILJS_TEMPLATE_ID')
const emailjsPublicKey = defineSecret('EMAILJS_PUBLIC_KEY')
const emailjsPrivateKey = defineSecret('EMAILJS_PRIVATE_KEY')

export const sendMeetingReminders = onSchedule({
  schedule: 'every 5 minutes',
  secrets: [emailjsServiceId, emailjsTemplateId, emailjsPublicKey, emailjsPrivateKey]
}, async (event) => {
  const now = new Date()
  const thirtyMinsFromNow = new Date(now.getTime() + 30 * 60000)
  // buffer to catch meetings since this runs every 5 mins
  const lowerBound = new Date(thirtyMinsFromNow.getTime() - 2.5 * 60000).toISOString()
  const upperBound = new Date(thirtyMinsFromNow.getTime() + 2.5 * 60000).toISOString()

  const meetingsSnap = await db.collection('meetings')
    .where('date', '>=', lowerBound)
    .where('date', '<=', upperBound)
    .get()

  if (meetingsSnap.empty) return

  for (const doc of meetingsSnap.docs) {
    const meeting = doc.data()
    const teamId = meeting.teamId
    const membersSnap = await db.collection('members').where('teamId', '==', teamId).get()
    
    const sendPromises = membersSnap.docs.map(mDoc => {
      const member = mDoc.data()
      if (!member.email) return Promise.resolve()

      return fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: emailjsServiceId.value(),
          template_id: emailjsTemplateId.value(),
          user_id: emailjsPublicKey.value(),
          accessToken: emailjsPrivateKey.value(),
          template_params: {
            to_name: member.name || member.email,
            to_email: member.email,
            task_title: `Meeting Reminder: Sprint ${meeting.sprintId || 'Planning'}`,
            task_description: `Your meeting starts in 30 minutes at ${new Date(meeting.date).toLocaleString()}.`,
            due_date: new Date(meeting.date).toLocaleString(),
            priority: 'HIGH',
            assigned_by: 'System',
          }
        })
      }).catch(err => console.error('Failed to send email to', member.email, err))
    })

    await Promise.all(sendPromises)
  }
})

// AUDIT LOGGING: Record any changes to the allowlist for compliance and observability.
// This runs with admin privileges on the backend, ensuring users cannot bypass or tamper with the audit log.
export const auditAllowlistChanges = onDocumentWritten('allowedUsers/{userEmail}', async (event) => {
  const changeType = !event.data.before.exists ? 'CREATE' : !event.data.after.exists ? 'DELETE' : 'UPDATE'
  
  await db.collection('auditLogs').add({
    targetEmail: event.params.userEmail,
    action: changeType,
    before: event.data.before.exists ? event.data.before.data() : null,
    after: event.data.after.exists ? event.data.after.data() : null,
    timestamp: new Date().toISOString(),
    resource: 'allowedUsers'
  })
})
