import { supabase } from './supabase'

function notifySprintChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sprintos:sprints-updated'))
    window.dispatchEvent(new CustomEvent('sprintos:data-sync'))
  }
}

export function subscribeSprints(workspaceId, teamIdOrCallback, maybeCallback) {
  if (!workspaceId) {
    const cb = typeof teamIdOrCallback === 'function' ? teamIdOrCallback : (typeof maybeCallback === 'function' ? maybeCallback : null)
    if (cb) cb([])
    return () => {}
  }
  const callback = typeof teamIdOrCallback === 'function' ? teamIdOrCallback : (typeof maybeCallback === 'function' ? maybeCallback : () => {})

  let isSubscribed = true
  let isFetching = false

  const fetchList = async () => {
    if (!isSubscribed || isFetching) return
    isFetching = true
    try {
      const { data, error } = await supabase
        .from('sprints')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('number', { ascending: false })
      if (!error && isSubscribed) {
        if (typeof callback === 'function') callback(data || [])
      }
    } finally {
      isFetching = false
    }
  }

  fetchList()

  const channel = supabase.channel(`public:sprints:workspace_id=eq.${workspaceId}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sprints', filter: `workspace_id=eq.${workspaceId}` }, payload => {
       fetchList()
    })
    .subscribe()

  const onLocalSync = () => fetchList()
  const onStorageSync = (e) => {
    if (e?.key?.startsWith('sprintos:')) {
      fetchList()
    }
  }
  const onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') fetchList()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('sprintos:sprints-updated', onLocalSync)
    window.addEventListener('sprintos:data-sync', onLocalSync)
    window.addEventListener('storage', onStorageSync)
    window.addEventListener('focus', onVisibilityChange)
    window.addEventListener('online', onVisibilityChange)
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  const heartbeat = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      fetchList()
    }
  }, 3000)

  return () => {
    isSubscribed = false
    supabase.removeChannel(channel)
    clearInterval(heartbeat)
    if (typeof window !== 'undefined') {
      window.removeEventListener('sprintos:sprints-updated', onLocalSync)
      window.removeEventListener('sprintos:data-sync', onLocalSync)
      window.removeEventListener('storage', onStorageSync)
      window.removeEventListener('focus', onVisibilityChange)
      window.removeEventListener('online', onVisibilityChange)
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }
}

async function callSprintApi(action, payload) {
  const res = await fetch('/api/sprints', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Sprint action failed')
  return json
}

export async function createSprint(workspaceId, teamId, { number, goal, startDate, endDate, status = 'active' }) {
  const sprintPayload = {
    number,
    goal: goal || '',
    startDate,
    endDate,
    status: status || 'active',
  }
  const res = await callSprintApi('create_sprint', {
    workspaceId,
    teamId,
    sprintData: sprintPayload
  })
  notifySprintChange()
  return res.data
}

export async function updateSprint(workspaceId, id, patch) {
  await callSprintApi('update_sprint', { workspaceId, id, patch })
  notifySprintChange()
}

export async function deleteSprint(workspaceId, id) {
  await callSprintApi('delete_sprint', { workspaceId, id })
  notifySprintChange()
}

export async function setActiveSprint(workspaceId, teamId, sprintId) {
  await callSprintApi('set_active_sprint', { workspaceId, id: sprintId, sprintId })
  notifySprintChange()
}

export async function lockSprint(workspaceId, id) {
  await callSprintApi('lock_sprint', { workspaceId, id })
  notifySprintChange()
}

export async function unlockSprint(workspaceId, id) {
  await callSprintApi('unlock_sprint', { workspaceId, id })
  notifySprintChange()
}

export async function closeSprint(workspaceId, id) {
  await callSprintApi('close_sprint', { workspaceId, id })
  notifySprintChange()
}

export async function reopenSprint(workspaceId, id) {
  await callSprintApi('reopen_sprint', { workspaceId, id })
  notifySprintChange()
}
