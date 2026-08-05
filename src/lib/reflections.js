import { supabase } from './supabase'

function reflectionId(sprintId, uid) {
  return `${sprintId}_${uid}`
}

export function subscribeReflections(workspaceId, teamId, sprintId, callback) {
  const fetchList = async () => {
    const { data } = await supabase
      .from('reflections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('sprintId', sprintId)
    if (data) callback(data)
  }
  fetchList()
  const channel = supabase.channel(`public:reflections:workspace_id=eq.${workspaceId}:sprintId=eq.${sprintId}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reflections', filter: `workspace_id=eq.${workspaceId}` }, () => {
      fetchList()
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}

export async function submitReflection(workspaceId, teamId, sprintId, {
  memberId, memberEmail, memberName, completedTasks, whyNot, biggestBlocker, improvement,
}) {
  const id = reflectionId(sprintId, memberId)
  await supabase
    .from('reflections')
    .upsert({
      workspace_id: workspaceId,
      id,
      teamId,
      sprintId,
      memberId,
      memberEmail: (memberEmail || '').toLowerCase(),
      memberName,
      completedTasks,
      whyNot: whyNot || '',
      biggestBlocker: biggestBlocker || '',
      improvement: improvement || '',
      submittedAt: new Date().toISOString()
    })
}
