// Vercel Serverless API function to dispatch deadline assignment notification emails
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const {
    toName,
    toEmail,
    title,
    description,
    dueDate,
    priority,
    assignedBy,
    workspaceName,
    appUrl
  } = req.body || {}

  if (!toEmail) {
    return res.status(400).json({ error: 'Missing required parameter: toEmail' })
  }

  const cleanEmail = toEmail.trim().toLowerCase()
  const resendApiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY
  const senderEmail = process.env.SENDER_EMAIL || 'SprintOS <no-reply@paper5.co>'
  const targetUrl = appUrl || 'https://app.paper5.co'

  const assigneeDisplayName = toName || cleanEmail.split('@')[0]
  const creatorName = assignedBy || 'A team member'
  const taskPriority = (priority || 'medium').toUpperCase()
  const formattedDueDate = dueDate ? new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No due date'

  const subject = `📋 [SprintOS] New Deadline Assigned: "${title || 'Task'}"`

  const textBody = `New Deadline Assigned\n\nHi ${assigneeDisplayName},\n\n${creatorName} assigned you a new deadline on SprintOS.\n\nTask: ${title || 'Untitled Task'}\nDue Date: ${formattedDueDate}\nPriority: ${taskPriority}\n${description ? `Details: ${description}\n` : ''}\nView task: ${targetUrl}`

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
        .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .badge { display: inline-block; background: #e0e7ff; color: #4338ca; padding: 4px 10px; border-radius: 9999px; font-weight: 700; font-size: 12px; margin-bottom: 12px; }
        .title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0; }
        .card { background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #e2e8f0; }
        .field { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 4px; }
        .value { font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
        .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; margin-top: 16px; text-align: center; }
        .footer { font-size: 12px; color: #94a3b8; margin-top: 28px; border-top: 1px solid #f1f5f9; padding-top: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="badge">TASK ASSIGNMENT</div>
        <h2 class="title">You have been assigned a new task</h2>
        <p style="font-size: 14px; color: #334155; line-height: 1.5; margin: 0 0 16px 0;">
          <strong>${creatorName}</strong> has assigned you to <strong>"${title || 'Untitled Task'}"</strong>${workspaceName ? ` in <strong>${workspaceName}</strong>` : ''}.
        </p>

        <div class="card">
          <div class="field">Task Title</div>
          <div class="value">${title || 'Untitled Task'}</div>

          <div style="display: flex; gap: 24px;">
            <div>
              <div class="field">Due Date</div>
              <div class="value" style="margin-bottom: 0;">${formattedDueDate}</div>
            </div>
            <div>
              <div class="field">Priority</div>
              <div class="value" style="margin-bottom: 0;">${taskPriority}</div>
            </div>
          </div>

          ${description ? `
            <div style="margin-top: 12px;">
              <div class="field">Description</div>
              <div style="font-size: 13px; color: #334155; line-height: 1.5; white-space: pre-wrap;">${description}</div>
            </div>
          ` : ''}
        </div>

        <a href="${targetUrl}" class="btn" style="color: #ffffff;">Open Task in SprintOS &rarr;</a>

        <div class="footer">
          SprintOS Automated Notification Engine · <a href="https://app.paper5.co" style="color: #64748b; text-decoration: underline;">app.paper5.co</a>
        </div>
      </div>
    </body>
    </html>
  `

  if (!resendApiKey) {
    console.warn('[API send-deadline-email] RESEND_API_KEY is not configured in environment variables.')
    return res.status(200).json({ success: false, skipped: true, error: 'RESEND_API_KEY missing' })
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: senderEmail,
        to: [cleanEmail],
        reply_to: process.env.REPLY_TO_EMAIL || 'support@paper5.co',
        subject: subject,
        html: htmlBody,
        text: textBody
      })
    })

    const data = await response.json()
    if (response.ok && data.id) {
      return res.status(200).json({ success: true, emailId: data.id })
    } else {
      console.warn('[API send-deadline-email] Resend API Error:', data)
      return res.status(200).json({ success: false, error: data.message || 'Resend error' })
    }
  } catch (err) {
    console.error('[API send-deadline-email] Exception:', err)
    return res.status(500).json({ error: err.message || 'Failed to dispatch email' })
  }
}
