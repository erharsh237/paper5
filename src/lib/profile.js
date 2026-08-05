import { supabase } from './supabase'

export function subscribeProfile(workspaceId, uid, callback) {
  if (!uid || !workspaceId) return () => {}
  const fetchList = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', uid)
      .maybeSingle()
    callback(data || null)
  }
  fetchList()
  const channel = supabase.channel(`public:profiles:workspace_id=eq.${workspaceId}:id=eq.${uid}:${Math.random().toString(36).substring(7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
      // payload might not contain id if not explicitly in filter, but we are fetching on any change to this table with this workspace
      // Actually we can just fetch
      fetchList()
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}

export async function saveProfile(workspaceId, uid, { email, name, phone, roleId, roleName, bio }) {
  await supabase
    .from('profiles')
    .upsert({
      workspace_id: workspaceId,
      id: uid,
      email: (email || '').toLowerCase(),
      name: name || '',
      phone: phone || '',
      roleId: roleId || null,
      roleName: roleName || '',
      bio: bio || '',
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

export async function saveAim(workspaceId, uid, aim) {
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

export async function uploadPhoto(workspaceId, uid, dataUrl) {
  await supabase
    .from('profiles')
    .upsert({
      workspace_id: workspaceId,
      id: uid,
      photoURL: dataUrl,
      updatedAt: new Date().toISOString()
    })
}

export async function uploadResume(workspaceId, uid, resumeUrl, resumeName) {
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

export async function deleteResume(workspaceId, uid) {
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
