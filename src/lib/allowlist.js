import { doc, getDoc, collection, getDocs, setDoc, deleteDoc, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'

/**
 * Checks whether an email is present in the `allowedUsers` collection.
 * Document ID must be the exact lowercase email — matches firestore.rules.
 */
export async function isEmailAllowed(email) {
  if (!email) return false
  const ref = doc(db, 'allowedUsers', email.toLowerCase())
  const snap = await getDoc(ref)
  return snap.exists() ? snap.data() : false
}

export function subscribeEmailAllowed(email, callback) {
  if (!email) return () => {}
  const ref = doc(db, 'allowedUsers', email.toLowerCase())
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? snap.data() : false)
  })
}

/**
 * Fetches the specific allowedUser document to get fields like 'Note'.
 */
export async function getAllowedUser(email) {
  if (!email) return null
  const ref = doc(db, 'allowedUsers', email.toLowerCase())
  const snap = await getDoc(ref)
  return snap.exists() ? snap.data() : null
}

/**
 * Fetches all emails from the `allowedUsers` collection.
 */
export async function getAllowedUsers() {
  const q = query(collection(db, 'allowedUsers'))
  const snap = await getDocs(q)
  return snap.docs.map(doc => ({ email: doc.id, ...doc.data() }))
}

export function subscribeAllowedUsers(callback) {
  const q = query(collection(db, 'allowedUsers'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(doc => ({
      id: doc.id,
      email: doc.id,
      name: doc.id,
      ...doc.data()
    })))
  })
}

/**
 * Adds an email to the `allowedUsers` collection.
 */
export async function addAllowedUser(email, addedBy, role = '') {
  if (!email) throw new Error('Email is required')
  const ref = doc(db, 'allowedUsers', email.toLowerCase().trim())
  
  // Prevent overriding an existing user's role
  const snap = await getDoc(ref)
  if (snap.exists()) {
    throw new Error(`${email} is already in the allowlist. Please remove them first to assign a new role.`)
  }

  const data = {
    addedBy: addedBy || 'admin',
    addedAt: Date.now()
  }
  if (role) {
    data.Note = role.trim()
  }
  await setDoc(ref, data)
}

/**
 * Removes an email from the `allowedUsers` collection.
 */
export async function removeAllowedUser(email) {
  if (!email) throw new Error('Email is required')
  const ref = doc(db, 'allowedUsers', email.toLowerCase().trim())
  await deleteDoc(ref)
}
