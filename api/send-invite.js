// Vercel Serverless API function to dispatch invitation email with login credentials
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { workspaceName, email, role, password, loginUrl } = req.body || {}

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing required parameters: email and password' })
  }

  const resendApiKey = process.env.RESEND_API_KEY
  const senderEmail = process.env.SENDER_EMAIL || 'SprintOS <no-reply@paper5.co>'

  const subject = `You've been invited to join ${workspaceName || 'a workspace'} on SprintOS`
  const targetLoginUrl = loginUrl || 'https://app.paper5.co/login'

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; color: #111827; margin: 0; padding: 24px; }
        .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
        .title { font-size: 20px; font-weight: 700; color: #111827; margin: 0; }
        .card { background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #e5e7eb; }
        .field { font-size: 13px; color: #4b5563; margin-bottom: 6px; }
        .value { font-size: 15px; font-weight: 600; color: #111827; font-family: monospace; }
        .btn { display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 16px; }
        .footer { font-size: 12px; color: #9ca3af; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2 class="title">Workspace Invitation 🚀</h2>
        <p>You have been invited to join <strong>${workspaceName || 'Workspace'}</strong> as a <strong>${role || 'Member'}</strong> on SprintOS.</p>
        
        <div class="card">
          <div class="field">Login Email:</div>
          <div class="value" style="margin-bottom: 12px;">${email}</div>
          <div class="field">Temporary Password:</div>
          <div class="value">${password}</div>
        </div>

        <p>Please log in and update your password upon your first sign in.</p>

        <a href="${targetLoginUrl}" class="btn">Log In to Workspace &rarr;</a>

        <div class="footer">
          If you did not expect this invitation, you can safely ignore this email.<br>
          Powered by SprintOS Technologies.
        </div>
      </div>
    </body>
    </html>
  `

  if (!resendApiKey) {
    console.log('[API send-invite] RESEND_API_KEY not configured. Simulated dispatch for:', email)
    return res.status(200).json({ success: true, simulated: true })
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
        to: [email],
        subject: subject,
        html: htmlBody
      })
    })

    const data = await response.json()
    if (!response.ok) {
      console.error('[API send-invite] Resend API error:', data)
      return res.status(400).json({ error: data.message || 'Failed to send email' })
    }

    return res.status(200).json({ success: true, data })
  } catch (err) {
    console.error('[API send-invite] Exception:', err)
    return res.status(500).json({ error: err.message || 'Internal Server Error' })
  }
}
