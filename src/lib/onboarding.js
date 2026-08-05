import { supabase } from './supabase'

export async function hasSeenTour(workspaceId, uid) {
  if (!uid) return true 
  const { data } = await supabase
    .from('onboarding')
    .select('tourCompleted')
    .eq('id', uid)
    .eq('tourCompleted', true)
    .limit(1)
    .maybeSingle()
  return !!data
}

export async function markTourSeen(workspaceId, uid) {
  await supabase
    .from('onboarding')
    .upsert({
      workspace_id: workspaceId,
      id: uid,
      tourCompleted: true,
      completedAt: new Date().toISOString()
    })
}

export async function resetTourSeen(workspaceId, uid) {
  await supabase
    .from('onboarding')
    .update({ tourCompleted: false })
    .eq('id', uid)
}
