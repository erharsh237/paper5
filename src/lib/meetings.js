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
  if (!cb || !workspaceId) {
    if (typeof cb === 'function') cb({})
    return () => {}
  }

  let isSubscribed = true
  let isFetching = false

  const fetchList = async () => {
    if (!isSubscribed || isFetching) return
    isFetching = true
    try {
      // 1. Try fetching from workspaces settings
      const { data: wsData } = await supabase
        .from('workspaces')
        .select('settings')
        .eq('id', workspaceId)
        .maybeSingle()

      if (wsData?.settings?.eventNotes && Object.keys(wsData.settings.eventNotes).length > 0) {
        if (isSubscribed) cb(wsData.settings.eventNotes)
        return
      }

      // 2. Fallback to teamSettings
      const { data: tsData } = await supabase
        .from('teamSettings')
        .select('eventNotes')
        .eq('workspace_id', workspaceId)
        .eq('id', 'main')
        .maybeSingle()

      if (tsData && tsData.eventNotes && Object.keys(tsData.eventNotes).length > 0) {
        if (isSubscribed) cb(tsData.eventNotes)
        return
      }

      // 3. Fallback to local storage cache if available
      try {
        const cached = localStorage.getItem(`sprintos:event_notes_${workspaceId}`)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed && typeof parsed === 'object') {
            if (isSubscribed) cb(parsed)
            return
          }
        }
      } catch (_) {}

      if (isSubscribed) cb({})
    } catch (_) {
      if (isSubscribed) cb({})
    } finally {
      isFetching = false
    }
  }

  fetchList()

  const channel = supabase.channel(`public:teamSettings:ws:${workspaceId}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces', filter: `id=eq.${workspaceId}` }, () => fetchList())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'teamSettings', filter: `workspace_id=eq.${workspaceId}` }, () => fetchList())
    .subscribe()

  const onLocalSync = () => fetchList()
  const onStorageSync = (e) => {
    if (e?.key?.startsWith('sprintos:')) fetchList()
  }
  const onVisibilityOrFocus = () => {
    if (typeof document !== 'undefined' && !document.hidden) fetchList()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('sprintos:meetings-updated', onLocalSync)
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
      window.removeEventListener('sprintos:meetings-updated', onLocalSync)
      window.removeEventListener('sprintos:data-sync', onLocalSync)
      window.removeEventListener('storage', onStorageSync)
      window.removeEventListener('focus', onVisibilityOrFocus)
      window.removeEventListener('online', onVisibilityOrFocus)
      document.removeEventListener('visibilitychange', onVisibilityOrFocus)
    }
  }
}

export async function saveEventNote(workspaceId, teamId, eventId, notesObj, currentUserEmail) {
  // 1. Get existing from workspace settings or teamSettings
  let currentNotes = {}
  let currentWsSettings = {}
  try {
    const { data: wsData } = await supabase.from('workspaces').select('settings').eq('id', workspaceId).maybeSingle()
    if (wsData?.settings) {
      currentWsSettings = wsData.settings
      currentNotes = wsData.settings.eventNotes || {}
    }
  } catch (_) {}

  if (Object.keys(currentNotes).length === 0) {
    try {
      const { data: tsData } = await supabase.from('teamSettings').select('eventNotes').eq('workspace_id', workspaceId).eq('id', 'main').maybeSingle()
      if (tsData?.eventNotes) currentNotes = tsData.eventNotes
    } catch (_) {}
  }

  const updatedNotes = { ...currentNotes, [eventId]: notesObj }

  // 2. Persist via serverless API (uses service key to bypass RLS)
  try {
    await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_event_note',
        workspaceId,
        eventId,
        notesObj
      })
    })
  } catch (apiErr) {
    console.warn('API meetings fallback notice:', apiErr)
  }

  // 3. Direct client update on workspaces settings
  try {
    await supabase.from('workspaces').update({
      settings: { ...currentWsSettings, eventNotes: updatedNotes }
    }).eq('id', workspaceId)
  } catch (_) {}

  // 4. Persist to teamSettings fallback
  try {
    await supabase.from('teamSettings').upsert({
      workspace_id: workspaceId,
      id: 'main',
      eventNotes: updatedNotes,
      updatedAt: new Date().toISOString()
    })
  } catch (_) {}

  // 5. Cache locally
  try {
    localStorage.setItem(`sprintos:event_notes_${workspaceId}`, JSON.stringify(updatedNotes))
  } catch (_) {}

  // 6. Notify local listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sprintos:meetings-updated'))
    window.dispatchEvent(new CustomEvent('sprintos:data-sync'))
  }

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
  let currentNotes = {}
  let currentWsSettings = {}
  try {
    const { data: wsData } = await supabase.from('workspaces').select('settings').eq('id', workspaceId).maybeSingle()
    if (wsData?.settings) {
      currentWsSettings = wsData.settings
      currentNotes = wsData.settings.eventNotes || {}
    }
  } catch (_) {}

  const updatedNotes = { ...currentNotes }
  delete updatedNotes[eventId]

  // Persist via serverless API
  try {
    await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete_event_note',
        workspaceId,
        eventId
      })
    })
  } catch (apiErr) {
    console.warn('API meetings delete fallback notice:', apiErr)
  }

  try {
    await supabase.from('workspaces').update({
      settings: { ...currentWsSettings, eventNotes: updatedNotes }
    }).eq('id', workspaceId)
  } catch (_) {}

  try {
    await supabase.from('teamSettings').upsert({
      workspace_id: workspaceId,
      id: 'main',
      eventNotes: updatedNotes,
      updatedAt: new Date().toISOString()
    })
  } catch (_) {}

  try {
    localStorage.setItem(`sprintos:event_notes_${workspaceId}`, JSON.stringify(updatedNotes))
  } catch (_) {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sprintos:meetings-updated'))
    window.dispatchEvent(new CustomEvent('sprintos:data-sync'))
  }

  return updatedNotes
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
