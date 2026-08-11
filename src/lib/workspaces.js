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
  const fetchDoc = async () => {
    const data = await getWorkspace(workspaceId)
    callback(data)
  }
  const channel = supabase.channel(`public:workspaces:id=eq.${workspaceId}:fetch:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces', filter: `id=eq.${workspaceId}` }, payload => {
       fetchDoc()
    })
    .subscribe()
  fetchDoc()
  return () => supabase.removeChannel(channel)
}

export function subscribeUserWorkspaces(uid, callback) {
  if (!uid) return () => {}
  const fetchList = async () => {
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
        callback([])
        return
      }
      
      const mapped = (data || []).map(row => ({
        workspaceId: row.workspace_id,
        id: row.workspace_id,
        role: row.role,
        name: row.workspaces?.name
      }))
      callback(mapped)
    } catch (err) {
      console.error('subscribeUserWorkspaces Exception:', err)
      callback([])
    }
  }
  
  const channel = supabase.channel(`public:workspace_members:user_id=eq.${uid}:workspaces:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members', filter: `user_id=eq.${uid}` }, payload => {
       fetchList()
    })
    .subscribe()
  fetchList()
  return () => supabase.removeChannel(channel)
}

export function subscribeWorkspaceMembers(workspaceId, callback) {
  const fetchList = async () => {
    const { data, error } = await supabase
      .from('workspace_members')
      .select(`
        user_id,
        role,
        joined_at,
        users ( email, full_name, avatar_url )
      `)
      .eq('workspace_id', workspaceId)
      
    if (error) {
      callback([])
      return
    }
    
    const mapped = data.map(row => ({
      id: row.user_id,
      email: row.users?.email,
      fullName: row.users?.full_name,
      avatarUrl: row.users?.avatar_url,
      role: row.role,
      joinedAt: row.joined_at
    }))
    callback(mapped)
  }
  const channel = supabase.channel(`public:workspace_members:workspace_id=eq.${workspaceId}:workspaces:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${workspaceId}` }, payload => {
       fetchList()
    })
    .subscribe()
  fetchList()
  return () => supabase.removeChannel(channel)
}

export function subscribeInvites(workspaceId, callback) {
  const fetchList = async () => {
    const { data, error } = await supabase
      .from('invites')
      .select('*')
      .eq('workspace_id', workspaceId)
    if (!error) callback(data || [])
  }
  const channel = supabase.channel(`public:invites:workspace_id=eq.${workspaceId}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'invites', filter: `workspace_id=eq.${workspaceId}` }, payload => {
       fetchList()
    })
    .subscribe()
  fetchList()
  return () => supabase.removeChannel(channel)
}

export async function createWorkspace(uid, email, name, teamSize = '2-5', agileWorkflow = 'scrum', saveData = true) {
  const { data: authData } = await supabase.auth.getUser()
  const creatorId = uid || authData?.user?.id
  if (!creatorId) {
    throw new Error('User authentication session expired. Please log in again.')
  }

  const newWorkspaceId = crypto.randomUUID()

  const { error } = await supabase.rpc('create_new_workspace', {
    workspace_name: name,
    creator_id: creatorId,
    new_workspace_id: newWorkspaceId
  })
  
  if (error) {
    console.error('RPC Error:', error)
    throw error
  }

  // Update workspace settings with team_size, agile_workflow, and save_data preference
  try {
    await supabase.from('workspaces').update({
      settings: {
        team_size: teamSize,
        agile_workflow: agileWorkflow,
        save_data: saveData,
        configured_by: creatorId,
        configured_at: new Date().toISOString()
      }
    }).eq('id', newWorkspaceId)
  } catch (err) {
    console.error('Failed to update workspace workflow settings:', err)
  }

  return newWorkspaceId
}

export async function updateWorkspaceSettings(workspaceId, patch) {
  let mappedPatch = { ...patch }
  if (mappedPatch.billing) {
    mappedPatch.billing_plan_id = mappedPatch.billing.planId
    mappedPatch.billing_status = mappedPatch.billing.status
    delete mappedPatch.billing
  }
  
  const { error } = await supabase.from('workspaces').update(mappedPatch).eq('id', workspaceId)
  if (error) throw error
}

export async function removeMember(workspaceId, memberUid) {
  const { error } = await supabase.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', memberUid)
  if (error) throw error
}

export async function changeMemberRole(workspaceId, memberUid, newRole) {
  const { error } = await supabase.from('workspace_members').update({ role: newRole }).eq('workspace_id', workspaceId).eq('user_id', memberUid)
  if (error) throw error
}

export async function cancelInvite(workspaceId, inviteId) {
  const { error } = await supabase.from('invites').delete().eq('workspace_id', workspaceId).eq('id', inviteId)
  if (error) throw error
}

export async function createInvite(workspaceId, email, role, permissions = [], password, sendEmail = false) {
  try {
    const { data, error } = await supabase.functions.invoke('create-invite', {
      body: { workspaceId, email, role, permissions, password, sendEmail }
    })
    if (!error && !data?.error) {
      return data
    }
    if (data?.error) {
      console.warn('Edge function create-invite reported error:', data.error)
    }
  } catch (edgeErr) {
    console.warn('Edge function create-invite invoke exception:', edgeErr)
  }

  // Fallback: Create invite directly in database table if edge function is unconfigured/fails
  const { data: authData } = await supabase.auth.getUser()
  const inviterId = authData?.user?.id

  const { error: dbErr } = await supabase.from('invites').insert({
    workspace_id: workspaceId,
    email: email.trim().toLowerCase(),
    role,
    permissions,
    invited_by: inviterId,
    password_hint: password || null,
    created_at: new Date().toISOString()
  })

  if (dbErr) {
    if (dbErr.code === '23505') {
      throw new Error('An invitation for this email is already pending in this workspace.')
    }
    throw new Error(dbErr.message || 'Unable to dispatch invitation. Please try again.')
  }
}

export async function updateMemberPermissions(workspaceId, userId, permissions) {
  const { error } = await supabase.from('workspace_members').update({ permissions }).eq('workspace_id', workspaceId).eq('user_id', userId)
  if (error) throw error
}

export async function deleteWorkspace(workspaceId) {
  if (!workspaceId) throw new Error('Workspace ID is required.')

  // Clean up all child table records to prevent foreign key constraint violations
  await Promise.allSettled([
    supabase.from('workspace_members').delete().eq('workspace_id', workspaceId),
    supabase.from('deadlines').delete().eq('workspace_id', workspaceId),
    supabase.from('sprints').delete().eq('workspace_id', workspaceId),
    supabase.from('invites').delete().eq('workspace_id', workspaceId),
    supabase.from('meetings').delete().eq('workspace_id', workspaceId),
    supabase.from('audit_logs').delete().eq('workspace_id', workspaceId),
    supabase.from('integrations').delete().eq('workspace_id', workspaceId),
  ])

  // Delete the primary workspace record
  const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId)
  if (error) {
    const { error: rpcErr } = await supabase.rpc('delete_workspace', { workspace_id: workspaceId })
    if (rpcErr) throw error
  }
}
