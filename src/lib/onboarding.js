import { supabase } from './supabase'

export async function hasSeenTour(uid, email = null) {
  if (!uid && !email) return true

  const cleanEmail = (email || '').toLowerCase().trim()

  // 1. Check fast client localStorage keys
  if (uid && localStorage.getItem(`tour_completed_${uid}`) === 'true') return true
  if (cleanEmail && localStorage.getItem(`tour_completed_${cleanEmail}`) === 'true') return true
  if (cleanEmail && localStorage.getItem(`sprintos_tour_completed_${cleanEmail}`) === 'true') return true

  // 2. Check Supabase Auth user_metadata
  try {
    const { data: authData } = await supabase.auth.getUser()
    if (authData?.user?.user_metadata?.tour_completed === true) {
      if (uid) localStorage.setItem(`tour_completed_${uid}`, 'true')
      if (cleanEmail) localStorage.setItem(`tour_completed_${cleanEmail}`, 'true')
      return true
    }
  } catch (_) {}

  // 3. Check users table fallback
  if (uid) {
    try {
      const { data: userRecord } = await supabase
        .from('users')
        .select('tour_completed')
        .eq('id', uid)
        .maybeSingle()
      if (userRecord?.tour_completed === true) {
        localStorage.setItem(`tour_completed_${uid}`, 'true')
        if (cleanEmail) localStorage.setItem(`tour_completed_${cleanEmail}`, 'true')
        return true
      }
    } catch (_) {}
  }

  return false
}

export async function markTourSeen(uid, email = null) {
  const cleanEmail = (email || '').toLowerCase().trim()

  // 1. Persist immediately to all relevant localStorage keys
  if (uid) localStorage.setItem(`tour_completed_${uid}`, 'true')
  if (cleanEmail) {
    localStorage.setItem(`tour_completed_${cleanEmail}`, 'true')
    localStorage.setItem(`sprintos_tour_completed_${cleanEmail}`, 'true')
  }

  // 2. Persist to Supabase Auth metadata asynchronously
  try {
    await supabase.auth.updateUser({
      data: { tour_completed: true }
    })
  } catch (_) {}

  // 3. Persist to users table asynchronously
  if (uid) {
    try {
      await supabase
        .from('users')
        .update({ tour_completed: true, updated_at: new Date().toISOString() })
        .eq('id', uid)
    } catch (_) {}
  }
}

export async function resetTourSeen(uid, email = null) {
  const cleanEmail = (email || '').toLowerCase().trim()

  if (uid) localStorage.removeItem(`tour_completed_${uid}`)
  if (cleanEmail) {
    localStorage.removeItem(`tour_completed_${cleanEmail}`)
    localStorage.removeItem(`sprintos_tour_completed_${cleanEmail}`)
  }

  try {
    await supabase.auth.updateUser({
      data: { tour_completed: false }
    })
  } catch (_) {}

  if (uid) {
    try {
      await supabase
        .from('users')
        .update({ tour_completed: false, updated_at: new Date().toISOString() })
        .eq('id', uid)
    } catch (_) {}
  }
}
