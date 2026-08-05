import { supabase } from '../supabase'

export function subscribeIntegrationConfig(workspaceId, callback) {
  const fetchList = async () => {
    const { data } = await supabase
      .from('integrationConfig')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', 'default')
      .maybeSingle()
    callback(data || {})
  }
  fetchList()
  const channel = supabase.channel(`public:integrationConfig:workspace_id=eq.${workspaceId}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'integrationConfig', filter: `workspace_id=eq.${workspaceId}` }, () => {
      fetchList()
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}

export async function saveIntegrationConfig(workspaceId, patch) {
  const { data: existing } = await supabase
    .from('integrationConfig')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', 'default')
    .maybeSingle()
    
  const updated = { ...(existing || {}), ...patch }
  
  await supabase
    .from('integrationConfig')
    .upsert({ 
      workspace_id: workspaceId, 
      id: 'default', 
      ...updated 
    })
}

export function subscribeIntegrationCredentials(workspaceId, uid, callback) {
  if (!uid) return () => {}
  const fetchList = async () => {
    const { data } = await supabase
      .from('integrationCredentials')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', uid)
      .maybeSingle()
    callback(data || {})
  }
  fetchList()
  const channel = supabase.channel(`public:integrationCredentials:workspace_id=eq.${workspaceId}:id=eq.${uid}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'integrationCredentials', filter: `workspace_id=eq.${workspaceId}` }, () => {
      fetchList()
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}

export async function saveIntegrationCredentials(workspaceId, uid, patch) {
  const { data: existing } = await supabase
    .from('integrationCredentials')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', uid)
    .maybeSingle()
    
  const updated = { ...(existing || {}), ...patch }
  
  await supabase
    .from('integrationCredentials')
    .upsert({ 
      workspace_id: workspaceId, 
      id: uid, 
      ...updated 
    })
}
