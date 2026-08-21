import { createClient } from '@supabase/supabase-js'

// Unified Serverless Email Engine (Workspace Invites, Deadline Assignments, Blocker Alerts)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const body = req.body || {}
  const { type, email, toEmail, toName, role, workspaceName, title, description, dueDate, priority, assignedBy, blockerReason, blockerUser, appUrl } = body
  const cleanEmail = (email || toEmail || '').trim().toLowerCase()

  if (!cleanEmail) {
    return res.status(400).json({ error: 'Missing required parameter: email' })
  }

  const resendApiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://sdbglndhjkqhkphzqmum.supabase.co'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
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
  // 2. Blocker Alert Email
  else if (type === 'blocker' || blockerReason) {
    subject = `🚨 [SprintOS Alert] Task Blocked: "${title || 'Task'}"`
    textBody = `Task Blocked Alert\n\nTask: ${title || 'Untitled Task'}\nReported by: ${blockerUser || 'Team Member'}\nBlocker Reason: ${blockerReason || 'Unspecified'}\n\nView details: ${targetUrl}`
    htmlBody = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #0f172a; padding: 24px;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
          <div style="display:inline-block; background:#fee2e2; color:#b91c1c; padding:4px 10px; border-radius:9999px; font-weight:700; font-size:12px;">CRITICAL BLOCKER</div>
          <h2 style="font-size: 18px; font-weight: 800; margin: 12px 0;">Task marked as Blocked</h2>
          <p style="font-size: 14px; color: #334155;">A blocker was flagged on <strong>"${title || 'Untitled Task'}"</strong> by <strong>${blockerUser || 'Team Member'}</strong>.</p>
          <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:16px; margin:16px 0; color:#991b1b; font-size:14px;">
            <strong>Blocker Reason:</strong><br>${blockerReason || 'No reason provided.'}
          </div>
          <a href="${targetUrl}" style="display:inline-block; background:#dc2626; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:700; font-size:14px;">Resolve Blocker &rarr;</a>
        </div>
      </body>
      </html>
    `
  }
  // 3. Workspace Invite Email (Default)
  else {
    const targetJoinUrl = `https://app.paper5.co/signup?email=${encodeURIComponent(cleanEmail)}`
    subject = `You've been invited to join ${workspaceName || 'a workspace'} on SprintOS`
    textBody = `Workspace Invitation\n\nYou have been invited to join ${workspaceName || 'Workspace'} as a ${role || 'Member'} on SprintOS.\n\nAccept your invitation: ${targetJoinUrl}`
    htmlBody = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #0f172a; padding: 24px;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
          <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 16px 0;">Workspace Invitation</h2>
          <p style="font-size: 14px; color: #334155;">You have been invited to join <strong>${workspaceName || 'Workspace'}</strong> as a <strong>${role || 'Member'}</strong> on SprintOS.</p>
          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600;">Invited Email</div>
            <div style="font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 8px;">${cleanEmail}</div>
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600;">Assigned Role</div>
            <div style="font-size: 14px; font-weight: 600; color: #0f172a;">${role || 'Member'}</div>
          </div>
          <a href="${targetJoinUrl}" style="display:inline-block; background:#4f46e5; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:600; font-size:14px;">Accept Invitation & Join Workspace &rarr;</a>
        </div>
      </body>
      </html>
    `

    if (supabaseUrl && serviceKey) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, serviceKey)
        await supabaseAdmin.from('notifications').delete().ilike('forEmail', cleanEmail).catch(() => {})
        await supabaseAdmin.from('notifications').delete().ilike('for_email', cleanEmail).catch(() => {})
      } catch (_) {}
    }
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
