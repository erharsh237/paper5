import { collection, doc, setDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

const rolesCol = collection(db, 'roles')

// A role: { name, createdAt }. Doc id is a slug of the name so adding the
// same role twice just re-touches the same doc instead of duplicating.
export function subscribeRoles(callback) {
  const q = query(rolesCol, orderBy('name'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export async function addRole(name) {
  const trimmed = name.trim()
  if (!trimmed) return null
  const id = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  await setDoc(doc(db, 'roles', id), { name: trimmed, createdAt: serverTimestamp() }, { merge: true })
  return id
}
