import {
  collection, addDoc, updateDoc, doc,
  onSnapshot, query, where, orderBy, serverTimestamp, limit
} from 'firebase/firestore'
import { db } from './firebase'

const meetingsCol = collection(db, 'meetings')

// A meeting: { teamId, sprintId, date, notes: { reviewPrevious, demo, blockers, planNext, assign, lockSprint }, createdBy, createdAt, updatedAt }
export const AGENDA_STEPS = [
  { key: 'reviewPrevious', label: '1. Previous sprint review' },
  { key: 'demo', label: '2. Demo completed tasks' },
  { key: 'blockers', label: '3. Discuss blockers' },
  { key: 'planNext', label: '4. Plan next sprint' },
  { key: 'assign', label: '5. Assign tasks' },
  { key: 'lockSprint', label: '6. Lock sprint' },
]

export function subscribeMeetings(teamId, callback) {
  const q = query(meetingsCol, where('teamId', '==', teamId), orderBy('date', 'desc'), limit(30))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export async function createMeeting(teamId, { sprintId, date, createdBy }) {
  const emptyNotes = AGENDA_STEPS.reduce((acc, s) => ({ ...acc, [s.key]: '' }), {})
  return addDoc(meetingsCol, {
    teamId,
    sprintId: sprintId || null,
    date, // ISO date string
    notes: emptyNotes,
    createdBy: (createdBy || '').toLowerCase(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

// Notes auto-save per field so nobody loses work switching agenda steps.
export async function updateMeetingNote(id, stepKey, value) {
  return updateDoc(doc(db, 'meetings', id), {
    [`notes.${stepKey}`]: value,
    updatedAt: serverTimestamp(),
  })
}
