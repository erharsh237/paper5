import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp, where, Timestamp, limit
} from 'firebase/firestore'
import { db } from './firebase'

const deadlinesCol = collection(db, 'deadlines')
const membersCol = collection(db, 'members')

// ---- Deadlines ----

// Pagination is handled by increasing the limit() in the query and re-subscribing,
// rather than using cursor pagination, to simplify realtime listener logic.
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

// Optional note an assignee can attach to their own deadline to log extra work.
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

// A task must be reviewed before being marked as done.
// The assignee submits evidence, changing the status to 'review'.
// A reviewer can then approve (-> done) or reject (-> in_progress).

export async function submitForReview(id, { evidenceType, evidenceContent, repoName, submittedBy }) {
  await addDoc(collection(db, 'deadlines', id, 'evidence'), {
    type: evidenceType, // 'pr' | 'commit' | 'screenshot' | 'video' | 'notes'
    content: evidenceContent,
    repoName: repoName || null,
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

// Marking a task blocked requires structured context so the rest of the team can act on it.

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
