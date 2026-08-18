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
  }
}

export function subscribeDeadlines(workspaceId, teamId, callback, pageSize = DEADLINES_DEFAULT_PAGE_SIZE) {
  let isSubscribed = true

  const fetchList = async () => {
    if (!isSubscribed || !workspaceId) return
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
        sprintId: row.sprint_id || row.sprintId,
        createdAt: row.created_at || row.createdAt,
        completedAt: row.completed_at || row.completedAt,
        percentComplete: row.percent_complete ?? row.percentComplete ?? 0,
        requiredEvidence: row.required_evidence || row.requiredEvidence || [],
        definitionOfDone: row.definition_of_done || row.definitionOfDone || '',
      }))
      callback(normalized)
    }
  }

  fetchList()

  const channel = supabase.channel(`public:deadlines:workspace_id=eq.${workspaceId}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'deadlines', filter: `workspace_id=eq.${workspaceId}` }, payload => {
       fetchList()
    })
    .subscribe()

  const onLocalSync = () => fetchList()
  if (typeof window !== 'undefined') {
    window.addEventListener('sprintos:deadlines-updated', onLocalSync)
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
      window.removeEventListener('sprintos:deadlines-updated', onLocalSync)
      window.removeEventListener('sprintos:data-sync', onLocalSync)
      window.removeEventListener('focus', onLocalSync)
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }
}

export async function createDeadline(workspaceId, teamId, data) {
  const { data: result, error } = await supabase.from('deadlines').insert([{
    workspace_id: workspaceId,
    team_id: teamId,
    title: data.title,
    description: data.description || '',
    priority: data.priority || 'medium',
    status: data.status || 'not_started',
    due_date: data.dueDate,
    assignee_id: data.assigneeId,
    assignee_name: data.assigneeName,
    assignee_email: (data.assigneeEmail || '').toLowerCase(),
    created_by: data.createdBy || '',
    created_by_name: data.createdByName,
    created_at: new Date().toISOString(),
    percent_complete: 0,
    sprint_id: data.sprintId || null,
    estimated_hours: data.estimatedHours ?? null,
    actual_hours: data.actualHours ?? 0,
    dependencies: data.dependencies || [],
    labels: data.labels || [],
    definition_of_done: data.definitionOfDone || '',
    required_evidence: data.requiredEvidence || [],
  }]).select()
  if (error) throw error
  notifyDeadlineChange()
  return result[0]
}

export async function updateDeadline(workspaceId, id, patch) {
  const { error } = await supabase.from('deadlines').update(patch).eq('id', id).eq('workspace_id', workspaceId)
  if (error) throw error
  notifyDeadlineChange()
}

export async function updateDeadlineStatus(workspaceId, id, status) {
  const patch = { status }
  if (status === 'done') patch.percent_complete = 100
  if (status === 'not_started') patch.percent_complete = 0
  const { error } = await supabase.from('deadlines').update(patch).eq('id', id).eq('workspace_id', workspaceId)
  if (error) throw error
  notifyDeadlineChange()
}

export async function addExtraWork(workspaceId, deadlineId, { note, addedBy, addedByName }) {
  const { data, error } = await supabase.from('extra_work').insert([{
    workspace_id: workspaceId,
    deadline_id: deadlineId,
    note,
    added_by: addedBy,
    added_by_name: addedByName,
    added_at: new Date().toISOString(),
  }]).select()
  if (error) throw error
  notifyDeadlineChange()
  return data[0]
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
  await supabase.from('evidence').insert([{
    workspace_id: workspaceId,
    deadline_id: id,
    type: evidenceType,
    content: evidenceContent,
    repo_name: repoName || null,
    submitted_by: (submittedBy || '').toLowerCase(),
    submitted_at: new Date().toISOString(),
  }])
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
  const { error } = await supabase.from('deadlines').update({
    status: 'done',
    reviewer_email: (reviewerEmail || '').toLowerCase(),
    reviewer_name: reviewerName || '',
    review_note: reviewNote || '',
    percent_complete: 100,
  }).eq('id', id).eq('workspace_id', workspaceId)
  if (error) throw error
  notifyDeadlineChange()
}

export async function rejectReview(workspaceId, id, { reviewerEmail, reviewerName, reviewNote }) {
  const { error } = await supabase.from('deadlines').update({
    status: 'in_progress',
    reviewer_email: (reviewerEmail || '').toLowerCase(),
    reviewer_name: reviewerName,
    review_note: reviewNote || '',
  }).eq('id', id).eq('workspace_id', workspaceId)
  if (error) throw error
  notifyDeadlineChange()
}

export async function setBlocked(workspaceId, id, { category, reason, needHelpFrom, description }) {
  const { error } = await supabase.from('deadlines').update({
    status: 'blocked',
    blocker_info: {
      category: category || 'unknown',
      reason,
      needHelpFrom: needHelpFrom || '',
      description: description || '',
      blockedAt: new Date().toISOString(),
    },
  }).eq('id', id).eq('workspace_id', workspaceId)
  if (error) throw error
  notifyDeadlineChange()
}

export async function clearBlocked(workspaceId, id, nextStatus = 'in_progress') {
  const { error } = await supabase.from('deadlines').update({
    status: nextStatus,
    blocker_info: null,
  }).eq('id', id).eq('workspace_id', workspaceId)
  if (error) throw error
  notifyDeadlineChange()
}

export async function deleteDeadline(workspaceId, id) {
  const { error } = await supabase.from('deadlines').delete().eq('id', id).eq('workspace_id', workspaceId)
  if (error) throw error
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
