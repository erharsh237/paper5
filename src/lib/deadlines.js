import { supabase } from './supabase'

export const DEADLINES_DEFAULT_PAGE_SIZE = 100

export const SPRINT_LOCKED_FIELDS = [
  'assigneeId', 'assigneeName', 'assigneeEmail',
  'dueDate', 'estimatedHours', 'sprintId', 'title', 'priority',
]

export function isSprintLockViolation(patch) {
  return Object.keys(patch).some(k => SPRINT_LOCKED_FIELDS.includes(k))
}

function notifyDeadlineChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sprintos:deadlines-updated'))
    window.dispatchEvent(new CustomEvent('sprintos:data-sync'))
    try {
      localStorage.setItem('sprintos:sync_deadlines', Date.now().toString())
    } catch (_) {}
  }
}

export function subscribeDeadlines(workspaceId, teamIdOrCallback, callbackOrPageSize, maybePageSize) {
  if (!workspaceId) {
    const cb = typeof teamIdOrCallback === 'function' ? teamIdOrCallback : (typeof callbackOrPageSize === 'function' ? callbackOrPageSize : null)
    if (cb) cb([])
    return () => {}
  }
  const callback = typeof teamIdOrCallback === 'function' ? teamIdOrCallback : (typeof callbackOrPageSize === 'function' ? callbackOrPageSize : () => {})
  const pageSize = typeof callbackOrPageSize === 'number' ? callbackOrPageSize : (typeof maybePageSize === 'number' ? maybePageSize : 100)

  let isSubscribed = true
  let isFetching = false

  const fetchList = async () => {
    if (!isSubscribed || isFetching) return
    isFetching = true
    try {
      const { data, error } = await supabase
        .from('deadlines')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('due_date', { ascending: true })
        .limit(pageSize)
      if (!error && isSubscribed) {
        const normalized = (data || []).map(row => ({
          ...row,
          dueDate: row.due_date || row.dueDate,
          dueDateIso: row.due_date || row.dueDate,
          assigneeId: row.assignee_id || row.assigneeId,
          assigneeName: row.assignee_name || row.assigneeName,
          assigneeEmail: (row.assignee_email || row.assigneeEmail || '').toLowerCase(),
          createdBy: row.created_by || row.createdBy || '',
          createdByName: row.created_by_name || row.createdByName || row.created_by || row.createdBy || 'Team Lead',
          sprintId: row.sprint_id || row.sprintId,
          createdAt: row.created_at || row.createdAt,
          completedAt: row.completed_at || row.completedAt,
          estimatedHours: row.estimated_hours ?? row.estimatedHours ?? null,
          actualHours: row.actual_hours ?? row.actualHours ?? 0,
          percentComplete: row.percent_complete ?? row.percentComplete ?? 0,
          requiredEvidence: row.required_evidence || row.requiredEvidence || [],
          definitionOfDone: row.definition_of_done || row.definitionOfDone || '',
        }))
        if (typeof callback === 'function') callback(normalized)
      }
    } finally {
      isFetching = false
    }
  }

  fetchList()

  const channel = supabase.channel(`public:deadlines:ws:${workspaceId}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'deadlines' }, () => {
       fetchList()
    })
    .subscribe()

  const onLocalSync = () => fetchList()
  const onStorageSync = (e) => {
    if (e.key === 'sprintos:sync_deadlines' || e.key === 'sprintos:sync_notifications') {
      fetchList()
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('sprintos:deadlines-updated', onLocalSync)
    window.addEventListener('sprintos:notifications-updated', onLocalSync)
    window.addEventListener('sprintos:data-sync', onLocalSync)
    window.addEventListener('storage', onStorageSync)
  }
  const onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') fetchList()
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
      window.removeEventListener('sprintos:deadlines-updated', onLocalSync)
      window.removeEventListener('sprintos:notifications-updated', onLocalSync)
      window.removeEventListener('sprintos:data-sync', onLocalSync)
      window.removeEventListener('storage', onStorageSync)
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }
}

async function callDeadlineApi(action, payload) {
  const res = await fetch('/api/deadlines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Deadline action failed')
  return json
}

export async function createDeadline(workspaceId, teamId, data) {
  const res = await callDeadlineApi('create_deadline', {
    workspaceId,
    teamId,
    deadlineData: data
  })
  notifyDeadlineChange()
  return res.data
}

export async function claimDeadline(workspaceId, id, user) {
  const res = await callDeadlineApi('claim_deadline', { workspaceId, id, user })
  notifyDeadlineChange()
  return res.data
}

export async function updateDeadline(workspaceId, id, patch) {
  await callDeadlineApi('update_deadline', { workspaceId, id, patch })
  notifyDeadlineChange()
}

export async function updateDeadlineStatus(workspaceId, id, status) {
  await callDeadlineApi('update_status', { workspaceId, id, status })
  notifyDeadlineChange()
}

export async function addExtraWork(workspaceId, deadlineId, { note, addedBy, addedByName }) {
  const res = await callDeadlineApi('add_extra_work', {
    workspaceId,
    id: deadlineId,
    extraWorkData: { note, addedBy, addedByName }
  })
  notifyDeadlineChange()
  return res.data
}

export function subscribeExtraWork(workspaceId, deadlineId, callback) {
  let isSubscribed = true
  const fetchList = async () => {
    if (!isSubscribed) return
    const { data, error } = await supabase
      .from('extra_work')
      .select('*')
      .eq('deadline_id', deadlineId)
      .order('added_at', { ascending: true })
    if (!error && isSubscribed) callback(data || [])
  }
  const channel = supabase.channel(`public:extra_work:deadline_id=eq.${deadlineId}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'extra_work', filter: `deadline_id=eq.${deadlineId}` }, payload => {
       fetchList()
    })
    .subscribe()
  fetchList()
  return () => {
    isSubscribed = false
    supabase.removeChannel(channel)
  }
}

