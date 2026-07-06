import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp, where, arrayUnion, Timestamp
} from 'firebase/firestore'
import { db } from './firebase'

const deadlinesCol = collection(db, 'deadlines')
const membersCol = collection(db, 'members')

// ---- Deadlines ----

export function subscribeDeadlines(teamId, callback) {
  const q = query(
    deadlinesCol,
    where('teamId', '==', teamId),
    orderBy('dueDate', 'asc')
  )
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(items)
  })
}

export async function createDeadline(teamId, data) {
  return addDoc(deadlinesCol, {
    teamId,
    title: data.title,
    description: data.description || '',
    priority: data.priority || 'medium', // low | medium | high | critical
    status: 'in_progress', // not_started | in_progress | blocked | done (default: in_progress)
    dueDate: data.dueDate, // ISO string
    assigneeId: data.assigneeId,
    assigneeName: data.assigneeName,
    assigneeEmail: data.assigneeEmail,
    createdBy: data.createdBy, // exact signed-in email — used for delete permission checks
    createdByName: data.createdByName, // display name shown in the UI
    createdAt: serverTimestamp(),
    percentComplete: 0,
  })
}

export async function updateDeadline(id, patch) {
  return updateDoc(doc(db, 'deadlines', id), patch)
}

// Status-only update used by assignees from the card controls. Kept
// separate from updateDeadline since it's the narrow write the Firestore
// rules permit for a non-owner (status/percentComplete only).
export async function updateDeadlineStatus(id, status) {
  const patch = { status }
  if (status === 'done') patch.percentComplete = 100
  if (status === 'not_started') patch.percentComplete = 0
  return updateDoc(doc(db, 'deadlines', id), patch)
}

// Optional note an assignee can attach to their own deadline to log extra
// work done beyond the original scope. Stored as an append-only array so
// concurrent additions never overwrite each other.
export async function addExtraWork(id, { note, addedBy, addedByName }) {
  return updateDoc(doc(db, 'deadlines', id), {
    extraWork: arrayUnion({
      note,
      addedBy,
      addedByName,
      addedAt: Timestamp.now(),
    }),
  })
}

export async function deleteDeadline(id) {
  return deleteDoc(doc(db, 'deadlines', id))
}

// ---- Team members ----

export function subscribeMembers(teamId, callback) {
  const q = query(membersCol, where('teamId', '==', teamId))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export async function addMember(teamId, { name, email }) {
  return addDoc(membersCol, { teamId, name, email, createdAt: serverTimestamp() })
}

export async function removeMember(id) {
  return deleteDoc(doc(db, 'members', id))
}
