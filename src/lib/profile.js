import { supabase } from './supabase'

export function subscribeProfile(arg1, arg2, arg3) {
  let workspaceId = typeof arg2 === 'function' ? 'global' : arg1
  let uid = typeof arg2 === 'function' ? arg1 : arg2
  let callback = typeof arg2 === 'function' ? arg2 : arg3

  if (!uid || typeof callback !== 'function') return () => {}

  const fetchList = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', uid)
      .maybeSingle()
    if (typeof callback === 'function') callback(data || null)
  }
  fetchList()
  const channel = supabase.channel(`public:profiles:${workspaceId}:${uid}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `workspace_id=eq.${workspaceId}` }, () => {
      fetchList()
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}

export async function saveProfile(arg1, arg2, arg3) {
  const workspaceId = typeof arg2 === 'object' ? 'global' : arg1
  const uid = typeof arg2 === 'object' ? arg1 : arg2
  const payload = typeof arg2 === 'object' ? arg2 : (arg3 || {})

  await supabase
    .from('profiles')
    .upsert({
      workspace_id: workspaceId,
      id: uid,
      email: (payload.email || '').toLowerCase(),
      name: payload.name || '',
      phone: payload.phone || '',
      roleId: payload.roleId || null,
      roleName: payload.roleName || '',
      bio: payload.bio || '',
      updatedAt: new Date().toISOString()
    })
}

const AIM_LOCK_DAYS = 45

export function getAimLockStatus(profile) {
  const savedAt = profile?.aimSavedAt ? new Date(profile.aimSavedAt) : null
  if (!savedAt) return { locked: false, unlockDate: null }
  const unlockDate = new Date(savedAt.getTime() + AIM_LOCK_DAYS * 24 * 60 * 60 * 1000)
  return { locked: unlockDate > new Date(), unlockDate }
}

export async function saveAim(arg1, arg2, arg3) {
  const workspaceId = typeof arg3 === 'undefined' ? 'global' : arg1
  const uid = typeof arg3 === 'undefined' ? arg1 : arg2
  const aim = typeof arg3 === 'undefined' ? arg2 : arg3

  await supabase
    .from('profiles')
    .upsert({
      workspace_id: workspaceId,
      id: uid,
      aim: aim || '',
      aimSavedAt: new Date().toISOString()
    })
}

export async function getProfileOnce(workspaceId, uid) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', uid)
    .maybeSingle()
  return data || null
}

export async function uploadPhoto(arg1, arg2, arg3) {
  const workspaceId = typeof arg3 === 'undefined' ? 'global' : arg1
  const uid = typeof arg3 === 'undefined' ? arg1 : arg2
  const dataUrl = typeof arg3 === 'undefined' ? arg2 : arg3

  await supabase
    .from('profiles')
    .upsert({
      workspace_id: workspaceId,
      id: uid,
      photoURL: dataUrl,
      updatedAt: new Date().toISOString()
    })
}

export async function uploadResume(arg1, arg2, arg3, arg4) {
  const workspaceId = typeof arg4 === 'undefined' ? 'global' : arg1
  const uid = typeof arg4 === 'undefined' ? arg1 : arg2
  const resumeUrl = typeof arg4 === 'undefined' ? arg2 : arg3
  const resumeName = typeof arg4 === 'undefined' ? arg3 : arg4

  await supabase
    .from('profiles')
    .upsert({
      workspace_id: workspaceId,
      id: uid,
      resumeURL: resumeUrl,
      resumeName: resumeName,
      updatedAt: new Date().toISOString()
    })
}

export async function deleteResume(arg1, arg2) {
  const workspaceId = typeof arg2 === 'undefined' ? 'global' : arg1
  const uid = typeof arg2 === 'undefined' ? arg1 : arg2

  await supabase
    .from('profiles')
    .upsert({
      workspace_id: workspaceId,
      id: uid,
      resumeURL: null,
      resumeName: null,
      updatedAt: new Date().toISOString()
    })
}
