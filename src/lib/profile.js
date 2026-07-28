import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from './firebase'

// One profile doc per user, id = lowercase email — same pattern as onboarding.js.
function profileRef(email) {
  return doc(db, 'profiles', (email || '').toLowerCase())
}

export function subscribeProfile(email, callback) {
  if (!email) return () => {}
  return onSnapshot(profileRef(email), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  })
}

export async function saveProfile(email, { name, phone, roleId, roleName, bio }) {
  return setDoc(profileRef(email), {
    email: (email || '').toLowerCase(),
    name: name || '',
    phone: phone || '',
    roleId: roleId || null,
    roleName: roleName || '',
    bio: bio || '',
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

const AIM_LOCK_DAYS = 45

// The aim can only be (re)written if it's never been set, or the last save
// is more than 45 days old. aimSavedAt is a Firestore Timestamp; the
// Firestore rules enforce the same 45-day window server-side using
// request.time, so this client check is a UX convenience, not the
// enforcement point.
export function getAimLockStatus(profile) {
  const savedAt = profile?.aimSavedAt?.toDate ? profile.aimSavedAt.toDate() : null
  if (!savedAt) return { locked: false, unlockDate: null }
  const unlockDate = new Date(savedAt.getTime() + AIM_LOCK_DAYS * 24 * 60 * 60 * 1000)
  return { locked: unlockDate > new Date(), unlockDate }
}

export async function saveAim(email, aim) {
  return setDoc(profileRef(email), {
    aim: aim || '',
    aimSavedAt: serverTimestamp(),
  }, { merge: true })
}

// Storage layout:
//   profile-pics/{email}/{filename}
//   resumes/{email}/{filename}
// Keeping everything under the user's own email prefix makes the storage
// rules simple: a user can only write under their own folder.

export async function uploadProfilePic(email, file) {
  const path = `profile-pics/${(email || '').toLowerCase()}/${Date.now()}-${file.name}`
  const fileRef = ref(storage, path)
  await uploadBytes(fileRef, file)
  const url = await getDownloadURL(fileRef)
  await setDoc(profileRef(email), { photoURL: url, photoPath: path, updatedAt: serverTimestamp() }, { merge: true })
  return url
}

export async function uploadResume(email, file) {
  const path = `resumes/${(email || '').toLowerCase()}/${Date.now()}-${file.name}`
  const fileRef = ref(storage, path)
  await uploadBytes(fileRef, file)
  const url = await getDownloadURL(fileRef)
  await setDoc(profileRef(email), {
    resumeURL: url, resumePath: path, resumeName: file.name, updatedAt: serverTimestamp(),
  }, { merge: true })
  return url
}

export async function removeResume(email, resumePath) {
  if (resumePath) {
    try { await deleteObject(ref(storage, resumePath)) } catch { /* already gone, ignore */ }
  }
  return setDoc(profileRef(email), {
    resumeURL: null, resumePath: null, resumeName: null, updatedAt: serverTimestamp(),
  }, { merge: true })
}

export async function getProfileOnce(email) {
  const snap = await getDoc(profileRef(email))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}
