import { supabase } from './supabase'

export const DEADLINES_DEFAULT_PAGE_SIZE = 100

export const SPRINT_LOCKED_FIELDS = [
  'assigneeId', 'assigneeName', 'assigneeEmail',
  'dueDate', 'estimatedHours', 'sprintId', 'title', 'priority',
]

export function isSprintLockViolation(patch) {
  return Object.keys(patch).some(k => SPRINT_LOCKED_FIELDS.includes(k))
}

export function subscribeDeadlines(workspaceId, teamId, callback, pageSize = DEADLINES_DEFAULT_PAGE_SIZE) {
  const fetchList = async () => {
    const { data, error } = await supabase
      .from('deadlines')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('due_date', { ascending: true })
      .limit(pageSize)
    if (!error) {
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
      }))
      callback(normalized)
    }
  }

  const channel = supabase.channel(`public:deadlines:workspace_id=eq.${workspaceId}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'deadlines', filter: `workspace_id=eq.${workspaceId}` }, payload => {
       fetchList()
    })
    .subscribe()
  
  fetchList()
  
  return () => supabase.removeChannel(channel)
}

export async function createDeadline(workspaceId, teamId, data) {
  const { data: result, error } = await supabase.from('deadlines').insert([{
    workspace_id: workspaceId,
    team_id: teamId,
    title: data.title,
    description: data.description || '',
    priority: data.priority || 'medium',
    status: 'in_progress',
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
  return result[0]
}

export async function updateDeadline(workspaceId, id, patch) {
  const { error } = await supabase.from('deadlines').update(patch).eq('id', id).eq('workspace_id', workspaceId)
  if (error) throw error
}

export async function updateDeadlineStatus(workspaceId, id, status) {
  const patch = { status }
  if (status === 'done') patch.percent_complete = 100
  if (status === 'not_started') patch.percent_complete = 0
  const { error } = await supabase.from('deadlines').update(patch).eq('id', id).eq('workspace_id', workspaceId)
  if (error) throw error
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
  return data[0]
}

export function subscribeExtraWork(workspaceId, deadlineId, callback) {
  const fetchList = async () => {
    const { data, error } = await supabase
      .from('extra_work')
      .select('*')
      .eq('deadline_id', deadlineId)
      .order('added_at', { ascending: true })
    if (!error) callback(data || [])
  }
  const channel = supabase.channel(`public:extra_work:deadline_id=eq.${deadlineId}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'extra_work', filter: `deadline_id=eq.${deadlineId}` }, payload => {
       fetchList()
    })
    .subscribe()
  fetchList()
  return () => supabase.removeChannel(channel)
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
  const { error } = await supabase.from('deadlines').update({
    status: 'review',
    reviewer_email: null,
    reviewer_name: null,
    review_note: null,
  }).eq('id', id).eq('workspace_id', workspaceId)
  if (error) throw error
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

export async function approveReview(workspaceId, id, { reviewerEmail, reviewerName }) {
  const { error } = await supabase.from('deadlines').update({
    status: 'done',
    percent_complete: 100,
    reviewer_email: (reviewerEmail || '').toLowerCase(),
    reviewer_name: reviewerName,
    completed_at: new Date().toISOString(),
  }).eq('id', id).eq('workspace_id', workspaceId)
  if (error) throw error
}

export async function rejectReview(workspaceId, id, { reviewerEmail, reviewerName, reviewNote }) {
  const { error } = await supabase.from('deadlines').update({
    status: 'in_progress',
    reviewer_email: (reviewerEmail || '').toLowerCase(),
    reviewer_name: reviewerName,
    review_note: reviewNote || '',
  }).eq('id', id).eq('workspace_id', workspaceId)
  if (error) throw error
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
}

export async function clearBlocked(workspaceId, id, nextStatus = 'in_progress') {
  const { error } = await supabase.from('deadlines').update({
    status: nextStatus,
    blocker_info: null,
  }).eq('id', id).eq('workspace_id', workspaceId)
  if (error) throw error
}

export async function deleteDeadline(workspaceId, id) {
  const { error } = await supabase.from('deadlines').delete().eq('id', id).eq('workspace_id', workspaceId)
  if (error) throw error
}

export function subscribeMembers(workspaceId, teamId, callback) {
  const fetchList = async () => {
    const { data, error } = await supabase
      .from('workspace_members')
      .select(`
        role,
        joined_at,
        users ( email, full_name, avatar_url )
      `)
      .eq('workspace_id', workspaceId)
    if (!error) {
      const mapped = data.map(row => ({
        id: row.users?.email,
        email: row.users?.email,
        name: row.users?.full_name,
        avatarUrl: row.users?.avatar_url,
        role: row.role,
        joinedAt: row.joined_at
      }))
      callback(mapped)
    }
  }
  const channel = supabase.channel(`public:workspace_members:workspace_id=eq.${workspaceId}:deadlines:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${workspaceId}` }, payload => {
       fetchList()
    })
    .subscribe()
  fetchList()
  return () => supabase.removeChannel(channel)
}

export async function addMember(workspaceId, teamId, { name, email, addedBy }) {
  throw new Error("addMember is deprecated. Use workspace invites instead.")
}

export async function removeMember(workspaceId, id) {
  const { error } = await supabase.from('workspace_members').delete().eq('user_id', id).eq('workspace_id', workspaceId)
  if (error) throw error
}
