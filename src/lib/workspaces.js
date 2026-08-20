import { supabase } from './supabase'

export async function logAudit(workspaceId, action, resource, metadata = {}) {
  try {
    const { data: ws } = await supabase.from('workspaces').select('settings').eq('id', workspaceId).maybeSingle();
    if (ws && ws.settings && ws.settings.strict_auditing) {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id) {
        await supabase.from('audit_logs').insert({
          workspace_id: workspaceId,
          actor_id: authData.user.id,
          action,
          resource,
          metadata,
          created_at: new Date().toISOString()
        });
      }
    }
  } catch (err) {
    console.error('Audit Log Error:', err);
  }
}

export async function getWorkspace(workspaceId) {
  const { data, error } = await supabase.from('workspaces').select('*').eq('id', workspaceId).maybeSingle()
  if (error || !data) return null
  
  // Map flat postgres columns to nested objects for compatibility
  const mapped = { ...data }
  if (mapped.billing_plan_id !== undefined || mapped.billing_status !== undefined) {
    mapped.billing = {
      planId: mapped.billing_plan_id || 'free',
      status: mapped.billing_status || 'active'
    }
  }
  
  return mapped
}

export function subscribeWorkspace(workspaceId, callback) {
  let isSubscribed = true
  let isFetching = false
  const fetchDoc = async () => {
    if (!isSubscribed || !workspaceId || isFetching) return
    isFetching = true
    try {
      const data = await getWorkspace(workspaceId)
      if (isSubscribed) callback(data)
    } finally {
      isFetching = false
    }
  }
  const channel = supabase.channel(`public:workspaces:id=eq.${workspaceId}:fetch:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces', filter: `id=eq.${workspaceId}` }, () => {
       fetchDoc()
    })
    .subscribe()
  fetchDoc()

  const onLocalSync = () => fetchDoc()
  if (typeof window !== 'undefined') {
    window.addEventListener('sprintos:data-sync', onLocalSync)
  }
  const onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') fetchDoc()
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  return () => {
    isSubscribed = false
    supabase.removeChannel(channel)
    if (typeof window !== 'undefined') {
      window.removeEventListener('sprintos:data-sync', onLocalSync)
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }
}

export function subscribeUserWorkspaces(uid, callback) {
  if (!uid) return () => {}
  let isSubscribed = true
  let isFetching = false
  const fetchList = async () => {
    if (!isSubscribed || isFetching) return
    isFetching = true
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select(`
          role,
          workspace_id,
          workspaces ( name )
        `)
        .eq('user_id', uid)
      
      if (error || !data) {
        if (error) console.error('subscribeUserWorkspaces Error:', error)
        if (isSubscribed) callback([])
        return
      }
      
      const mapped = (data || []).map(row => ({
        workspaceId: row.workspace_id,
        id: row.workspace_id,
        role: row.role,
        name: row.workspaces?.name
      }))
      if (isSubscribed) callback(mapped)
    } catch (err) {
      console.error('subscribeUserWorkspaces Exception:', err)
      if (isSubscribed) callback([])
    } finally {
      isFetching = false
    }
  }
  
  const channel = supabase.channel(`public:workspace_members:user_id=eq.${uid}:workspaces:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members', filter: `user_id=eq.${uid}` }, () => {
       fetchList()
    })
    .subscribe()
  fetchList()

  const onLocalSync = () => fetchList()
  if (typeof window !== 'undefined') {
    window.addEventListener('sprintos:data-sync', onLocalSync)
  }
  const onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') fetchList()
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  return () => {
    isSubscribed = false
    supabase.removeChannel(channel)
    if (typeof window !== 'undefined') {
      window.removeEventListener('sprintos:data-sync', onLocalSync)
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }
}

