import { doc, getDoc } from 'firebase/firestore'
import { db } from './firebase'

/**
 * Checks whether an email is present in the `allowedUsers` collection.
 * Document ID must be the exact lowercase email — matches firestore.rules.
 */
export async function isEmailAllowed(email) {
  if (!email) return false
  const ref = doc(db, 'allowedUsers', email.toLowerCase())
  const snap = await getDoc(ref)
  return snap.exists()
}
