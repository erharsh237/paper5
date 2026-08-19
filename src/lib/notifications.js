import { supabase } from './supabase'

export const NOTIFICATION_TYPES = {
  TASK_ASSIGNED: 'task_assigned',
  BLOCKER: 'blocker',
  REVIEW_PENDING: 'review_pending',
  REVIEW_REJECTED: 'review_rejected',
  TASK_APPROVED: 'task_approved',
}

const PAGE_SIZE = 50

function notifyNotificationsChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sprintos:notifications-updated'))
    window.dispatchEvent(new CustomEvent('sprintos:deadlines-updated'))
    window.dispatchEvent(new CustomEvent('sprintos:data-sync'))
    try {
      localStorage.setItem('sprintos:sync_notifications', Date.now().toString())
      localStorage.setItem('sprintos:sync_deadlines', Date.now().toString())
    } catch (_) {}
  }
}

export async function createNotification(workspaceId, teamId, { type, message, deadlineId, forEmail, createdBy }) {
  const targetEmail = forEmail ? forEmail.trim().toLowerCase() : null
  if (!targetEmail) {
    console.warn('createNotification aborted: No target recipient forEmail provided')
    return null
  }

  // Attempt insert with PostgreSQL snake_case columns
  const insertPayload = {
    workspace_id: workspaceId,
    type,
    message,
    deadline_id: deadlineId || null,
    for_email: targetEmail,
    created_by: (createdBy || '').trim().toLowerCase(),
    read_by: [],
  }

  let { data, error } = await supabase
    .from('notifications')
    .insert(insertPayload)
    .select()
    .maybeSingle()

  // Fallback for camelCase schema if database columns are camelCase
  if (error) {
    try {
      const fallbackPayload = {
        workspace_id: workspaceId,
        type,
        message,
        deadlineId: deadlineId || null,
        forEmail: targetEmail,
        createdBy: (createdBy || '').trim().toLowerCase(),
        readBy: [],
      }
      const res = await supabase.from('notifications').insert(fallbackPayload).select().maybeSingle()
      if (!res.error && res.data) {
        notifyNotificationsChange()
        return { id: res.data.id }
      }
    } catch (_) {}
    throw error
  }

  notifyNotificationsChange()
  return { id: data?.id }
}

