import { supabase } from './supabase'

export async function hasSeenTour(uid) {
  if (!uid) return true 
  const local = localStorage.getItem(`tour_completed_${uid}`)
  if (local === 'true') return true

  try {
    const { data } = await supabase
      .from('users')
      .select('tour_completed')
      .eq('id', uid)
      .maybeSingle()
    if (data?.tour_completed) {
      localStorage.setItem(`tour_completed_${uid}`, 'true')
      return true
    }
  } catch (err) {
    // Ignore error
  }
  return false
}

export async function markTourSeen(uid) {
  if (!uid) return
  localStorage.setItem(`tour_completed_${uid}`, 'true')
  try {
    await supabase
      .from('users')
      .update({ tour_completed: true })
      .eq('id', uid)
  } catch (err) {
    // Ignore error
  }
}

export async function resetTourSeen(uid) {
  if (!uid) return
  localStorage.removeItem(`tour_completed_${uid}`)
  try {
    await supabase
      .from('users')
      .update({ tour_completed: false })
      .eq('id', uid)
  } catch (err) {
    // Ignore error
  }
}
