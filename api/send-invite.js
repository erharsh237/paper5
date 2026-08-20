import { createClient } from '@supabase/supabase-js'

// Vercel Serverless API function to dispatch invitation email with login credentials
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { workspaceName, email, role, password, loginUrl } = req.body || {}

  if (!email) {
    return res.status(400).json({ error: 'Missing required parameter: email' })
  }

  const cleanEmail = email.trim().toLowerCase()
  const finalPassword = password || 'aA1!tempPwd' + Math.floor(1000 + Math.random() * 9000)
  const resendApiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://sdbglndhjkqhkphzqmum.supabase.co'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

  const subject = `You've been invited to join ${workspaceName || 'a workspace'} on SprintOS`
  const targetJoinUrl = `https://app.paper5.co/signup?email=${encodeURIComponent(cleanEmail)}`

  const textBody = `Workspace Invitation\n\nYou have been invited to join ${workspaceName || 'Workspace'} as a ${role || 'Member'} on SprintOS.\n\nInvited Email: ${cleanEmail}\nRole: ${role || 'Member'}\n\nAccept your invitation and join the workspace here:\n${targetJoinUrl}\n\nPlease verify your email and set your password to complete your account setup.`

  const htmlBody = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Workspace Invitation</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
        .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0; }
        .card { background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #e2e8f0; }
        .field { font-size: 12px; color: #64748b; margin-bottom: 4px; text-transform: uppercase; font-weight: 600; }
        .value { font-size: 14px; font-weight: 600; color: #0f172a; }
        .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 16px; }
        .footer { font-size: 12px; color: #94a3b8; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
        You have been invited to join ${workspaceName || 'a workspace'} on SprintOS. Accept your invitation to collaborate with your team.
      </div>
      <div class="container">
        <h2 class="title">Workspace Invitation</h2>
        <p style="font-size: 14px; line-height: 1.5; color: #334155;">
          You have been invited to join <strong>${workspaceName || 'Workspace'}</strong> as a <strong>${role || 'Member'}</strong> on SprintOS.
        </p>
        
        <div class="card">
          <div class="field">Invited Email</div>
          <div class="value" style="margin-bottom: 12px;">${cleanEmail}</div>
          <div class="field">Assigned Role</div>
          <div class="value">${role || 'Member'}</div>
        </div>

        <p style="font-size: 14px; line-height: 1.5; color: #334155;">
          Click below to verify your email address, set up your password, and join the workspace:
        </p>

        <a href="${targetJoinUrl}" class="btn" style="color: #ffffff;">Accept Invitation & Join Workspace &rarr;</a>

        <div class="footer">
          If you did not expect this invitation, you can safely ignore this email.<br>
          SprintOS Technologies · <a href="https://app.paper5.co" style="color: #64748b; text-decoration: underline;">app.paper5.co</a>
        </div>
      </div>
    </body>
    </html>
  `

  let emailSent = false
  let resendDetails = null

  // Clear any lingering stale notifications from previous account lifecycles
  if (supabaseUrl && serviceKey) {
    try {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey)
      await supabaseAdmin.from('notifications').delete().ilike('forEmail', cleanEmail).catch(() => {})
      await supabaseAdmin.from('notifications').delete().ilike('for_email', cleanEmail).catch(() => {})
    } catch (_) {}
  }

  // 2. Dispatch the single official invitation email via Resend API
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
          subject: subject,
          html: htmlBody,
          text: textBody,
          headers: {
            'X-Entity-Ref-ID': `inv-${Date.now()}`,
            'List-Unsubscribe': '<mailto:support@paper5.co?subject=unsubscribe>',
            'X-Auto-Response-Suppress': 'OOF, AutoReply',
            'X-Mailer': 'SprintOS-Notification-Engine'
          }
        })
      })

      const data = await response.json()
      if (response.ok && data.id) {
        emailSent = true
        resendDetails = data
      } else {
        console.warn('[API send-invite] Resend API Warning:', data)
        resendDetails = data
      }
    } catch (e) {
      console.error('[API send-invite] Resend fetch exception:', e)
    }
  }

  return res.status(200).json({
    success: true,
    emailSent,
    resendDetails
  })
}
