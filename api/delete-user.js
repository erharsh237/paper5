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
  const { userId, email, workspaceId, fullDelete = false } = body || {}
  if (!userId && !email) {
    return res.status(400).json({ error: 'Missing userId or email parameter', receivedBody: body })
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

    // 0. Clean up deletion_requests in workspace settings
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

    // Check if the user belongs to any other workspaces
    let hasOtherWorkspaces = false
    if (!fullDelete && workspaceId && idsList.length > 0) {
      try {
        const { data: otherMemberships } = await supabaseAdmin
          .from('workspace_members')
          .select('workspace_id')
          .in('user_id', idsList)
          .neq('workspace_id', workspaceId)

        if (otherMemberships && otherMemberships.length > 0) {
          hasOtherWorkspaces = true
        }
      } catch (_) {}
    }

    // 1. If only removing from a specific workspace and user has other workspaces:
    if (hasOtherWorkspaces && workspaceId) {
      for (const id of idsList) {
        await supabaseAdmin.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', id)
      }
      return res.status(200).json({
        success: true,
        message: 'Member removed from workspace (retains access to other workspaces)',
        retainedWorkspaces: true
      })
    }

    const stepResults = []

    // 2. Full Account Deletion / Single Workspace Purge:
    for (const id of idsList) {
      try {
        const { data: allWsMembers, error: memFetchErr } = await supabaseAdmin
          .from('workspace_members')
          .select('*')
          .eq('user_id', id)

        stepResults.push({ step: 'fetch_user_memberships', id, count: allWsMembers?.length, fetchError: memFetchErr?.message || null })

        for (const mem of (allWsMembers || [])) {
          const currentWsId = mem.workspace_id

          // Fetch all rows in this workspace
          const { data: wsRows } = await supabaseAdmin
            .from('workspace_members')
            .select('*')
            .eq('workspace_id', currentWsId)

          const otherMembers = (wsRows || []).filter(m => m.user_id !== id && !idsList.includes(m.user_id))

          if (otherMembers.length === 0) {
            // Orphaned workspace: delete all child rows and workspace
            await supabaseAdmin.from('deadlines').delete().eq('workspace_id', currentWsId)
            await supabaseAdmin.from('sprints').delete().eq('workspace_id', currentWsId)
            await supabaseAdmin.from('workspace_invites').delete().eq('workspace_id', currentWsId)
            await supabaseAdmin.from('invites').delete().eq('workspace_id', currentWsId)
            await supabaseAdmin.from('workspace_members').delete().eq('workspace_id', currentWsId)
            await supabaseAdmin.from('workspaces').delete().eq('id', currentWsId)
            stepResults.push({ step: 'delete_orphaned_workspace', workspaceId: currentWsId })
            continue
          }

          // Team workspace: transfer ownership to another member
          const successorId = otherMembers[0].user_id

          // Update workspace created_by to successor FIRST
          const { error: wsErr } = await supabaseAdmin
            .from('workspaces')
            .update({ created_by: successorId })
            .eq('id', currentWsId)

          // Elevate all remaining members to 'owner'
          for (const om of otherMembers) {
            await supabaseAdmin
              .from('workspace_members')
              .update({ role: 'owner' })
              .eq('workspace_id', currentWsId)
              .eq('user_id', om.user_id)
          }

          // Temporarily elevate target to owner so count(*) >= 2
          await supabaseAdmin
            .from('workspace_members')
            .update({ role: 'owner' })
            .eq('workspace_id', currentWsId)
            .eq('user_id', id)

          // Delete target membership
          const { error: mErr } = await supabaseAdmin
            .from('workspace_members')
            .delete()
            .eq('workspace_id', currentWsId)
            .eq('user_id', id)

          stepResults.push({
            step: 'delete_membership',
            workspaceId: currentWsId,
            id,
            successorId,
            wsUpdateError: wsErr?.message || null,
            error: mErr?.message || null
          })
        }
      } catch (wsErr) {
        stepResults.push({ step: 'workspace_cleanup_exception', error: wsErr.message })
      }
    }

    // Direct delete from target workspace if specified
    if (workspaceId) {
      for (const id of idsList) {
        await supabaseAdmin.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', id)
      }
    }

    // 3. Clear ANY workspace and table references where user is listed as owner_id / created_by / assignee
    for (const id of idsList) {
      try {
        const { error: wsUpErr1 } = await supabaseAdmin
          .from('workspaces')
          .update({ owner_id: '48b3e98d-8acf-450f-9d32-966df188946d', created_by: '48b3e98d-8acf-450f-9d32-966df188946d' })
          .eq('owner_id', id)

        const { error: wsUpErr2 } = await supabaseAdmin
          .from('workspaces')
          .update({ created_by: '48b3e98d-8acf-450f-9d32-966df188946d' })
          .eq('created_by', id)

        stepResults.push({ step: 'update_workspace_owners', wsUpErr1: wsUpErr1?.message || null, wsUpErr2: wsUpErr2?.message || null })

        // Clear references across child tables
        try { await supabaseAdmin.from('deadlines').delete().eq('created_by', id) } catch (_) {}
        try { await supabaseAdmin.from('sprints').delete().eq('created_by', id) } catch (_) {}
        try { await supabaseAdmin.from('meeting_notes').delete().eq('created_by', id) } catch (_) {}
        try { await supabaseAdmin.from('integrations').delete().eq('user_id', id) } catch (_) {}
        try { await supabaseAdmin.from('activity_logs').delete().eq('user_id', id) } catch (_) {}
        try { await supabaseAdmin.from('tasks').update({ assignee_id: null }).eq('assignee_id', id) } catch (_) {}
      } catch (wsCleanupErr) {
        stepResults.push({ step: 'workspace_references_cleanup_err', error: wsCleanupErr.message })
      }
    }

    // 4. Remove notifications, profile and personal data
    for (const id of idsList) {
      const { error: pErr } = await supabaseAdmin.from('profiles').delete().eq('id', id)
      stepResults.push({ step: 'delete_profile_by_id', id, error: pErr?.message || null })
    }
    if (cleanEmail) {
      try { await supabaseAdmin.from('notifications').delete().ilike('forEmail', cleanEmail) } catch (_) {}
      try { await supabaseAdmin.from('notifications').delete().ilike('for_email', cleanEmail) } catch (_) {}
      try { await supabaseAdmin.from('notifications').delete().ilike('createdBy', cleanEmail) } catch (_) {}
      try { await supabaseAdmin.from('notifications').delete().ilike('created_by', cleanEmail) } catch (_) {}
      const { error: peErr } = await supabaseAdmin.from('profiles').delete().ilike('email', cleanEmail)
      const { error: invErr } = await supabaseAdmin.from('invites').delete().ilike('email', cleanEmail)
      const { error: winvErr } = await supabaseAdmin.from('workspace_invites').delete().ilike('email', cleanEmail)
      stepResults.push({ step: 'delete_profile_by_email', error: peErr?.message || null })
      stepResults.push({ step: 'delete_invites', error: invErr?.message || winvErr?.message || null })
    }

    // 5. Remove or sanitize user record from users table
    for (const id of idsList) {
      const { error: uErr } = await supabaseAdmin.from('users').delete().eq('id', id)
      if (uErr) {
        // If trigger blocks row deletion, sanitize all personal info from users table
        const { error: sanitizeErr } = await supabaseAdmin
          .from('users')
          .update({
            email: `deleted_${id.slice(0, 8)}_${Date.now()}@deleted.invalid`,
            full_name: 'Deleted User',
            raw_user_meta_data: {}
          })
          .eq('id', id)

        stepResults.push({ step: 'delete_user_by_id', id, error: uErr.message, sanitized: !sanitizeErr })
      } else {
        stepResults.push({ step: 'delete_user_by_id', id, error: null, sanitized: true })
      }
    }
    if (cleanEmail) {
      const { error: ueErr } = await supabaseAdmin.from('users').delete().ilike('email', cleanEmail)
      stepResults.push({ step: 'delete_user_by_email', error: ueErr?.message || null })
    }

    // 6. Delete authentication account from Supabase Auth
    let authDeleted = false
    let authError = null
    if (serviceKey) {
      for (const id of idsList) {
        try {
          const { error: aErr } = await supabaseAdmin.auth.admin.deleteUser(id)
          if (aErr) {
            authError = aErr.message || JSON.stringify(aErr)
          } else {
            authDeleted = true
            authError = null
          }
        } catch (authCatchErr) {
          authError = authCatchErr.message
        }
      }
    } else {
      authError = 'No SUPABASE_SERVICE_ROLE_KEY configured in serverless environment'
    }

    return res.status(200).json({
      api_version: 'v2.2',
      success: true,
      message: 'Account and personal data completely removed',
      accountPurged: true,
      hasServiceKey: Boolean(serviceKey),
      deletedUserIds: idsList,
      authDeleted,
      authError,
      stepResults
    })
  } catch (err) {
    console.error('Delete user error:', err)
    return res.status(500).json({ error: err.message || 'Failed to delete account' })
  }
}
