import {
  collection, addDoc, updateDoc, doc,
  onSnapshot, query, where, orderBy, serverTimestamp, limit, arrayUnion
} from 'firebase/firestore'
import { db } from './firebase'

const notificationsCol = collection(db, 'notifications')

// A notification: { teamId, type, message, deadlineId, forEmail, createdBy, createdAt, readBy }
// forEmail: null means "everyone on the team" (e.g. new blocker); a specific
// lowercase email targets one founder (e.g. "review pending" to the reviewer).
// readBy is an array of emails that have dismissed it — lets one broadcast
// doc serve every founder without N copies.
export const NOTIFICATION_TYPES = {
  BLOCKER: 'blocker',
  REVIEW_PENDING: 'review_pending',
  REVIEW_REJECTED: 'review_rejected',
  TASK_APPROVED: 'task_approved',
}

export async function createNotification(teamId, { type, message, deadlineId, forEmail, createdBy }) {
  return addDoc(notificationsCol, {
    teamId,
    type,
    message,
    deadlineId: deadlineId || null,
    forEmail: forEmail ? forEmail.toLowerCase() : null,
    createdBy: (createdBy || '').toLowerCase(),
    createdAt: serverTimestamp(),
    readBy: [],
  })
}

// Subscribes to the most recent notifications relevant to userEmail
// (broadcasts + anything targeted at them specifically). Filtering by
// audience happens client-side since Firestore can't OR two `where`s
// on different fields without a composite "in" trick that doesn't fit
// the null-vs-email shape here.
export function subscribeNotifications(teamId, userEmail, callback) {
  const q = query(notificationsCol, where('teamId', '==', teamId), orderBy('createdAt', 'desc'), limit(50))
  return onSnapshot(q, (snap) => {
    const email = (userEmail || '').toLowerCase()
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(n => n.forEmail === null || n.forEmail === email)
    callback(items)
  })
}

export async function markNotificationRead(id, userEmail) {
  const email = (userEmail || '').toLowerCase()
  const ref = doc(db, 'notifications', id)
  return updateDoc(ref, { readBy: arrayUnion(email) })
}