export function subscribeWorkspaceMembers(workspaceId, callback) {
  if (!workspaceId) {
    if (typeof callback === 'function') callback([])
    return () => {}
  }

  let isSubscribed = true
  let isFetching = false
  let abortController = null

  const fetchList = async () => {
    if (!isSubscribed || isFetching) return
    if (typeof document !== 'undefined' && document.hidden) return

    isFetching = true
    try {
      if (abortController) abortController.abort()
      abortController = new AbortController()

      // 1. Try serverless API first (uses service role key to get real emails, full names, and permissions)
      try {
        const res = await fetch(`/api/workspace-members?workspaceId=${encodeURIComponent(workspaceId)}`, {
          signal: abortController.signal
        })
        if (res.ok) {
          const json = await res.json()
          if (isSubscribed && json?.members && Array.isArray(json.members)) {
            callback(json.members)
            isFetching = false
            return
          }
        }
      } catch (_) {
        // Ignored on suspension/abort
      }

      // 2. Direct client query fallback
      try {
        const [{ data, error }, { data: wsData }] = await Promise.all([
          supabase
            .from('workspace_members')
            .select(`
              user_id,
              role,
              joined_at,
              users ( id, email, full_name, avatar_url )
            `)
            .eq('workspace_id', workspaceId),
          supabase
            .from('workspaces')
            .select('settings')
            .eq('id', workspaceId)
            .maybeSingle()
        ])

        const memberPermsMap = wsData?.settings?.member_permissions || {}

        if (!error && data && isSubscribed) {
          const mapped = data.map(row => {
            const usersJoin = row.users
            const email = usersJoin?.email || null
            const fullName = usersJoin?.full_name || null
            const perms = memberPermsMap[row.user_id] || (Array.isArray(row.permissions) ? row.permissions : [])
            return {
              id: row.user_id,
              userId: row.user_id,
              email,
              displayLabel: email || fullName || ('Member (' + (row.user_id || '').slice(0, 6) + ')'),
              fullName,
              avatarUrl: usersJoin?.avatar_url || null,
              role: row.role || 'member',
              permissions: Array.isArray(perms) ? perms : [],
              joinedAt: row.joined_at
            }
          })
          callback(mapped)
        }
      } catch (_) {}
    } finally {
      isFetching = false
    }
  }

  let channel = null
  try {
    channel = supabase.channel(`public:workspace_members:workspace_id=eq.${workspaceId}:wm:${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${workspaceId}` }, () => fetchList())
      .subscribe()
  } catch (_) {}
  
  fetchList()

  // Fetch immediately upon tab focus / device wake
  const handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && !document.hidden && isSubscribed) {
      fetchList()
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleVisibilityChange)
  }

  return () => {
    isSubscribed = false
    if (abortController) abortController.abort()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleVisibilityChange)
    }
    if (channel) {
      try { supabase.removeChannel(channel) } catch (_) {}
    }
  }
}

