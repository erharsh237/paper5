import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId, email, workspaceId } = req.body || {}
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
    const cleanEmail = email ? email.trim().toLowerCase() : ''
    const targetUserIds = new Set()
    if (userId) targetUserIds.add(userId)

    // Find all matching user IDs across tables
    if (cleanEmail) {
      try {
        const { data: uData } = await supabaseAdmin.from('users').select('id').ilike('email', cleanEmail)
        for (const u of (uData || [])) { if (u.id) targetUserIds.add(u.id) }
      } catch (_) {}

      try {
        const { data: pData } = await supabaseAdmin.from('profiles').select('id').ilike('email', cleanEmail)
        for (const p of (pData || [])) { if (p.id) targetUserIds.add(p.id) }
      } catch (_) {}

      if (serviceKey) {
        try {
          const { data: authList } = await supabaseAdmin.auth.admin.listUsers()
          for (const au of (authList?.users || [])) {
            if (au.email?.toLowerCase() === cleanEmail) {
              targetUserIds.add(au.id)
            }
          }
        } catch (_) {}
      }
    }

    const idsList = Array.from(targetUserIds)

    // 0. If workspaceId passed, clean up deletion_requests in workspace settings
    if (workspaceId) {
      try {
        const { data: ws } = await supabaseAdmin
          .from('workspaces')
          .select('settings')
          .eq('id', workspaceId)
          .maybeSingle()

        if (ws?.settings?.deletion_requests) {
          const reqs = { ...ws.settings.deletion_requests }
          for (const id of idsList) {
            delete reqs[id]
          }
          if (cleanEmail) delete reqs[cleanEmail]

          await supabaseAdmin
            .from('workspaces')
            .update({ settings: { ...ws.settings, deletion_requests: reqs } })
            .eq('id', workspaceId)
        }
      } catch (_) {}
    }

    // 1. Remove from workspace memberships everywhere
    for (const id of idsList) {
      await supabaseAdmin.from('workspace_members').delete().eq('user_id', id)
    }

    // 2. Remove profile and personal data
    for (const id of idsList) {
      await supabaseAdmin.from('profiles').delete().eq('id', id)
    }
    if (cleanEmail) {
      await supabaseAdmin.from('profiles').delete().ilike('email', cleanEmail)
      await supabaseAdmin.from('invites').delete().ilike('email', cleanEmail)
    }

    // 3. Remove user record from users table
    for (const id of idsList) {
      await supabaseAdmin.from('users').delete().eq('id', id)
    }
    if (cleanEmail) {
      await supabaseAdmin.from('users').delete().ilike('email', cleanEmail)
    }

    // 4. Delete authentication account from Supabase Auth
    if (serviceKey) {
      for (const id of idsList) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(id)
        } catch (authErr) {
          console.warn(`Auth admin delete notice for ${id}:`, authErr.message)
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Account and personal data successfully deleted',
      deletedUserIds: idsList
    })
  } catch (err) {
    console.error('Delete user error:', err)
    return res.status(500).json({ error: err.message || 'Failed to delete account' })
  }
}
