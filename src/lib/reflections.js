import { doc, setDoc, onSnapshot, collection, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

const reflectionsCol = collection(db, 'reflections')

// One reflection per (sprint, founder) — deterministic doc id so re-submitting
// updates the same doc instead of creating duplicates.
function reflectionId(sprintId, email) {
  return `${sprintId}_${(email || '').toLowerCase()}`
}

export function subscribeReflections(teamId, sprintId, callback) {
  const q = query(reflectionsCol, where('teamId', '==', teamId), where('sprintId', '==', sprintId))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export async function submitReflection(teamId, sprintId, {
  memberEmail, memberName, completedTasks, whyNot, biggestBlocker, improvement,
}) {
  const id = reflectionId(sprintId, memberEmail)
  return setDoc(doc(db, 'reflections', id), {
    teamId,
    sprintId,
    memberEmail: (memberEmail || '').toLowerCase(),
    memberName,
    completedTasks,
    whyNot: whyNot || '',
    biggestBlocker: biggestBlocker || '',
    improvement: improvement || '',
    submittedAt: serverTimestamp(),
  })
}
