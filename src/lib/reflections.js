import { supabase } from './supabase'

function reflectionId(sprintId, uid) {
  return `${sprintId}_${uid}`
}

export function subscribeReflections(workspaceId, teamId, sprintId, callback) {
  let isSubscribed = true

  const fetchList = async () => {
    if (!isSubscribed) return
    const { data } = await supabase
      .from('reflections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('sprintId', sprintId)
    if (data && isSubscribed) callback(data)
  }

  fetchList()

  const channel = supabase.channel(`public:reflections:workspace_id=eq.${workspaceId}:sprintId=eq.${sprintId}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reflections', filter: `workspace_id=eq.${workspaceId}` }, () => {
      fetchList()
    })
    .subscribe()

  const onLocalSync = () => fetchList()
  const onStorageSync = (e) => {
    if (e?.key?.startsWith('sprintos:')) fetchList()
  }
  const onVisibilityOrFocus = () => {
    if (typeof document !== 'undefined' && !document.hidden) fetchList()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('sprintos:data-sync', onLocalSync)
    window.addEventListener('storage', onStorageSync)
    window.addEventListener('focus', onVisibilityOrFocus)
    window.addEventListener('online', onVisibilityOrFocus)
    document.addEventListener('visibilitychange', onVisibilityOrFocus)
  }

  const heartbeat = setInterval(() => {
    if (typeof document !== 'undefined' && !document.hidden) fetchList()
  }, 3000)

  return () => {
    isSubscribed = false
    supabase.removeChannel(channel)
    clearInterval(heartbeat)
    if (typeof window !== 'undefined') {
      window.removeEventListener('sprintos:data-sync', onLocalSync)
      window.removeEventListener('storage', onStorageSync)
      window.removeEventListener('focus', onVisibilityOrFocus)
      window.removeEventListener('online', onVisibilityOrFocus)
      document.removeEventListener('visibilitychange', onVisibilityOrFocus)
    }
  }
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