export function subscribeInvites(workspaceId, callback) {
  if (!workspaceId) {
    if (typeof callback === 'function') callback([])
    return () => {}
  }

  let isSubscribed = true
  let isFetching = false

  const fetchList = async () => {
    if (!isSubscribed || isFetching) return
    if (typeof document !== 'undefined' && document.hidden) return

    isFetching = true
    try {
      const { data, error } = await supabase
        .from('invites')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })

      if (!error && isSubscribed && Array.isArray(data)) {
        callback(data)
      }
    } catch (_) {
      // Gracefully ignore suspended network IO
    } finally {
      isFetching = false
    }
  }

  let channel = null
  try {
    channel = supabase.channel(`public:invites:workspace_id=eq.${workspaceId}:${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invites', filter: `workspace_id=eq.${workspaceId}` }, () => {
        if (isSubscribed) fetchList()
      })
      .subscribe()
  } catch (_) {}

  fetchList()

  // Fetch immediately upon tab focus / device wake
  const handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && !document.hidden && isSubscribed) {
      fetchList()
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleVisibilityChange)
  }

  return () => {
    isSubscribed = false
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleVisibilityChange)
    }
    if (channel) {
      try { supabase.removeChannel(channel) } catch (_) {}
    }
  }
}

export async function createWorkspace(uid, email, name) {
  const newWorkspaceId = crypto.randomUUID()

  const { error } = await supabase.rpc('create_new_workspace', {
    workspace_name: name,
    creator_id: uid,
    new_workspace_id: newWorkspaceId
  })
  
  if (error) {
    console.error('RPC Error:', error)
    throw error
  }

  return newWorkspaceId
}

export async function updateWorkspaceSettings(workspaceId, patch) {
  const mappedPatch = {}
  
  if (patch.name !== undefined) mappedPatch.name = patch.name
  if (patch.settings !== undefined) mappedPatch.settings = patch.settings
  if (patch.subscription_tier !== undefined) mappedPatch.subscription_tier = patch.subscription_tier
  if (patch.billing_plan_id !== undefined) mappedPatch.billing_plan_id = patch.billing_plan_id
  if (patch.billing_status !== undefined) mappedPatch.billing_status = patch.billing_status
  
  if (patch.billing !== undefined) {
    if (patch.billing.planId !== undefined) mappedPatch.billing_plan_id = patch.billing.planId
    if (patch.billing.status !== undefined) mappedPatch.billing_status = patch.billing.status
  }
  
  try {
    const { error } = await supabase.from('workspaces').update(mappedPatch).eq('id', workspaceId)
    if (error) throw error
  } catch (err) {
    const res = await fetch('/api/workspace-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_workspace_settings',
        workspaceId,
        patch: mappedPatch
      })
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || err.message)
  }
}

export async function removeMember(workspaceId, memberUid) {
  try {
    const res = await fetch('/api/workspace-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'remove_member',
        workspaceId,
        memberId: memberUid
      })
    })
    if (res.ok) return
  } catch (_) {}

  const { error } = await supabase.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', memberUid)
  if (error) throw error
}

export async function changeMemberRole(workspaceId, memberUid, newRole) {
  try {
    const res = await fetch('/api/workspace-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_role', workspaceId, memberId: memberUid, role: newRole })
    })
    if (res.ok) return
  } catch (_) {}

  const { error } = await supabase.from('workspace_members').update({ role: newRole }).eq('workspace_id', workspaceId).eq('user_id', memberUid)
  if (error) throw error
}

export async function cancelInvite(workspaceId, inviteId, email = null) {
  const cleanEmail = email ? email.trim().toLowerCase() : null

  // 1. Delete from database invites table
  if (inviteId) {
    await supabase.from('invites').delete().eq('id', inviteId)
  }
  if (cleanEmail && workspaceId) {
    await supabase.from('invites').delete().eq('workspace_id', workspaceId).eq('email', cleanEmail)
  }

  try {
    if (inviteId) await supabase.from('workspace_invites').delete().eq('id', inviteId)
    if (cleanEmail && workspaceId) await supabase.from('workspace_invites').delete().eq('workspace_id', workspaceId).eq('email', cleanEmail)
  } catch (e) {}

  // 2. Completely remove the pre-provisioned Auth account and temp credentials if user is not in any workspace
  if (cleanEmail) {
    try {
      await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, workspaceId, fullDelete: true })
      })
    } catch (err) {
      console.warn('Cancel invite cleanup notice:', err)
    }
  }
}

export async function createInvite(workspaceId, email, role, permissions = [], password, sendEmail = false) {
  const { data: authData } = await supabase.auth.getUser()
  const inviterId = authData?.user?.id
  const cleanEmail = email.trim().toLowerCase()

  // 1. Check if user is already an active workspace member
  const { data: existingMembers } = await supabase
    .from('workspace_members')
    .select('user_id, users(email)')
    .eq('workspace_id', workspaceId)

  const isAlreadyMember = (existingMembers || []).some(m => (m.users?.email || '').trim().toLowerCase() === cleanEmail)
  if (isAlreadyMember) {
    throw new Error(`${cleanEmail} is already an active member of this workspace.`)
  }

  try {
    await supabase.from('invites').delete().eq('workspace_id', workspaceId).eq('email', cleanEmail)
  } catch (e) {}

  const { error: dbErr, data: insertedData } = await supabase.from('invites').insert({
    workspace_id: workspaceId,
    email: cleanEmail,
    role,
    permissions,
    invited_by: inviterId,
    password_hint: password || null,
    sent_count: sendEmail ? 1 : 0,
    created_at: new Date().toISOString()
  }).select().single()

  if (dbErr) {
    console.error('Database invite insert error:', dbErr)
    throw new Error(dbErr.message || 'Failed to record invite in database')
  }

  let emailStatus = null
  if (sendEmail) {
    try {
      const emailResp = await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          workspaceId,
          role,
          permissions,
          password
        })
      })
      const emailJson = await emailResp.json()
      emailStatus = emailJson.emailStatus || (emailResp.ok ? 'sent' : 'failed')
    } catch (sendErr) {
      console.warn('Email dispatch warning (invite record still saved):', sendErr)
      emailStatus = 'failed'
    }
  }

  return { ...(insertedData || {}), success: true, emailStatus }
}

export async function updateMemberPermissions(workspaceId, userId, permissions, email = null) {
  const cleanPerms = Array.isArray(permissions) ? permissions : []
  const cleanEmail = email ? email.trim().toLowerCase() : null

  // 1. Direct client update on workspaces settings (instant RLS or authenticated user persistence)
  try {
    const { data: ws } = await supabase.from('workspaces').select('settings').eq('id', workspaceId).maybeSingle()
    if (ws?.settings) {
      const currentPermsMap = { ...(ws.settings.member_permissions || {}) }
      currentPermsMap[userId] = cleanPerms
      if (cleanEmail) currentPermsMap[cleanEmail] = cleanPerms
      await supabase.from('workspaces').update({
        settings: { ...ws.settings, member_permissions: currentPermsMap }
      }).eq('id', workspaceId)
    }
  } catch (clientErr) {
    console.warn('Direct client permissions update notice:', clientErr)
  }

  // 2. Serverless API update (runs as service admin to bypass RLS and persist)
  try {
    const res = await fetch('/api/workspace-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_permissions',
        workspaceId,
        memberId: userId,
        email: cleanEmail,
        permissions: cleanPerms
      })
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Failed to update permissions')

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sprintos:data-sync'))
    }
    return json
  } catch (err) {
    console.warn('updateMemberPermissions API error:', err.message)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sprintos:data-sync'))
    }
  }
}

export async function deleteWorkspace(workspaceId) {
  if (!workspaceId) throw new Error('Workspace ID is required.')

  await Promise.allSettled([
    supabase.from('workspace_members').delete().eq('workspace_id', workspaceId),
    supabase.from('deadlines').delete().eq('workspace_id', workspaceId),
    supabase.from('sprints').delete().eq('workspace_id', workspaceId),
    supabase.from('invites').delete().eq('workspace_id', workspaceId),
    supabase.from('meetings').delete().eq('workspace_id', workspaceId),
    supabase.from('audit_logs').delete().eq('workspace_id', workspaceId),
    supabase.from('integrations').delete().eq('workspace_id', workspaceId),
  ])

  const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId)
  if (error) {
    const { error: rpcErr } = await supabase.rpc('delete_workspace', { workspace_id: workspaceId })
    if (rpcErr) throw error
  }
}
