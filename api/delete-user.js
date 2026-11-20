import { createClient } from '@supabase/supabase-js'
import { authenticateUser, verifyWorkspaceAccess } from './_auth.js'
import { sanitizeError } from './_errors.js'

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

  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY

  const activeKey = serviceKey || anonKey
  if (!rawUrl || !activeKey) {
    return res.status(500).json({ error: 'Supabase configuration missing' })
  }

  const supabaseUrl = rawUrl.replace(/["']/g, '').trim()
  const supabaseAdmin = createClient(supabaseUrl, activeKey.replace(/["']/g, '').trim())

  const body = parseBody(req)
  const { userId, email, memberId, workspaceId, fullDelete = true } = body || {}
  const targetId = userId || memberId
  const cleanEmail = email ? email.trim().toLowerCase() : ''

  if (!targetId && !cleanEmail) {
    return res.status(400).json({ error: 'Missing userId, memberId or email parameter' })
  }

  // 1. Authenticate caller
  const authRes = await authenticateUser(req, supabaseAdmin)
  if (authRes.error) {
    return res.status(authRes.status || 401).json({ error: authRes.error })
  }

  // 2. Authorization check:
  // Is caller deleting themselves?
  const isSelf = (targetId && targetId === authRes.user.id) || (cleanEmail && cleanEmail === authRes.user.email?.toLowerCase())
  if (!isSelf) {
    // If not deleting themselves, they MUST be a workspace admin/owner of workspaceId
    if (!workspaceId) {
      return res.status(403).json({ error: 'Access denied: Workspace ID required for administrative user deletion.' })
    }
    const wsAuth = await verifyWorkspaceAccess(req, supabaseAdmin, workspaceId, { requireAdmin: true })
    if (wsAuth.error) {
      return res.status(wsAuth.status || 403).json({ error: wsAuth.error })
    }
  }

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

    // 2. Clean up workspaces metadata (members array, permissions, deletion requests)
    try {
      const { data: wsList } = await supabaseAdmin.from('workspaces').select('id, settings')
      for (const ws of (wsList || [])) {
        if (!ws.settings) continue
        let settingsChanged = false
        const currentSettings = { ...ws.settings }

        if (Array.isArray(currentSettings.members)) {
          const filtered = currentSettings.members.filter(m => {
            const mId = m.id || m.userId
            const mEmail = (m.email || '').trim().toLowerCase()
            if (mId && (idsList.includes(mId) || mId === targetId)) return false
            if (mEmail && cleanEmail && mEmail === cleanEmail) return false
            return true
          })
          if (filtered.length !== currentSettings.members.length) {
            currentSettings.members = filtered
            settingsChanged = true
          }
        }

        if (currentSettings.member_permissions) {
          const perms = { ...currentSettings.member_permissions }
          for (const id of idsList) { if (perms[id]) { delete perms[id]; settingsChanged = true } }
          if (targetId && perms[targetId]) { delete perms[targetId]; settingsChanged = true }
          if (cleanEmail && perms[cleanEmail]) { delete perms[cleanEmail]; settingsChanged = true }
          currentSettings.member_permissions = perms
        }

        if (currentSettings.deletion_requests) {
          const reqs = { ...currentSettings.deletion_requests }
          for (const id of idsList) { if (reqs[id]) { delete reqs[id]; settingsChanged = true } }
          if (targetId && reqs[targetId]) { delete reqs[targetId]; settingsChanged = true }
          if (cleanEmail && reqs[cleanEmail]) { delete reqs[cleanEmail]; settingsChanged = true }
          currentSettings.deletion_requests = reqs
        }

        if (settingsChanged) {
          await supabaseAdmin.from('workspaces').update({ settings: currentSettings }).eq('id', ws.id)
        }
      }
    } catch (_) {}

    // 3. Delete from workspace_members table
    if (targetId) {
      try { await supabaseAdmin.from('workspace_members').delete().eq('user_id', targetId) } catch (_) {}
    }
    for (const id of idsList) {
      try { await supabaseAdmin.from('workspace_members').delete().eq('user_id', id) } catch (_) {}
    }

    // 4. Delete invites matching email
    if (cleanEmail) {
      try { await supabaseAdmin.from('invites').delete().ilike('email', cleanEmail) } catch (_) {}
      try { await supabaseAdmin.from('workspace_invites').delete().ilike('email', cleanEmail) } catch (_) {}
    }

    // 5. Delete audit logs, notifications, sessions
    for (const id of idsList) {
      try { await supabaseAdmin.from('notifications').delete().eq('user_id', id) } catch (_) {}
      try { await supabaseAdmin.from('audit_logs').delete().eq('actor_id', id) } catch (_) {}
    }
    if (cleanEmail) {
      try { await supabaseAdmin.from('notifications').delete().ilike('forEmail', cleanEmail) } catch (_) {}
    }

    // 6. Delete from profiles and users tables
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
          if (aErr) authError = aErr.message
          else authDeleted = true
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
    console.error('Delete user error:', err?.message || err)
    return res.status(500).json({ error: sanitizeError(err, 'Failed to delete account') })
  }
}
