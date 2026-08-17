async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (req.body && typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch (_) { return {} }
  }
  try {
    const chunks = []
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    }
    if (chunks.length === 0) return {}
    const raw = Buffer.concat(chunks).toString('utf8')
    return JSON.parse(raw)
  } catch (_) {
    return {}
  }
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = await parseBody(req)
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
        const { data: userMemberships } = await supabaseAdmin
          .from('workspace_members')
          .select('workspace_id, role')
          .eq('user_id', id)

        for (const mem of (userMemberships || [])) {
          // Fetch workspace details
          const { data: wsData } = await supabaseAdmin
            .from('workspaces')
            .select('id, owner_id, created_by')
            .eq('id', mem.workspace_id)
            .maybeSingle()

          const realOwnerId = wsData?.owner_id || wsData?.created_by

          // If this user is the sole owner/creator of the workspace, delete the workspace entirely
          if (realOwnerId === id || mem.role === 'owner') {
            const { data: otherOwners } = await supabaseAdmin
              .from('workspace_members')
              .select('user_id')
              .eq('workspace_id', mem.workspace_id)
              .eq('role', 'owner')
              .neq('user_id', id)

            if (!otherOwners || otherOwners.length === 0) {
              await supabaseAdmin.from('deadlines').delete().eq('workspace_id', mem.workspace_id)
              await supabaseAdmin.from('sprints').delete().eq('workspace_id', mem.workspace_id)
              await supabaseAdmin.from('workspace_invites').delete().eq('workspace_id', mem.workspace_id)
              await supabaseAdmin.from('invites').delete().eq('workspace_id', mem.workspace_id)
              await supabaseAdmin.from('workspace_members').delete().eq('workspace_id', mem.workspace_id)
              await supabaseAdmin.from('workspaces').delete().eq('id', mem.workspace_id)
              stepResults.push({ step: 'delete_owned_workspace', workspaceId: mem.workspace_id })
              continue
            }
          }

          // If workspace belongs to someone else, ensure the real owner is recorded as 'owner' in workspace_members first
          if (realOwnerId && realOwnerId !== id) {
            try {
              await supabaseAdmin
                .from('workspace_members')
                .upsert({
                  workspace_id: mem.workspace_id,
                  user_id: realOwnerId,
                  role: 'owner'
                }, { onConflict: 'workspace_id,user_id' })
            } catch (_) {}
          }

          // Delete specific membership row
          const { error: mErr } = await supabaseAdmin
            .from('workspace_members')
            .delete()
            .eq('workspace_id', mem.workspace_id)
            .eq('user_id', id)

          stepResults.push({ step: 'delete_membership', workspaceId: mem.workspace_id, id, error: mErr?.message || null })
        }
      } catch (wsErr) {
        stepResults.push({ step: 'workspace_cleanup_exception', error: wsErr.message })
      }
    }

    // Direct delete from target workspace if specified
    if (workspaceId) {
      const { data: targetWs } = await supabaseAdmin
        .from('workspaces')
        .select('id, owner_id, created_by')
        .eq('id', workspaceId)
        .maybeSingle()

      const targetOwnerId = targetWs?.owner_id || targetWs?.created_by
      if (targetOwnerId && !idsList.includes(targetOwnerId)) {
        try {
          await supabaseAdmin
            .from('workspace_members')
            .upsert({
              workspace_id: workspaceId,
              user_id: targetOwnerId,
              role: 'owner'
            }, { onConflict: 'workspace_id,user_id' })
        } catch (_) {}
      }

      for (const id of idsList) {
        await supabaseAdmin.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', id)
      }
    }

    // 3. Remove profile and personal data
    for (const id of idsList) {
      const { error: pErr } = await supabaseAdmin.from('profiles').delete().eq('id', id)
      stepResults.push({ step: 'delete_profile_by_id', id, error: pErr?.message || null })
    }
    if (cleanEmail) {
      const { error: peErr } = await supabaseAdmin.from('profiles').delete().ilike('email', cleanEmail)
      const { error: invErr } = await supabaseAdmin.from('invites').delete().ilike('email', cleanEmail)
      stepResults.push({ step: 'delete_profile_by_email', error: peErr?.message || null })
      stepResults.push({ step: 'delete_invites', error: invErr?.message || null })
    }

    // 4. Remove user record from users table
    for (const id of idsList) {
      const { error: uErr } = await supabaseAdmin.from('users').delete().eq('id', id)
      stepResults.push({ step: 'delete_user_by_id', id, error: uErr?.message || null })
    }
    if (cleanEmail) {
      const { error: ueErr } = await supabaseAdmin.from('users').delete().ilike('email', cleanEmail)
      stepResults.push({ step: 'delete_user_by_email', error: ueErr?.message || null })
    }

    // 5. Delete authentication account from Supabase Auth
    let authDeleted = false
    let authError = null
    if (serviceKey) {
      for (const id of idsList) {
        try {
          const { error: aErr } = await supabaseAdmin.auth.admin.deleteUser(id)
          if (aErr) authError = aErr.message
          else authDeleted = true
        } catch (authErr) {
          authError = authErr.message
        }
      }
    } else {
      authError = 'No SUPABASE_SERVICE_ROLE_KEY configured in serverless environment'
    }

    return res.status(200).json({
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
