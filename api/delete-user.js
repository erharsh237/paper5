import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId, email } = req.body || {}
  if (!userId && !email) {
    return res.status(400).json({ error: 'Missing userId or email parameter' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://sdbglndhjkqhkphzqmum.supabase.co'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY

  const activeKey = serviceKey || anonKey
  if (!activeKey) {
    return res.status(500).json({ error: 'Supabase configuration missing' })
  }

  const supabaseAdmin = createClient(supabaseUrl, activeKey)

  try {
    // 1. Remove from workspace memberships
    if (userId) {
      await supabaseAdmin.from('workspace_members').delete().eq('user_id', userId)
    }

    // 2. Remove profile and personal data
    if (userId) {
      await supabaseAdmin.from('profiles').delete().eq('id', userId)
    }
    if (email) {
      await supabaseAdmin.from('profiles').delete().ilike('email', email.trim().toLowerCase())
      await supabaseAdmin.from('invites').delete().ilike('email', email.trim().toLowerCase())
    }

    // 3. Remove user record from users table
    if (userId) {
      await supabaseAdmin.from('users').delete().eq('id', userId)
    }

    // 4. Delete authentication account if service role key is available
    if (serviceKey && userId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId)
      } catch (authErr) {
        console.warn('Auth admin delete notice:', authErr.message)
      }
    }

    return res.status(200).json({ success: true, message: 'Account and personal data successfully deleted' })
  } catch (err) {
    console.error('Delete user error:', err)
    return res.status(500).json({ error: err.message || 'Failed to delete account' })
  }
}
