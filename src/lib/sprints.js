import { supabase } from './supabase'

function notifySprintChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sprintos:sprints-updated'))
    window.dispatchEvent(new CustomEvent('sprintos:data-sync'))
  }
}

export function subscribeSprints(workspaceId, teamId, callback) {
  let isSubscribed = true

  const fetchList = async () => {
    if (!isSubscribed || !workspaceId) return
    const { data, error } = await supabase
      .from('sprints')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('number', { ascending: false })
    if (!error && isSubscribed) callback(data || [])
  }

  fetchList()

  const channel = supabase.channel(`public:sprints:workspace_id=eq.${workspaceId}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sprints', filter: `workspace_id=eq.${workspaceId}` }, payload => {
       fetchList()
    })
    .subscribe()

  const onLocalSync = () => fetchList()
  if (typeof window !== 'undefined') {
    window.addEventListener('sprintos:sprints-updated', onLocalSync)
    window.addEventListener('sprintos:data-sync', onLocalSync)
    window.addEventListener('focus', onLocalSync)
  }
  const onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') fetchList()
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  // Periodic heartbeat sync (every 3 seconds when tab is active)
  const interval = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      fetchList()
    }
  }, 3000)

  return () => {
    isSubscribed = false
    supabase.removeChannel(channel)
    clearInterval(interval)
    if (typeof window !== 'undefined') {
      window.removeEventListener('sprintos:sprints-updated', onLocalSync)
      window.removeEventListener('sprintos:data-sync', onLocalSync)
      window.removeEventListener('focus', onLocalSync)
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }
}

export async function createSprint(workspaceId, teamId, { number, goal, startDate, endDate, status = 'active' }) {
  if (status === 'active') {
    await supabase.from('sprints')
      .update({ status: 'completed' })
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
  }

  const { data, error } = await supabase.from('sprints').insert([{
    workspace_id: workspaceId,
    team_id: teamId || null,
    number,
    goal: goal || '',
    start_date: startDate,
    end_date: endDate,
    status: status || 'active',
    created_at: new Date().toISOString(),
  }]).select()
  if (error) throw error
  notifySprintChange()
  return data[0]
}

export async function updateSprint(workspaceId, id, patch) {
  const { error } = await supabase.from('sprints').update(patch).eq('id', id).eq('workspace_id', workspaceId)
  if (error) throw error
  notifySprintChange()
}

export async function deleteSprint(workspaceId, id) {
  const { error } = await supabase.from('sprints').delete().eq('id', id).eq('workspace_id', workspaceId)
  if (error) throw error
  notifySprintChange()
}

export async function setActiveSprint(workspaceId, teamId, sprintId) {
  const { error: err1 } = await supabase.from('sprints')
    .update({ status: 'completed' })
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .neq('id', sprintId)
  if (err1) throw err1

  const { error: err2 } = await supabase.from('sprints')
    .update({ status: 'active' })
    .eq('id', sprintId)
    .eq('workspace_id', workspaceId)
  if (err2) throw err2
  notifySprintChange()
}

export async function lockSprint(workspaceId, id) {
  const { error } = await supabase.from('sprints').update({ locked: true }).eq('id', id).eq('workspace_id', workspaceId)
  if (error) throw error
  notifySprintChange()
}

export async function unlockSprint(workspaceId, id) {
  const { error } = await supabase.from('sprints').update({ locked: false }).eq('id', id).eq('workspace_id', workspaceId)
  if (error) throw error
  notifySprintChange()
}

export async function closeSprint(workspaceId, id) {
  const { error } = await supabase.from('sprints')
    .update({ status: 'completed' })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
  if (error) throw error
  notifySprintChange()
}

export async function reopenSprint(workspaceId, id) {
  return setActiveSprint(workspaceId, undefined, id)
}
