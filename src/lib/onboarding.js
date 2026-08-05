import { supabase } from './supabase'

export async function hasSeenTour(uid) {
  if (!uid) return true 
  try {
    const { data } = await supabase
      .from('onboarding')
      .select('tourCompleted')
      .eq('id', uid)
      .maybeSingle()
    return data?.tourCompleted === true
  } catch (err) {
    return false
  }
}

export async function markTourSeen(uid) {
  if (!uid) return
  try {
    await supabase
      .from('onboarding')
      .upsert({
        id: uid,
        tourCompleted: true,
        completedAt: new Date().toISOString()
      })
  } catch (err) {
    console.error('Failed to mark tour seen:', err)
  }
}

export async function resetTourSeen(uid) {
  if (!uid) return
  try {
    await supabase
      .from('onboarding')
      .update({ tourCompleted: false })
      .eq('id', uid)
  } catch (err) {
    console.error('Failed to reset tour:', err)
  }
}
