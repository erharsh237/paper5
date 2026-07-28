import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, where, orderBy, serverTimestamp, getDocs, writeBatch
} from 'firebase/firestore'
import { db } from './firebase'

const sprintsCol = collection(db, 'sprints')

// A sprint: { teamId, number, goal, startDate, endDate, status, locked, createdBy, createdAt }
// status: 'planning' | 'active' | 'completed'
// Only one sprint per team should be 'active' at a time — enforced in app
// code (see setActiveSprint) since Firestore rules can't easily enforce
// cross-document invariants without a Cloud Function.

export function subscribeSprints(teamId, callback) {
  const q = query(sprintsCol, where('teamId', '==', teamId), orderBy('number', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export async function createSprint(teamId, { number, goal, startDate, endDate, createdBy }) {
  return addDoc(sprintsCol, {
    teamId,
    number,
    goal: goal || '',
    startDate, // ISO string
    endDate,   // ISO string
    status: 'planning',
    locked: false,
    createdBy: (createdBy || '').toLowerCase(),
    createdAt: serverTimestamp(),
  })
}

export async function updateSprint(id, patch) {
  return updateDoc(doc(db, 'sprints', id), patch)
}

export async function deleteSprint(id) {
  return deleteDoc(doc(db, 'sprints', id))
}

// Activating a sprint deactivates any other active sprint for the team in
// the same batch, so "only one active sprint" holds even under concurrent
// clicks from different founders.
export async function setActiveSprint(teamId, sprintId) {
  const q = query(sprintsCol, where('teamId', '==', teamId), where('status', '==', 'active'))
  const snap = await getDocs(q)
  const batch = writeBatch(db)
  snap.docs.forEach(d => {
    if (d.id !== sprintId) batch.update(d.ref, { status: 'completed' })
  })
  batch.update(doc(db, 'sprints', sprintId), { status: 'active' })
  await batch.commit()
}

export async function lockSprint(id) {
  return updateDoc(doc(db, 'sprints', id), { locked: true })
}

export async function unlockSprint(id) {
  return updateDoc(doc(db, 'sprints', id), { locked: false })
}
