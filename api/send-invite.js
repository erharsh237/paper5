import { createClient } from '@supabase/supabase-js'
import { authenticateUser, verifyWorkspaceAccess } from './_auth.js'
import { checkRateLimit } from './_rateLimit.js'
import { sanitizeError } from './_errors.js'

// Unified Serverless Email Engine (Workspace Invites, Deadline Assignments, Blocker Alerts)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  if (checkRateLimit(req, res, { max: 30, windowMs: 60000 })) return

  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const activeKey = serviceKey || anonKey

  if (!rawUrl || !activeKey) {
    return res.status(500).json({ error: 'Supabase credentials missing' })
  }

  const supabaseUrl = rawUrl.replace(/["']/g, '').trim()
  const supabaseAdmin = createClient(supabaseUrl, activeKey.replace(/["']/g, '').trim())

  const body = req.body || {}
  const { type, email, toEmail, toName, role, workspaceName, workspaceId, title, description, dueDate, priority, assignedBy, blockerReason, blockerUser, appUrl } = body
  const cleanEmail = (email || toEmail || '').trim().toLowerCase()

  if (!cleanEmail) {
    return res.status(400).json({ error: 'Missing required parameter: email' })
  }

  // Prevent email bomb / unauthenticated spamming attacks: Caller MUST be authenticated
  if (workspaceId) {
    const wsAuth = await verifyWorkspaceAccess(req, supabaseAdmin, workspaceId)
    if (wsAuth.error) {
      return res.status(wsAuth.status || 403).json({ error: wsAuth.error })
    }
  } else {
    const userAuth = await authenticateUser(req, supabaseAdmin)
    if (userAuth.error) {
      return res.status(userAuth.status || 401).json({ error: userAuth.error })
    }
  }

  const resendApiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY
  const targetUrl = appUrl || 'https://app.paper5.co'

  let subject = ''
  let textBody = ''
  let htmlBody = ''

  // 1. Deadline Assignment Email
  if (type === 'deadline' || (title && dueDate)) {
    const assigneeDisplayName = toName || cleanEmail.split('@')[0]
    const creatorName = assignedBy || 'A team member'
    const taskPriority = (priority || 'medium').toUpperCase()
    const formattedDueDate = dueDate ? new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No due date'
    subject = `📋 [SprintOS] New Deadline Assigned: "${title || 'Task'}"`
    textBody = `New Deadline Assigned\n\nHi ${assigneeDisplayName},\n\n${creatorName} assigned you a new deadline on SprintOS.\n\nTask: ${title || 'Untitled Task'}\nDue Date: ${formattedDueDate}\nPriority: ${taskPriority}\n${description ? `Details: ${description}\n` : ''}\nView task: ${targetUrl}`
    htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0; }
          .badge { display: inline-block; background: #e0e7ff; color: #4338ca; padding: 4px 10px; border-radius: 9999px; font-weight: 700; font-size: 12px; margin-bottom: 12px; }
          .title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0; }
          .card { background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #e2e8f0; }
          .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; margin-top: 16px; text-align: center; }
          .footer { font-size: 12px; color: #94a3b8; margin-top: 28px; border-top: 1px solid #f1f5f9; padding-top: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="badge">TASK ASSIGNMENT</div>
          <h2 class="title">You have been assigned a new task</h2>
          <p style="font-size: 14px; color: #334155;"><strong>${creatorName}</strong> has assigned you to <strong>"${title || 'Untitled Task'}"</strong>${workspaceName ? ` in <strong>${workspaceName}</strong>` : ''}.</p>
          <div class="card">
            <div><strong>Task:</strong> ${title || 'Untitled Task'}</div>
            <div style="margin-top: 8px;"><strong>Due Date:</strong> ${formattedDueDate} &bull; <strong>Priority:</strong> ${taskPriority}</div>
            ${description ? `<div style="margin-top: 8px; font-size: 13px; color: #475569;">${description}</div>` : ''}
          </div>
          <a href="${targetUrl}" class="btn" style="color:#fff;">Open Task in SprintOS &rarr;</a>
          <div class="footer">SprintOS Notification Engine &bull; <a href="https://app.paper5.co" style="color: #64748b;">app.paper5.co</a></div>
        </div>
      </body>
      </html>
    `
  }
  // 2. Blocker Flagged Email
  else if (type === 'blocker') {
    const reporterName = blockerUser || assignedBy || 'A team member'
    subject = `🚨 [SprintOS] Blocker Flagged: "${title || 'Task'}"`
    textBody = `Blocker Flagged\n\n${reporterName} flagged a blocker on "${title || 'Task'}".\n\nReason: ${blockerReason || 'No blocker reason provided.'}\n\nResolve or view details: ${targetUrl}`
    htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #fecaca; }
          .badge { display: inline-block; background: #fee2e2; color: #b91c1c; padding: 4px 10px; border-radius: 9999px; font-weight: 700; font-size: 12px; margin-bottom: 12px; }
          .title { font-size: 18px; font-weight: 800; color: #991b1b; margin: 0 0 12px 0; }
          .card { background: #fff1f2; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #fecdd3; }
          .btn { display: inline-block; background: #dc2626; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; margin-top: 16px; text-align: center; }
          .footer { font-size: 12px; color: #94a3b8; margin-top: 28px; border-top: 1px solid #f1f5f9; padding-top: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="badge">BLOCKER ALERT</div>
          <h2 class="title">A blocker has been reported</h2>
          <p style="font-size: 14px; color: #334155;"><strong>${reporterName}</strong> reported an obstacle on <strong>"${title || 'Untitled Task'}"</strong>.</p>
          <div class="card">
            <strong style="color: #991b1b;">Blocker Reason:</strong>
            <p style="margin: 8px 0 0 0; font-size: 14px; color: #4c0519;">${blockerReason || 'No details provided.'}</p>
          </div>
          <a href="${targetUrl}" class="btn" style="color:#fff;">View Blocker on Dashboard &rarr;</a>
          <div class="footer">SprintOS Alert Engine &bull; <a href="https://app.paper5.co" style="color: #64748b;">app.paper5.co</a></div>
        </div>
      </body>
      </html>
    `
  }
  // 3. Workspace Invitation Email
  else {
    const inviteLink = `${targetUrl}/join?email=${encodeURIComponent(cleanEmail)}`
    subject = `You've been invited to join ${workspaceName || 'a team workspace'} on SprintOS`
    textBody = `You've been invited to join ${workspaceName || 'a workspace'} on SprintOS as ${role || 'member'}.\n\nClick the link below to accept your invitation:\n${inviteLink}\n\nSign in to get started.`
    htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0; }
          .badge { display: inline-block; background: #e0e7ff; color: #4338ca; padding: 4px 10px; border-radius: 9999px; font-weight: 700; font-size: 12px; margin-bottom: 12px; }
          .title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0; }
          .desc { font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px 0; }
          .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; margin: 16px 0; text-align: center; }
          .footer { font-size: 12px; color: #94a3b8; margin-top: 28px; border-top: 1px solid #f1f5f9; padding-top: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="badge">WORKSPACE INVITATION</div>
          <h2 class="title">Join ${workspaceName || 'your team'} on SprintOS</h2>
          <p class="desc">You've been invited to collaborate in <strong>${workspaceName || 'a private workspace'}</strong> as a <strong>${role || 'member'}</strong>.</p>
          <a href="${inviteLink}" class="btn" style="color: #ffffff;">Accept Invitation &rarr;</a>
          <div class="footer">SprintOS Team Orchestration &bull; <a href="https://app.paper5.co" style="color: #64748b;">app.paper5.co</a></div>
        </div>
      </body>
      </html>
    `
  }

  let emailSent = false
  let resendDetails = null

  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.SENDER_EMAIL || 'SprintOS <no-reply@paper5.co>',
          to: [cleanEmail],
          reply_to: process.env.REPLY_TO_EMAIL || 'support@paper5.co',
          subject,
          html: htmlBody,
          text: textBody
        })
      })

      const data = await response.json()
      if (response.ok && data.id) {
        emailSent = true
        resendDetails = data
      } else {
        resendDetails = data
      }
    } catch (e) {
      console.error('[API send-invite] Resend fetch exception:', e)
    }
  }

  return res.status(200).json({ success: true, emailSent, resendDetails })
}
