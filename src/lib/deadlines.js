import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp, where
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
    status: 'not_started', // not_started | in_progress | blocked | done
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
