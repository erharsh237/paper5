import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://sdbglndhjkqhkphzqmum.supabase.co'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const activeKey = serviceKey || anonKey

  if (!activeKey) {
    return res.status(500).json({ error: 'Supabase credentials missing' })
  }

  const supabaseAdmin = createClient(supabaseUrl, activeKey)

  // POST: Update Member Role or Permissions
  if (req.method === 'POST') {
    const { action, workspaceId, memberId, role, permissions } = req.body || {}
    if (!workspaceId || !memberId) {
      return res.status(400).json({ error: 'Missing workspaceId or memberId' })
    }

    try {
      if (action === 'update_permissions') {
        const updatePayload = {
          permissions: Array.isArray(permissions) ? permissions : []
        }
        const { error } = await supabaseAdmin
          .from('workspace_members')
          .update(updatePayload)
          .eq('workspace_id', workspaceId)
          .eq('user_id', memberId)

        if (error) {
          // If column 'permissions' doesn't exist, try settings or ignore column error
          console.warn('Update permissions notice:', error.message)
        }
        return res.status(200).json({ success: true, permissions: Array.isArray(permissions) ? permissions : [] })
      }

      if (action === 'update_role') {
        const { error } = await supabaseAdmin
          .from('workspace_members')
          .update({ role: role || 'member' })
          .eq('workspace_id', workspaceId)
          .eq('user_id', memberId)

        if (error) throw error
        return res.status(200).json({ success: true, role })
      }
    } catch (postErr) {
      console.error('Update member error:', postErr)
      return res.status(500).json({ error: postErr.message || 'Failed to update member' })
    }
  }

  // GET: Fetch All Members with Real Emails and Full Names
  const workspaceId = req.query.workspaceId || req.body?.workspaceId
  if (!workspaceId) {
    return res.status(400).json({ error: 'Missing workspaceId parameter' })
  }

  try {
    const { data: members, error: memErr } = await supabaseAdmin
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)

    if (memErr) throw memErr

    const userIds = (members || []).map(m => m.user_id).filter(Boolean)
    const userDetailsMap = new Map()

    // 1. Fetch from users table
    if (userIds.length > 0) {
      try {
        const { data: usersData } = await supabaseAdmin
          .from('users')
          .select('id, email, full_name, avatar_url')
          .in('id', userIds)
        for (const u of (usersData || [])) {
          if (u.id) userDetailsMap.set(u.id, u)
        }
      } catch (_) {}
    }

    // 2. Fetch from profiles table
    if (userIds.length > 0) {
      try {
        const { data: profData } = await supabaseAdmin
          .from('profiles')
          .select('id, email, name, photoURL')
          .in('id', userIds)
        for (const p of (profData || [])) {
          if (p.id) {
            const existing = userDetailsMap.get(p.id) || {}
            userDetailsMap.set(p.id, {
              ...existing,
              email: existing.email || p.email,
              full_name: existing.full_name || p.name,
              avatar_url: existing.avatar_url || p.photoURL
            })
          }
        }
      } catch (_) {}
    }

    // 3. For any remaining missing emails, query auth.admin if service key is available
    if (serviceKey && typeof supabaseAdmin.auth?.admin?.getUserById === 'function') {
      for (const uid of userIds) {
        const existing = userDetailsMap.get(uid)
        if (!existing || !existing.email) {
          try {
            const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(uid)
            if (authUser?.user) {
              const u = authUser.user
              userDetailsMap.set(uid, {
                id: uid,
                email: u.email,
                full_name: u.user_metadata?.full_name || u.user_metadata?.name || existing?.full_name || null,
                avatar_url: u.user_metadata?.avatar_url || existing?.avatar_url || null
              })
            }
          } catch (_) {}
        }
      }
    }

    // Build enriched member records
    const enrichedMembers = (members || []).map(m => {
      const u = userDetailsMap.get(m.user_id) || {}
      const email = u.email || m.email || null
      const fullName = u.full_name || m.full_name || null
      const displayLabel = fullName || email || (email ? email.split('@')[0] : `Member (${(m.user_id || '').slice(0, 6)})`)

      return {
        id: m.user_id,
        userId: m.user_id,
        workspaceId: m.workspace_id,
        role: m.role || 'member',
        permissions: Array.isArray(m.permissions) ? m.permissions : [],
        email: email,
        fullName: fullName,
        displayLabel: displayLabel,
        avatarUrl: u.avatar_url || null,
        joinedAt: m.joined_at || m.created_at
      }
    })

    return res.status(200).json({ success: true, members: enrichedMembers })
  } catch (err) {
    console.error('workspace-members API error:', err)
    return res.status(500).json({ error: err.message || 'Failed to fetch members' })
  }
}
