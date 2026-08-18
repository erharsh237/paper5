import { supabase } from './supabase'

export const NOTIFICATION_TYPES = {
  TASK_ASSIGNED: 'task_assigned',
  BLOCKER: 'blocker',
  REVIEW_PENDING: 'review_pending',
  REVIEW_REJECTED: 'review_rejected',
  TASK_APPROVED: 'task_approved',
}

function notifyNotificationsChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sprintos:notifications-updated'))
    window.dispatchEvent(new CustomEvent('sprintos:data-sync'))
  }
}

export async function createNotification(workspaceId, teamId, { type, message, deadlineId, forEmail, createdBy }) {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      workspace_id: workspaceId,
      type,
      message,
      deadlineId: deadlineId || null,
      forEmail: forEmail ? forEmail.trim().toLowerCase() : null,
      createdBy: (createdBy || '').trim().toLowerCase(),
      readBy: [],
    })
    .select()
    .maybeSingle()
  if (error) throw error
  notifyNotificationsChange()
  return { id: data.id }
}

export function subscribeNotifications(workspaceId, teamId, userEmail, callback) {
  let isSubscribed = true
  if (!workspaceId) return () => {}

  const fetchList = async () => {
    if (!isSubscribed || !workspaceId) return
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('workspace_id', workspaceId)
        .limit(50)
        
      if (!error && data && isSubscribed) {
        const email = (userEmail || '').trim().toLowerCase()
        const normalized = data.map(n => ({
          ...n,
          forEmail: (n.for_email || n.forEmail || '').trim().toLowerCase() || null,
          deadlineId: n.deadline_id || n.deadlineId || null,
          createdBy: (n.created_by || n.createdBy || '').trim().toLowerCase(),
          readBy: Array.isArray(n.read_by) ? n.read_by : (Array.isArray(n.readBy) ? n.readBy : []),
          createdAt: n.created_at || n.createdAt || new Date().toISOString(),
        })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

        const items = normalized.filter(n => !n.forEmail || n.forEmail === email)
        callback(items)
      }
    } catch (err) {
      console.warn('subscribeNotifications fetch error:', err)
    }
  }

  fetchList()

  const channel = supabase.channel(`public:notifications:workspace_id=eq.${workspaceId}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `workspace_id=eq.${workspaceId}` }, () => {
      fetchList()
    })
    .subscribe()

  const onLocalSync = () => fetchList()
  if (typeof window !== 'undefined') {
    window.addEventListener('sprintos:notifications-updated', onLocalSync)
    window.addEventListener('sprintos:data-sync', onLocalSync)
    window.addEventListener('focus', onLocalSync)
  }
  const onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') fetchList()
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  // 3-second heartbeat sync when browser tab is active
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
      window.removeEventListener('sprintos:notifications-updated', onLocalSync)
      window.removeEventListener('sprintos:data-sync', onLocalSync)
      window.removeEventListener('focus', onLocalSync)
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
