import { supabase } from './supabase'

export const NOTIFICATION_TYPES = {
  BLOCKER: 'blocker',
  REVIEW_PENDING: 'review_pending',
  REVIEW_REJECTED: 'review_rejected',
  TASK_APPROVED: 'task_approved',
}

export async function createNotification(workspaceId, teamId, { type, message, deadlineId, forEmail, createdBy }) {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      workspace_id: workspaceId,
      teamId,
      type,
      message,
      deadlineId: deadlineId || null,
      forEmail: forEmail ? forEmail.toLowerCase() : null,
      createdBy: (createdBy || '').toLowerCase(),
      readBy: [],
    })
    .select()
    .maybeSingle()
  if (error) throw error
  return { id: data.id }
}

export function subscribeNotifications(workspaceId, teamId, userEmail, callback) {
  const fetchList = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('createdAt', { ascending: false })
      .limit(50)
      
    if (data) {
      const email = (userEmail || '').toLowerCase()
      const items = data.filter(n => n.forEmail === null || n.forEmail === email)
      callback(items)
    }
  }
  fetchList()
  const channel = supabase.channel(`public:notifications:workspace_id=eq.${workspaceId}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `workspace_id=eq.${workspaceId}` }, () => {
      fetchList()
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}

export async function markNotificationRead(workspaceId, id, userEmail) {
  const email = (userEmail || '').toLowerCase()
  const { data: existing } = await supabase
    .from('notifications')
    .select('readBy')
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .maybeSingle()
    
  const readBy = existing?.readBy || []
  if (!readBy.includes(email)) {
    readBy.push(email)
    await supabase
      .from('notifications')
      .update({ readBy })
      .eq('workspace_id', workspaceId)
      .eq('id', id)
  }
}
