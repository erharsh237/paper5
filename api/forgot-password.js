import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email } = req.body || {}
  if (!email) {
    return res.status(400).json({ error: 'Email parameter is required' })
  }

  const cleanEmail = email.trim().toLowerCase()
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://sdbglndhjkqhkphzqmum.supabase.co'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const resendApiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY

  if (!serviceKey) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey)

  try {
    // Generate recovery link using Supabase Admin API with guaranteed target domain app.paper5.co
    const targetRedirect = 'https://app.paper5.co/auth/action'

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: cleanEmail,
      options: {
        redirectTo: targetRedirect
      }
    })

    if (linkErr) {
      console.error('generateLink error:', linkErr)
      return res.status(400).json({ error: linkErr.message || 'Could not generate reset link' })
    }

    const tokenHash = linkData?.properties?.hashed_token
    const emailOtp = linkData?.properties?.email_otp

    // Generate direct, unbreakable link to app.paper5.co
    let directActionLink = ''
    if (tokenHash) {
      directActionLink = `https://app.paper5.co/auth/action?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`
    } else if (emailOtp) {
      directActionLink = `https://app.paper5.co/auth/action?email=${encodeURIComponent(cleanEmail)}&token=${encodeURIComponent(emailOtp)}&type=recovery`
    } else {
      let actionLink = linkData?.properties?.action_link || 'https://app.paper5.co/auth/action'
      directActionLink = actionLink
        .replace(/app\.paper5\.com/g, 'app.paper5.co')
        .replace(/redirect_to=http%3A%2F%2Fapp\.paper5\.com/g, 'redirect_to=https%3A%2F%2Fapp.paper5.co')
        .replace(/redirect_to=https%3A%2F%2Fapp\.paper5\.com/g, 'redirect_to=https%3A%2F%2Fapp.paper5.co')
    }

    const actionLink = directActionLink

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827; margin: 0; padding: 24px; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .title { font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 16px 0; }
          .btn { display: inline-block; background: #10b981; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 24px 0; }
          .link-fallback { word-break: break-all; font-size: 12px; color: #6b7280; margin-top: 16px; }
          .footer { font-size: 12px; color: #9ca3af; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2 class="title">Reset Your Password 🔐</h2>
          <p>We received a request to reset the password for your SprintOS account (<strong>${cleanEmail}</strong>).</p>
          
          <a href="${actionLink}" class="btn" target="_blank" rel="noopener noreferrer">Reset Password &rarr;</a>

          <p style="font-size: 13px; color: #4b5563;">This link will expire in 24 hours. If you did not request a password reset, you can safely ignore this email.</p>

          <div class="link-fallback">
            If the button above does not work, copy and paste this link into your browser:<br>
            <a href="${actionLink}" style="color: #10b981;">${actionLink}</a>
          </div>

          <div class="footer">
            SprintOS Technologies · Security & Account Management
          </div>
        </div>
      </body>
      </html>
    `

    const textBody = `Reset Your Password\n\nWe received a request to reset the password for your SprintOS account (${cleanEmail}).\n\nClick the link below to set a new password:\n${actionLink}\n\nThis link will expire in 24 hours. If you did not request this, you can ignore this email.`

    // Send email via Resend
    if (resendApiKey) {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.SENDER_EMAIL || 'SprintOS <onboarding@resend.dev>',
          to: [cleanEmail],
          subject: 'Reset your SprintOS password',
          html: htmlBody,
          text: textBody
        })
      })

      const resendJson = await resp.json()
      if (!resp.ok) {
        console.warn('Resend dispatch notice:', resendJson)
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Password reset link sent'
    })
  } catch (err) {
    console.error('Password reset handler exception:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
