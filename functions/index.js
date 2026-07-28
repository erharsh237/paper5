// AI Assistant backend.
//
// WHY THIS EXISTS AS A CLOUD FUNCTION AND NOT CLIENT-SIDE CODE:
// Calling api.anthropic.com directly from the browser would mean shipping
// the API key inside the app bundle — anyone who opens dev tools gets your
// key. There is no way to call a real LLM from a pure static-hosted SPA
// without either exposing a key or proxying through a backend. This file
// IS that backend: the key lives only here, as a Secret Manager secret
// (ANTHROPIC_API_KEY), never in client code, never in Firestore, never in
// an env var bundled by Vite.
//
// SETUP (you have to do this once, I can't do it from here — I don't have
// your Anthropic API key or Firebase CLI access):
//   1. firebase functions:secrets:set ANTHROPIC_API_KEY
//      (paste your key when prompted)
//   2. Firebase Cloud Functions require the Blaze (pay-as-you-go) plan —
//      upgrade the project if it's still on Spark.
//   3. firebase deploy --only functions
//
// AUTHORIZATION: every function independently re-checks the caller's email
// against the same `allowedUsers` Firestore collection the rest of the app
// uses — context.auth just proves *a* Google account signed in, not that
// it's an allowed one. Never trust client-supplied identity for this;
// Cloud Functions run with admin privileges, so this check is the actual
// gate.

import { onCall, HttpsError } from 'firebase-functions/v2/https'
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
