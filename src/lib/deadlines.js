import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp, where, Timestamp, limit
} from 'firebase/firestore'
import { db } from './firebase'

const deadlinesCol = collection(db, 'deadlines')
const membersCol = collection(db, 'members')

// ---- Deadlines ----

// Unbounded before — pulled the entire collection into every listener no
// matter how much history had piled up. Now capped at pageSize (default
// below); callers that want more call subscribeDeadlines again with a
// bigger pageSize (see useDeadlines.js), which just re-subscribes with a
// larger limit() rather than doing true cursor pagination — simpler to
// reason about alongside a realtime listener, at the cost of re-reading
// the first N docs on every "load more" (fine at this data volume).
export const DEADLINES_DEFAULT_PAGE_SIZE = 100

export function subscribeDeadlines(teamId, callback, pageSize = DEADLINES_DEFAULT_PAGE_SIZE) {
  const q = query(
    deadlinesCol,
    where('teamId', '==', teamId),
    orderBy('dueDate', 'asc'),
    limit(pageSize)
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
    assigneeEmail: (data.assigneeEmail || '').toLowerCase(),
    createdBy: (data.createdBy || '').toLowerCase(), // exact signed-in email — used for delete permission checks
    createdByName: data.createdByName, // display name shown in the UI
    createdAt: serverTimestamp(),
    percentComplete: 0,
    // ---- FounderOS Phase 1 additions (optional, backward-compatible) ----
    sprintId: data.sprintId || null,
    estimatedHours: data.estimatedHours ?? null,
    actualHours: data.actualHours ?? 0,
    dependencies: data.dependencies || [],
    labels: data.labels || [],
    definitionOfDone: data.definitionOfDone || '',
  })
}

export async function updateDeadline(id, patch) {
  return updateDoc(doc(db, 'deadlines', id), patch)
}

// Fields a locked sprint should block edits to. Anything not listed here
// (status, percentComplete, extraWork, actualHours) stays editable while
// locked, so day-to-day progress logging keeps working.
export const SPRINT_LOCKED_FIELDS = [
  'assigneeId', 'assigneeName', 'assigneeEmail',
  'dueDate', 'estimatedHours', 'sprintId', 'title', 'priority',
]

export function isSprintLockViolation(patch) {
  return Object.keys(patch).some(k => SPRINT_LOCKED_FIELDS.includes(k))
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
// work done beyond the original scope. Previously stored as an arrayUnion
// field on the parent deadline doc — that meant every list-view listener
// (Dashboard, MyDashboard) carried this ever-growing array for every task,
// even though it's only ever shown when a card is expanded. Moved to a
// subcollection so the list payload stays flat regardless of history;
// only fetched on demand (see subscribeExtraWork).
export async function addExtraWork(deadlineId, { note, addedBy, addedByName }) {
  return addDoc(collection(db, 'deadlines', deadlineId, 'extraWork'), {
    note,
    addedBy,
    addedByName,
    addedAt: serverTimestamp(),
  })
}

export function subscribeExtraWork(deadlineId, callback) {
  const q = query(collection(db, 'deadlines', deadlineId, 'extraWork'), orderBy('addedAt', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

// ---- FounderOS Phase 2: evidence-based completion + review ----
// A task cannot go straight to 'done'. The assignee submits at least one
// piece of evidence, which flips status to 'review'; a different founder
// then approves (-> done) or rejects (-> back to in_progress) it.
//
// Evidence moved to a subcollection for the same reason as extraWork above
// — it's unbounded over a task's lifetime and was previously loaded by
// every list-view listener whether or not the card was even expanded.

export async function submitForReview(id, { evidenceType, evidenceContent, submittedBy }) {
  await addDoc(collection(db, 'deadlines', id, 'evidence'), {
    type: evidenceType, // 'pr' | 'commit' | 'screenshot' | 'video' | 'notes'
    content: evidenceContent,
    submittedBy: (submittedBy || '').toLowerCase(),
    submittedAt: serverTimestamp(),
  })
  return updateDoc(doc(db, 'deadlines', id), {
    status: 'review',
    reviewerEmail: null,
    reviewerName: null,
    reviewNote: null,
  })
}

export function subscribeEvidence(deadlineId, callback) {
  const q = query(collection(db, 'deadlines', deadlineId, 'evidence'), orderBy('submittedAt', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export async function approveReview(id, { reviewerEmail, reviewerName }) {
  return updateDoc(doc(db, 'deadlines', id), {
    status: 'done',
    percentComplete: 100,
    reviewerEmail: (reviewerEmail || '').toLowerCase(),
    reviewerName,
    completedAt: Timestamp.now(),
  })
}

export async function rejectReview(id, { reviewerEmail, reviewerName, reviewNote }) {
  return updateDoc(doc(db, 'deadlines', id), {
    status: 'in_progress',
    reviewerEmail: (reviewerEmail || '').toLowerCase(),
    reviewerName,
    reviewNote: reviewNote || '',
  })
}

// ---- FounderOS Phase 2: blocker system ----
// Marking a task blocked requires structured context, not just a status
// flip, so the rest of the team can act on it.

export async function setBlocked(id, { reason, needHelpFrom, description }) {
  return updateDoc(doc(db, 'deadlines', id), {
    status: 'blocked',
    blockerInfo: {
      reason,
      needHelpFrom: needHelpFrom || '',
      description: description || '',
      blockedAt: Timestamp.now(),
    },
  })
}

export async function clearBlocked(id, nextStatus = 'in_progress') {
  return updateDoc(doc(db, 'deadlines', id), {
    status: nextStatus,
    blockerInfo: null,
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

export async function addMember(teamId, { name, email, addedBy }) {
  return addDoc(membersCol, {
    teamId, name, email,
    createdBy: (addedBy || '').toLowerCase(),
    createdAt: serverTimestamp(),
  })
}

export async function removeMember(id) {
  return deleteDoc(doc(db, 'members', id))
}
