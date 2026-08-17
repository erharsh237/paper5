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
  const targetLoginUrl = loginUrl || 'https://app.paper5.co/login'

  const textBody = `Workspace Invitation\n\nYou have been invited to join ${workspaceName || 'Workspace'} as a ${role || 'Member'} on SprintOS.\n\nLogin Email: ${cleanEmail}\nTemporary Password: ${finalPassword}\n\nLog in to your workspace here: ${targetLoginUrl}\n\nPlease update your password upon your first sign in.`

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
          <div class="value" style="margin-bottom: 12px;">${cleanEmail}</div>
          <div class="field">Temporary Password:</div>
          <div class="value">${finalPassword}</div>
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

  let emailSent = false
  let resendDetails = null

  // 1. Pre-provision user account in Supabase Auth using Admin API with email_confirm: true
  // IMPORTANT: We do NOT use auth.signUp() or auth.admin.inviteUserByEmail() because they trigger Supabase's built-in "Verify Your Email Address" OTP email.
  if (supabaseUrl && serviceKey) {
    try {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey)
      
      if (typeof supabaseAdmin.auth?.admin?.createUser === 'function') {
        const { data: userData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password: finalPassword,
          email_confirm: true, // Auto-confirm email to SUPPRESS Supabase OTP / verification email!
          user_metadata: {
            must_change_password: true,
            invited_workspace: workspaceName || 'Workspace'
          }
        })

        let newUserId = userData?.user?.id

        if (createErr && createErr.message?.toLowerCase().includes('already')) {
          // If user already exists, update their password so temporary password works without OTP
          const { data: userList } = await supabaseAdmin.auth.admin.listUsers()
          const existingUser = (userList?.users || []).find(u => u.email?.toLowerCase() === cleanEmail)
          if (existingUser) {
            newUserId = existingUser.id
            await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
              password: finalPassword,
              email_confirm: true,
              user_metadata: {
                ...existingUser.user_metadata,
                must_change_password: true,
                invited_workspace: workspaceName || 'Workspace'
              }
            })
          }
        }

        if (newUserId) {
          await supabaseAdmin.from('users').upsert({
            id: newUserId,
            email: cleanEmail,
            requires_password_reset: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' }).catch(e => console.warn('[API send-invite] Users upsert notice:', e))
        }
      }
    } catch (createEx) {
      console.warn('[API send-invite] Auth provisioning notice:', createEx)
    }
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
          from: process.env.SENDER_EMAIL || 'SprintOS <onboarding@resend.dev>',
          to: [cleanEmail],
          subject: subject,
          html: htmlBody,
          text: textBody,
          headers: {
            'X-Entity-Ref-ID': `inv-${Date.now()}`
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
