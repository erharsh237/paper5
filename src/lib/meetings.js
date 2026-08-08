import { supabase } from './supabase'
import { createNotification, playBellChimeSound } from './notifications'

export const AGENDA_STEPS = [
  { key: 'reviewPrevious', label: '1. Previous sprint review' },
  { key: 'demo', label: '2. Demo completed tasks' },
  { key: 'blockers', label: '3. Discuss blockers' },
  { key: 'planNext', label: '4. Plan next sprint' },
  { key: 'assign', label: '5. Assign tasks' },
  { key: 'lockSprint', label: '6. Lock sprint' },
]

export function subscribeMeetings(workspaceId, teamId, callback) {
  const fetchList = async () => {
    const { data } = await supabase
      .from('meetings')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('date', { ascending: false })
      .limit(30)
    if (data) callback(data)
  }
  fetchList()
  const channel = supabase.channel(`public:meetings:workspace_id=eq.${workspaceId}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter: `workspace_id=eq.${workspaceId}` }, () => {
      fetchList()
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}

export function subscribeUpcomingMeetings(workspaceId, teamId, callback) {
  const fetchList = async () => {
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('meetings')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('date', now)
      .order('date', { ascending: true })
      .limit(5)
    if (data) callback(data)
  }
  fetchList()
  const channel = supabase.channel(`public:meetings_upcoming:workspace_id=eq.${workspaceId}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter: `workspace_id=eq.${workspaceId}` }, () => {
      fetchList()
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}

export function subscribeEventNotes(workspaceId, teamId, callback) {
  const cb = typeof teamId === 'function' ? teamId : callback
  if (!cb) return () => {}

  const fetchList = async () => {
    const { data } = await supabase
      .from('teamSettings')
      .select('eventNotes')
      .eq('workspace_id', workspaceId)
      .eq('id', 'main')
      .maybeSingle()
    if (data && data.eventNotes) {
      cb(data.eventNotes)
    } else {
      cb({})
    }
  }
  fetchList()
  const channel = supabase.channel(`public:teamSettings:workspace_id=eq.${workspaceId}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'teamSettings', filter: `workspace_id=eq.${workspaceId}` }, () => {
      fetchList()
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}

export async function saveEventNote(workspaceId, teamId, eventId, notesObj, currentUserEmail) {
  const { data: existing } = await supabase
    .from('teamSettings')
    .select('eventNotes')
    .eq('workspace_id', workspaceId)
    .eq('id', 'main')
    .maybeSingle()
  
  const currentNotes = existing?.eventNotes || {}
  const updatedNotes = { ...currentNotes, [eventId]: notesObj }
  
  await supabase
    .from('teamSettings')
    .upsert({ 
      workspace_id: workspaceId, 
      id: 'main', 
      eventNotes: updatedNotes, 
      updatedAt: new Date().toISOString() 
    })

  // Play crystal bell chime sound
  playBellChimeSound()

  // Broadcast Notification Bell update to all workspace members
  const title = notesObj?.title || 'Meeting'
  const creator = currentUserEmail ? ` by ${currentUserEmail}` : ''
  createNotification(workspaceId, undefined, {
    type: 'meeting_notes',
    message: `📝 Meeting notes updated for "${title}"${creator}`,
    forEmail: null, // Broadcast to all workspace members
    createdBy: currentUserEmail
  }).catch(err => console.error('Failed to dispatch meeting note notification:', err))
}

export async function deleteEventNote(workspaceId, teamId, eventId) {
  const { data: existing } = await supabase
    .from('teamSettings')
    .select('eventNotes')
    .eq('workspace_id', workspaceId)
    .eq('id', 'main')
    .maybeSingle()
    
  if (existing && existing.eventNotes) {
    const updatedNotes = { ...existing.eventNotes }
    delete updatedNotes[eventId]
    await supabase
      .from('teamSettings')
      .update({ 
        eventNotes: updatedNotes, 
        updatedAt: new Date().toISOString() 
      })
      .eq('workspace_id', workspaceId)
      .eq('id', 'main')
  }
}

export async function createMeeting(workspaceId, teamId, { sprintId, date, createdBy }) {
  const emptyNotes = AGENDA_STEPS.reduce((acc, s) => ({ ...acc, [s.key]: '' }), {})
  const { data, error } = await supabase
    .from('meetings')
    .insert({
      workspace_id: workspaceId,
      teamId,
      sprintId: sprintId || null,
      date,
      notes: emptyNotes,
      createdBy: (createdBy || '').toLowerCase(),
    })
    .select()
    .maybeSingle()
  
  if (error) throw error
  return { id: data.id }
}

export async function updateMeetingNote(workspaceId, id, stepKey, value) {
  const { data: existing } = await supabase
    .from('meetings')
    .select('notes')
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .maybeSingle()
    
  const notes = existing?.notes || {}
  notes[stepKey] = value
  
  await supabase
    .from('meetings')
    .update({ 
      notes, 
      updatedAt: new Date().toISOString() 
    })
    .eq('workspace_id', workspaceId)
    .eq('id', id)
}
