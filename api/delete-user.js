import { createClient } from '@supabase/supabase-js'

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (req.body && typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch (_) { return {} }
  }
  return req.body || {}
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = parseBody(req)
  const { userId, email, memberId, workspaceId, fullDelete = true } = body || {}
  const targetId = userId || memberId
  const cleanEmail = email ? email.trim().toLowerCase() : ''

  if (!targetId && !cleanEmail) {
    return res.status(400).json({ error: 'Missing userId, memberId or email parameter', receivedBody: body })
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
    const targetUserIds = new Set()
    if (targetId && !targetId.includes('@')) targetUserIds.add(targetId)

    // 1. Resolve all matching user IDs across tables and Supabase Auth
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

    // 2. Remove user from workspaces.settings.members, member_permissions, deletion_requests across all workspaces
    try {
      const { data: allWs } = await supabaseAdmin.from('workspaces').select('id, settings')
      for (const w of (allWs || [])) {
        if (!w.id) continue
        let settingsChanged = false
        const currentSettings = { ...(w.settings || {}) }

        // Clean settings.members array
        if (Array.isArray(currentSettings.members)) {
          const filteredMembers = currentSettings.members.filter(m => {
            const mId = m.id || m.userId
            const mEmail = (m.email || '').trim().toLowerCase()
            if (mId && idsList.includes(mId)) return false
            if (mEmail && cleanEmail && mEmail === cleanEmail) return false
            return true
          })
          if (filteredMembers.length !== currentSettings.members.length) {
            currentSettings.members = filteredMembers
            settingsChanged = true
          }
        }

        // Clean settings.member_permissions
        if (currentSettings.member_permissions && typeof currentSettings.member_permissions === 'object') {
          const perms = { ...currentSettings.member_permissions }
          for (const id of idsList) {
            if (perms[id]) { delete perms[id]; settingsChanged = true }
          }
          if (cleanEmail && perms[cleanEmail]) {
            delete perms[cleanEmail]
            settingsChanged = true
          }
          currentSettings.member_permissions = perms
        }

        // Clean settings.deletion_requests
        if (currentSettings.deletion_requests && typeof currentSettings.deletion_requests === 'object') {
          const reqs = { ...currentSettings.deletion_requests }
          for (const id of idsList) {
            if (reqs[id]) { delete reqs[id]; settingsChanged = true }
          }
          if (cleanEmail && reqs[cleanEmail]) {
            delete reqs[cleanEmail]
            settingsChanged = true
          }
          currentSettings.deletion_requests = reqs
        }

        if (settingsChanged) {
          await supabaseAdmin.from('workspaces').update({ settings: currentSettings }).eq('id', w.id)
        }
      }
    } catch (wsCleanErr) {
      console.warn('Workspace settings cleanup warning:', wsCleanErr)
    }

    // 3. Delete from workspace_members table
    for (const id of idsList) {
      try {
        await supabaseAdmin.from('workspace_members').delete().eq('user_id', id)
      } catch (_) {}
    }
    if (workspaceId) {
      for (const id of idsList) {
        try {
          await supabaseAdmin.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', id)
        } catch (_) {}
      }
    }

    // 4. Delete invites and workspace_invites
    if (cleanEmail) {
      try { await supabaseAdmin.from('invites').delete().ilike('email', cleanEmail) } catch (_) {}
      try { await supabaseAdmin.from('workspace_invites').delete().ilike('email', cleanEmail) } catch (_) {}
    }
    for (const id of idsList) {
      try { await supabaseAdmin.from('invites').delete().eq('user_id', id) } catch (_) {}
      try { await supabaseAdmin.from('workspace_invites').delete().eq('user_id', id) } catch (_) {}
    }

    // 5. Delete notifications
    if (cleanEmail) {
      try { await supabaseAdmin.from('notifications').delete().ilike('forEmail', cleanEmail) } catch (_) {}
      try { await supabaseAdmin.from('notifications').delete().ilike('for_email', cleanEmail) } catch (_) {}
      try { await supabaseAdmin.from('notifications').delete().ilike('createdBy', cleanEmail) } catch (_) {}
      try { await supabaseAdmin.from('notifications').delete().ilike('created_by', cleanEmail) } catch (_) {}
    }

    // 6. Delete profiles and users records
    for (const id of idsList) {
      try { await supabaseAdmin.from('profiles').delete().eq('id', id) } catch (_) {}
      try { await supabaseAdmin.from('users').delete().eq('id', id) } catch (_) {}
    }
    if (cleanEmail) {
      try { await supabaseAdmin.from('profiles').delete().ilike('email', cleanEmail) } catch (_) {}
      try { await supabaseAdmin.from('users').delete().ilike('email', cleanEmail) } catch (_) {}
    }

    // 7. Permanently delete from Supabase Auth
    let authDeleted = false
    let authError = null
    if (serviceKey) {
      for (const id of idsList) {
        try {
          const { error: aErr } = await supabaseAdmin.auth.admin.deleteUser(id)
          if (aErr) {
            authError = aErr.message
          } else {
            authDeleted = true
          }
        } catch (authCatchErr) {
          authError = authCatchErr.message
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'User account and all associated workspace records permanently deleted',
      accountPurged: true,
      deletedUserIds: idsList,
      authDeleted,
      authError
    })
  } catch (err) {
    console.error('Delete user error:', err)
    return res.status(500).json({ error: err.message || 'Failed to delete account' })
  }
}
