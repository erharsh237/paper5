import { supabase } from './supabase'

export function subscribeSprints(workspaceId, teamId, callback) {
  const fetchList = async () => {
    const { data, error } = await supabase
      .from('sprints')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('number', { ascending: false })
    if (!error) callback(data || [])
  }
  const channel = supabase.channel(`public:sprints:workspace_id=eq.${workspaceId}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sprints', filter: `workspace_id=eq.${workspaceId}` }, payload => {
       fetchList()
    })
    .subscribe()
  fetchList()
  return () => supabase.removeChannel(channel)
}

export async function createSprint(workspaceId, teamId, { number, goal, startDate, endDate, createdBy, assigneeId, assigneeName }) {
  const { data, error } = await supabase.from('sprints').insert([{
    workspace_id: workspaceId,
    team_id: teamId,
    number,
    goal: goal || '',
    start_date: startDate,
    end_date: endDate,
    status: 'planning',
    locked: false,
    assignee_id: assigneeId || null,
    assignee_name: assigneeName || null,
    created_by: (createdBy || '').toLowerCase(),
    created_at: new Date().toISOString(),
  }]).select()
  if (error) throw error
  return data[0]
}

export async function updateSprint(workspaceId, id, patch) {
  const { error } = await supabase.from('sprints').update(patch).eq('id', id).eq('workspace_id', workspaceId)
  if (error) throw error
}

export async function deleteSprint(workspaceId, id) {
  const { error } = await supabase.from('sprints').delete().eq('id', id).eq('workspace_id', workspaceId)
  if (error) throw error
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
}

export async function lockSprint(workspaceId, id) {
  const { error } = await supabase.from('sprints').update({ locked: true }).eq('id', id).eq('workspace_id', workspaceId)
  if (error) throw error
}

export async function unlockSprint(workspaceId, id) {
  const { error } = await supabase.from('sprints').update({ locked: false }).eq('id', id).eq('workspace_id', workspaceId)
  if (error) throw error
}
