// Vercel Serverless API function to dispatch blocker notification emails to requested team members
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const {
    workspaceId,
    workspaceName,
    deadlineTitle,
    deadlineId,
    blockedBy,
    blockedByName,
    reason,
    category,
    description,
    helperEmails,
    appUrl
  } = req.body || {}

  if (!Array.isArray(helperEmails) || helperEmails.length === 0) {
    return res.status(200).json({ success: true, count: 0, message: 'No helpers specified' })
  }

  const cleanEmails = Array.from(new Set(helperEmails.map(e => (e || '').trim().toLowerCase()).filter(Boolean)))
  if (cleanEmails.length === 0) {
    return res.status(200).json({ success: true, count: 0, message: 'No valid helper emails' })
  }

  const resendApiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY
  const senderEmail = process.env.SENDER_EMAIL || 'SprintOS <onboarding@resend.dev>'
  const targetUrl = appUrl || `https://app.paper5.co/${workspaceId || ''}`

  const callerName = blockedByName || blockedBy || 'A team member'
  const subject = `🚨 [SprintOS] Help Requested: "${deadlineTitle || 'Task'}" is blocked`

  const textBody = `Blocker Alert\n\n${callerName} needs your help on a blocked deadline.\n\nTask: ${deadlineTitle || 'Untitled Task'}\nReason: ${reason || 'Not specified'}\nCategory: ${category || 'general'}\n${description ? `Details: ${description}\n` : ''}\nView and resolve the blocker here:\n${targetUrl}`

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
        .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .badge { display: inline-block; background: #fee2e2; color: #dc2626; padding: 4px 10px; border-radius: 9999px; font-weight: 700; font-size: 12px; margin-bottom: 12px; }
        .title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0; }
        .card { background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #e2e8f0; }
        .field { font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 4px; }
        .value { font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
        .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; margin-top: 16px; text-align: center; }
        .footer { font-size: 12px; color: #94a3b8; margin-top: 28px; border-top: 1px solid #f1f5f9; padding-top: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="badge">🚨 Blocker Alert</div>
        <h2 class="title">${callerName} requested your help</h2>
        <p style="font-size: 14px; color: #334155; line-height: 1.5; margin: 0 0 16px 0;">
          A deadline in <strong>${workspaceName || 'your workspace'}</strong> is blocked and requires your assistance to proceed.
        </p>
        
        <div class="card">
          <div class="field">Task</div>
          <div class="value">${deadlineTitle || 'Untitled Task'}</div>

          <div class="field">Blocker Reason</div>
          <div class="value" style="color: #dc2626;">${reason || 'Blocked'}</div>

          ${description ? `
            <div class="field">Details & Context</div>
            <div class="value" style="margin-bottom: 0; font-weight: 400; color: #334155;">${description}</div>
          ` : ''}
        </div>

        <a href="${targetUrl}" class="btn">View Task & Unblock →</a>

        <div class="footer">
          SprintOS Automated Notifications · Workspace: ${workspaceName || 'SprintOS'}
        </div>
      </div>
    </body>
    </html>
  `

  let sentCount = 0
  if (resendApiKey) {
    for (const email of cleanEmails) {
      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: senderEmail,
            to: [email],
            reply_to: process.env.REPLY_TO_EMAIL || 'support@paper5.co',
            subject: subject,
            html: htmlBody,
            text: textBody,
            headers: {
              'X-Entity-Ref-ID': `blk-${deadlineId}-${Date.now()}`,
              'List-Unsubscribe': '<mailto:support@paper5.co?subject=unsubscribe>',
              'X-Auto-Response-Suppress': 'OOF, AutoReply',
              'X-Mailer': 'SprintOS-Notification-Engine'
            }
          })
        })
        if (resp.ok) sentCount++
      } catch (e) {
        console.error('[API send-blocker-email] Error sending to', email, e)
      }
    }
  }

  return res.status(200).json({ success: true, sentCount, total: cleanEmails.length })
}
