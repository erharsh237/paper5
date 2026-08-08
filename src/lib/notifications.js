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