export function subscribeNotifications(workspaceId, teamIdOrEmail, userEmailOrCallback, maybeCallback) {
  if (!workspaceId) {
    const cb = typeof userEmailOrCallback === 'function' ? userEmailOrCallback : (typeof maybeCallback === 'function' ? maybeCallback : null)
    if (cb) cb([])
    return () => {}
  }

  const rawEmail = (typeof teamIdOrEmail === 'string' && teamIdOrEmail.includes('@'))
    ? teamIdOrEmail 
    : (typeof userEmailOrCallback === 'string' ? userEmailOrCallback : '')
  const email = (rawEmail || '').toLowerCase().trim()

  const callback = typeof teamIdOrEmail === 'function' 
    ? teamIdOrEmail 
    : (typeof userEmailOrCallback === 'function' ? userEmailOrCallback : (typeof maybeCallback === 'function' ? maybeCallback : () => {}))

  let isSubscribed = true
  let isFetching = false

  const fetchList = async () => {
    if (!isSubscribed || !workspaceId || isFetching) return
    isFetching = true
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('workspace_id', workspaceId)
        .limit(PAGE_SIZE)

      if (!error && isSubscribed && Array.isArray(data)) {
        const sorted = [...data].sort((a, b) => {
          const tA = new Date(a.created_at || a.createdAt || 0).getTime()
          const tB = new Date(b.created_at || b.createdAt || 0).getTime()
          return tB - tA
        })
        const normalized = sorted.map(row => ({
          id: row.id,
          workspaceId: row.workspace_id || row.workspaceId,
          recipientId: row.recipient_id || row.recipientId,
          forEmail: (row.recipient_email || row.for_email || row.forEmail || '').toLowerCase().trim(),
          title: row.title || '',
          message: row.message || '',
          type: row.type || 'info',
          read: Boolean(row.is_read ?? row.read ?? (Array.isArray(row.read_by || row.readBy) && (row.read_by || row.readBy).includes(email))),
          createdAt: row.created_at || row.createdAt || new Date().toISOString(),
          link: row.link || null,
        }))

        // Strict recipient isolation: ONLY show notifications addressed to this user's email
        const items = email ? normalized.filter(n => !n.forEmail || n.forEmail === email) : normalized
        if (typeof callback === 'function') callback(items)
      }
    } catch (err) {
      console.warn('subscribeNotifications fetch error:', err)
    } finally {
      isFetching = false
    }
  }

  fetchList()

  const channel = supabase.channel(`public:notifications:ws:${workspaceId}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
      fetchList()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sprintos:deadlines-updated'))
        window.dispatchEvent(new CustomEvent('sprintos:data-sync'))
      }
    })
    .subscribe()

  const onLocalSync = () => fetchList()
  if (typeof window !== 'undefined') {
    window.addEventListener('sprintos:notifications-updated', onLocalSync)
    window.addEventListener('sprintos:data-sync', onLocalSync)
  }
  const onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') fetchList()
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  return () => {
    isSubscribed = false
    supabase.removeChannel(channel)
    if (typeof window !== 'undefined') {
      window.removeEventListener('sprintos:notifications-updated', onLocalSync)
      window.removeEventListener('sprintos:data-sync', onLocalSync)
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }
}

export function requestNotificationPermission() {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
}

export function triggerChromeNotification(title, options = {}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return

  const dispatch = () => {
    try {
      const notif = new Notification(title, {
        icon: '/logo.png',
        badge: '/logo.png',
        tag: options.tag || `sprintos-${Date.now()}`,
        renotify: true,
        body: options.body || '',
        ...options,
      })
      notif.onclick = () => {
        window.focus()
        notif.close()
      }
    } catch (err) {
      console.error('Chrome notification error:', err)
    }
  }

  if (Notification.permission === 'granted') {
    dispatch()
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        dispatch()
      }
    })
  }
}

export function playBellChimeSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    const now = ctx.currentTime

    // Tone 1: High crisp bell chime (880 Hz - A5)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(880, now)
    gain1.gain.setValueAtTime(0.35, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.65)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.65)

    // Tone 2: Harmonic chime (1320 Hz - E6)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1320, now + 0.08)
    gain2.gain.setValueAtTime(0.25, now + 0.08)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.08)
    osc2.stop(now + 0.75)
  } catch (e) {
    console.error('Audio chime error:', e)
  }
}

export async function markNotificationRead(workspaceId, id, userEmail) {
  if (!id || !userEmail) return
  const email = (userEmail || '').trim().toLowerCase()
  try {
    const { data: existing } = await supabase
      .from('notifications')
      .select('readBy')
      .eq('id', id)
      .maybeSingle()
      
    const currentReadBy = Array.isArray(existing?.readBy) ? existing.readBy : []
    if (!currentReadBy.includes(email)) {
      const readBy = [...currentReadBy, email]
      const { error } = await supabase
        .from('notifications')
        .update({ readBy })
        .eq('id', id)
        
      if (error) {
        console.warn('markNotificationRead DB update warning:', error.message)
      }
      notifyNotificationsChange()
    }
  } catch (err) {
    console.error('markNotificationRead exception:', err)
  }
}

export async function markAllNotificationsRead(workspaceId, userEmail) {
  if (!userEmail) return
  const email = (userEmail || '').trim().toLowerCase()
  try {
    const query = supabase
      .from('notifications')
      .select('id, readBy')
    if (workspaceId) query.eq('workspace_id', workspaceId)
    
    const { data } = await query
    for (const notif of (data || [])) {
      const current = Array.isArray(notif.readBy) ? notif.readBy : []
      if (!current.includes(email)) {
        await supabase
          .from('notifications')
          .update({ readBy: [...current, email] })
          .eq('id', notif.id)
      }
    }
    notifyNotificationsChange()
  } catch (err) {
    console.error('markAllNotificationsRead exception:', err)
  }
}