export async function submitForReview(workspaceId, id, { evidenceType, evidenceContent, repoName, submittedBy }) {
  try {
    await supabase.from('evidence').insert([{
      workspace_id: workspaceId,
      deadline_id: id,
      type: evidenceType,
      content: evidenceContent,
      repo_name: repoName || null,
      submitted_by: (submittedBy || '').toLowerCase(),
      submitted_at: new Date().toISOString(),
    }])
  } catch (_) {}
  await updateDeadlineStatus(workspaceId, id, 'review')
  notifyDeadlineChange()
}

export function subscribeEvidence(workspaceId, deadlineId, callback) {
  const fetchList = async () => {
    const { data, error } = await supabase
      .from('evidence')
      .select('*')
      .eq('deadline_id', deadlineId)
      .order('submitted_at', { ascending: true })
    if (!error) callback(data || [])
  }
  const channel = supabase.channel(`public:evidence:deadline_id=eq.${deadlineId}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'evidence', filter: `deadline_id=eq.${deadlineId}` }, payload => {
       fetchList()
    })
    .subscribe()
  fetchList()
  return () => supabase.removeChannel(channel)
}

export async function approveReview(workspaceId, id, { reviewerEmail, reviewerName, reviewNote }) {
  await callDeadlineApi('approve_review', {
    workspaceId,
    id,
    reviewData: { reviewerEmail, reviewerName, reviewNote }
  })
  notifyDeadlineChange()
}

export async function rejectReview(workspaceId, id, { reviewerEmail, reviewerName, reviewNote }) {
  await callDeadlineApi('reject_review', {
    workspaceId,
    id,
    reviewData: { reviewerEmail, reviewerName, reviewNote }
  })
  notifyDeadlineChange()
}

export async function setBlocked(workspaceId, id, { category, reason, needHelpFrom, description }) {
  const blockerInfo = {
    category: category || 'unknown',
    reason,
    needHelpFrom: needHelpFrom || '',
    description: description || '',
    blockedAt: new Date().toISOString(),
  }
  await callDeadlineApi('set_blocked', { workspaceId, id, blockerInfo })
  notifyDeadlineChange()
}

export async function clearBlocked(workspaceId, id, nextStatus = 'in_progress') {
  await callDeadlineApi('clear_blocked', { workspaceId, id, status: nextStatus })
  notifyDeadlineChange()
}

export async function deleteDeadline(workspaceId, id) {
  await callDeadlineApi('delete_deadline', { workspaceId, id })
  notifyDeadlineChange()
}

import { subscribeWorkspaceMembers } from './workspaces'

export function subscribeMembers(workspaceId, teamId, callback) {
  const cb = typeof teamId === 'function' ? teamId : callback
  return subscribeWorkspaceMembers(workspaceId, (members) => {
    if (typeof cb === 'function') cb(members)
  })
}

export async function addMember(workspaceId, teamId, { name, email, addedBy }) {
  throw new Error("addMember is deprecated. Use workspace invites instead.")
}

export async function removeMember(workspaceId, id) {
  const { error } = await supabase.from('workspace_members').delete().eq('user_id', id).eq('workspace_id', workspaceId)
  if (error) throw error
  notifyDeadlineChange()
}
