import { createClient } from '@supabase/supabase-js'

// Vercel Serverless API to provision invited user accounts without client-side rate limits
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing required parameters' })
  }

  const cleanEmail = email.trim().toLowerCase()
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://sdbglndhjkqhkphzqmum.supabase.co'
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Supabase configuration missing' })
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

  // 1. Verify that email exists in database `invites` table with matching password_hint
  const { data: inviteMatch } = await supabaseAdmin
    .from('invites')
    .select('*')
    .ilike('email', cleanEmail)
    .maybeSingle()

  if (!inviteMatch) {
    return res.status(404).json({ error: 'No invitation found for this email address' })
  }

  if (inviteMatch.password_hint && inviteMatch.password_hint !== password) {
    return res.status(401).json({ error: 'Invalid temporary password' })
  }

  // 2. Pre-create user in Auth with admin privileges (bypassing client-side rate limits & email confirmation requirement)
  let userId = null
  try {
    if (supabaseAdmin?.auth?.admin?.createUser) {
      const { data: adminUser, error: adminErr } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          must_change_password: true,
          invited_workspace_id: inviteMatch.workspace_id,
          invited_role: inviteMatch.role
        }
      })
      if (adminUser?.user?.id) {
        userId = adminUser.user.id
      }
    }
  } catch (e) {
    console.warn('[provision-invite-login] Admin create user notice:', e)
  }

  // Fallback to signUp if admin.createUser is not enabled
  if (!userId) {
    try {
      const { data: suData } = await supabaseAdmin.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            must_change_password: true,
            invited_workspace_id: inviteMatch.workspace_id,
            invited_role: inviteMatch.role
          }
        }
      })
      if (suData?.user?.id) {
        userId = suData.user.id
      }
    } catch (suEx) {}
  }

  // 3. Mark user in `users` table as requiring password reset
  if (userId) {
    await supabaseAdmin.from('users').upsert({
      id: userId,
      email: cleanEmail,
      requires_password_reset: true,
      updated_at: new Date().toISOString()
    }).catch(e => {})
  }

  return res.status(200).json({ success: true, provisioned: true })
}
