import { supabase } from './supabase'

export function subscribeRoles(workspaceId, callback) {
  const fetchList = async () => {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('createdAt', { ascending: true })
    if (!error) callback(data || [])
  }
  const channel = supabase.channel(`public:roles:workspace_id=eq.${workspaceId}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'roles', filter: `workspace_id=eq.${workspaceId}` }, payload => {
       fetchList()
    })
    .subscribe()
  fetchList()
  return () => supabase.removeChannel(channel)
}

export async function createRole(workspaceId, id, name, permissions) {
  const { error } = await supabase.from('roles').insert([{
    id,
    workspace_id: workspaceId,
    name,
    permissions
  }])
  if (error) throw error
}

export async function updateRole(workspaceId, id, name, permissions) {
  const { error } = await supabase.from('roles').update({ name, permissions }).eq('workspace_id', workspaceId).eq('id', id)
  if (error) throw error
}

export async function deleteRole(workspaceId, id) {
  const { error } = await supabase.from('roles').delete().eq('workspace_id', workspaceId).eq('id', id)
  if (error) throw error
}

export function subscribeUserRoles(workspaceId, callback) {
  const fetchList = async () => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('workspace_id', workspaceId)
    if (!error) callback(data || [])
  }
  const channel = supabase.channel(`public:user_roles:workspace_id=eq.${workspaceId}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles', filter: `workspace_id=eq.${workspaceId}` }, payload => {
       fetchList()
    })
    .subscribe()
  fetchList()
  return () => supabase.removeChannel(channel)
}

export async function assignUserRole(workspaceId, userId, roleId) {
  const { error } = await supabase.from('user_roles').insert([{
    workspace_id: workspaceId,
    user_id: userId,
    role_id: roleId
  }])
  if (error) throw error
}

export async function removeUserRole(workspaceId, userId, roleId) {
  const { error } = await supabase.from('user_roles').delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('role_id', roleId)
  if (error) throw error
}
