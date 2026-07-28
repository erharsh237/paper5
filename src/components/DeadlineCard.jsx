import { useState, useEffect } from 'react'
import { UrgencyBadge, PriorityBadge } from './Badge'
import { getUrgency, formatDue, STATUSES } from '../lib/utils'
import {
  updateDeadlineStatus, addExtraWork, approveReview, rejectReview, clearBlocked,
  subscribeEvidence, subscribeExtraWork,
} from '../lib/deadlines'
import { createNotification, NOTIFICATION_TYPES } from '../lib/notifications'
import BlockerModal from './BlockerModal'
import EvidenceModal from './EvidenceModal'
import './DeadlineCard.css'

export default function DeadlineCard({ deadline, currentUser, sprintLocked, teamId }) {
  const [expanded, setExpanded] = useState(false)
  const [draftStatus, setDraftStatus] = useState(deadline.status)
  const [saving, setSaving] = useState(false)
  const [showExtraForm, setShowExtraForm] = useState(false)
  const [extraNote, setExtraNote] = useState('')
  const [savingExtra, setSavingExtra] = useState(false)
  const [statusError, setStatusError] = useState(null)
  const [showBlockerModal, setShowBlockerModal] = useState(false)
  const [showEvidenceModal, setShowEvidenceModal] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [evidence, setEvidence] = useState([])
  const [extraWork, setExtraWork] = useState([])
  const urgency = getUrgency(deadline.dueDate, deadline.status)
  const due = formatDue(deadline.dueDate)
  const isAssignee = currentUser?.email &&
    deadline.assigneeEmail?.toLowerCase() === currentUser.email.toLowerCase()
  // Only the assignee moves their own progress.
  const canUpdateStatus = isAssignee
  const isDirty = draftStatus !== deadline.status
  // Any signed-in team member other than the assignee can review — the spec
  // just says "another founder approves," no fixed reviewer role.
  const canReview = !isAssignee && deadline.status === 'review' && !!currentUser?.email
  // Freely selectable transitions from the card's own dropdown. 'blocked'
  // and 'review'/'done' go through their dedicated flows below instead,
  // since both require structured info the plain dropdown can't capture.
  const FREE_STATUSES = STATUSES.filter(s => ['not_started', 'in_progress'].includes(s.key))

  // Keep the draft in sync if status changes elsewhere (other tab/device).
  useEffect(() => {
    setDraftStatus(deadline.status)
  }, [deadline.status])

  // Evidence and extra-work notes live in subcollections now (see
  // deadlines.js) instead of arrays on the parent doc, specifically so the
  // list-view listener every page keeps open doesn't carry them. Only
  // subscribe once the card is actually expanded, and drop the listener
  // again on collapse — no reason to hold N extra realtime listeners open
  // for cards nobody's looking at.
  useEffect(() => {
    if (!expanded) return
    const unsub1 = subscribeEvidence(deadline.id, setEvidence)
    const unsub2 = subscribeExtraWork(deadline.id, setExtraWork)
    return () => { unsub1(); unsub2() }
  }, [expanded, deadline.id])

  async function handleSaveUpdate() {
    if (!isDirty) return
    setSaving(true)
    setStatusError(null)
    try {
      await updateDeadlineStatus(deadline.id, draftStatus)
    } catch (err) {
      console.error('Failed to update status:', err)
      setStatusError(
        err?.code === 'permission-denied'
          ? "You don't have permission to update this — check you're the assignee and rules are deployed."
          : 'Update failed. Please try again.'
      )
      setDraftStatus(deadline.status) // revert visibly, don't leave it hanging
    } finally {
      setSaving(false)
    }
  }

  async function handleClearBlocker() {
    setSaving(true)
    setStatusError(null)
    try {
      await clearBlocked(deadline.id, 'in_progress')
    } catch (err) {
      console.error(err)
      setStatusError('Could not clear the blocker. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleApprove() {
    if (!confirm(`Approve "${deadline.title}" as done?`)) return
    setSaving(true)
    try {
      await approveReview(deadline.id, { reviewerEmail: currentUser.email, reviewerName: currentUser.displayName || currentUser.email })
      await createNotification(teamId, {
        type: NOTIFICATION_TYPES.TASK_APPROVED,
        message: `${currentUser?.displayName || currentUser?.email} approved "${deadline.title}"`,
        deadlineId: deadline.id,
        forEmail: deadline.assigneeEmail,
        createdBy: currentUser?.email,
      })
    } catch (err) {
      console.error(err)
      setStatusError('Could not approve. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleReject() {
    if (!rejectNote.trim()) return
    setSaving(true)
    try {
      await rejectReview(deadline.id, {
        reviewerEmail: currentUser.email,
        reviewerName: currentUser.displayName || currentUser.email,
        reviewNote: rejectNote.trim(),
      })
      await createNotification(teamId, {
        type: NOTIFICATION_TYPES.REVIEW_REJECTED,
        message: `${currentUser?.displayName || currentUser?.email} sent "${deadline.title}" back — ${rejectNote.trim()}`,
        deadlineId: deadline.id,
        forEmail: deadline.assigneeEmail,
        createdBy: currentUser?.email,
      })
      setRejectNote('')
      setShowRejectForm(false)
    } catch (err) {
      console.error(err)
      setStatusError('Could not send back. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddExtraWork() {
    const note = extraNote.trim()
    if (!note) return
    setSavingExtra(true)
    try {
      await addExtraWork(deadline.id, {
        note,
        addedBy: currentUser?.email,
        addedByName: currentUser?.displayName || currentUser?.email,
      })
      setExtraNote('')
      setShowExtraForm(false)
    } finally {
      setSavingExtra(false)
    }
  }



  return (
    <div className={`dcard dcard--${urgency}`}>
      <div className="dcard-main" onClick={() => setExpanded(!expanded)}>
        <div className="dcard-top">
          <div className="dcard-badges">
            <UrgencyBadge urgency={urgency} status={deadline.status} />
            <PriorityBadge priority={deadline.priority} />
          </div>
          <span className="dcard-due mono">{due.relative}</span>
          {sprintLocked && <span className="dcard-due mono" title="Sprint locked — deadline, owner, priority, and estimate are frozen">🔒</span>}
        </div>

        <h3 className="dcard-title">{deadline.title}</h3>

        <div className="dcard-meta">
          <span className="dcard-assignee">
            <span className="avatar-dot mono">{deadline.assigneeName?.[0]?.toUpperCase() || '?'}</span>
            {deadline.assigneeName}
          </span>
          <span className="dcard-date mono">{due.full}</span>
        </div>
      </div>

      {expanded && (
        <div className="dcard-expanded">
          {deadline.description && <p className="dcard-desc">{deadline.description}</p>}

          {deadline.status === 'blocked' && deadline.blockerInfo && (
            <div className="dcard-blocker">
              <div className="dcard-extrawork-title">Blocked</div>
              <p><strong>{deadline.blockerInfo.reason}</strong></p>
              {deadline.blockerInfo.needHelpFrom && <p>Needs help from: {deadline.blockerInfo.needHelpFrom}</p>}
              {deadline.blockerInfo.description && <p>{deadline.blockerInfo.description}</p>}
            </div>
          )}

          {deadline.status === 'review' && evidence.length > 0 && (
            <div className="dcard-blocker">
              <div className="dcard-extrawork-title">Evidence submitted</div>
              {evidence.slice(-1).map((ev) => (
                <p key={ev.id}>[{ev.type}] {ev.content}</p>
              ))}
            </div>
          )}

          {deadline.reviewNote && deadline.status === 'in_progress' && (
            <div className="dcard-blocker">
              <div className="dcard-extrawork-title">Sent back by reviewer</div>
              <p>{deadline.reviewNote}</p>
            </div>
          )}

          <div className="dcard-controls">
            {canUpdateStatus && deadline.status !== 'blocked' && deadline.status !== 'review' && deadline.status !== 'done' ? (
              <>
                <select
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  disabled={saving}
                  className="dcard-status-select"
                >
                  {FREE_STATUSES.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
                <button
                  className="dcard-update"
                  disabled={!isDirty || saving}
                  onClick={(e) => { e.stopPropagation(); handleSaveUpdate() }}
                >
                  Update
                </button>
                <button
                  className="dcard-delete"
                  disabled={saving}
                  onClick={(e) => { e.stopPropagation(); setShowBlockerModal(true) }}
                >
                  Mark blocked
                </button>
                <button
                  className="dcard-complete"
                  disabled={saving}
                  onClick={(e) => { e.stopPropagation(); setShowEvidenceModal(true) }}
                >
                  Submit for review
                </button>
              </>
            ) : canUpdateStatus && deadline.status === 'blocked' ? (
              <button
                className="dcard-update"
                disabled={saving}
                onClick={(e) => { e.stopPropagation(); handleClearBlocker() }}
              >
                Clear blocker & resume
              </button>
            ) : canReview ? (
              showRejectForm ? (
                <div className="dcard-extraform" onClick={(e) => e.stopPropagation()}>
                  <textarea
                    className="dcard-extraform-input"
                    placeholder="Why is this going back?"
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    rows={2}
                  />
                  <div className="dcard-extraform-actions">
                    <button className="dcard-update" disabled={!rejectNote.trim() || saving} onClick={handleReject}>Send back</button>
                    <button className="dcard-extraform-cancel" onClick={() => setShowRejectForm(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <button className="dcard-complete" disabled={saving} onClick={(e) => { e.stopPropagation(); handleApprove() }}>Approve</button>
                  <button className="dcard-delete" disabled={saving} onClick={(e) => { e.stopPropagation(); setShowRejectForm(true) }}>Reject</button>
                </>
              )
            ) : (
              <span className="dcard-status-readonly mono">
                {STATUSES.find(s => s.key === deadline.status)?.label || deadline.status}
              </span>
            )}
          </div>

          {statusError && <div className="form-error">{statusError}</div>}

          <div className="dcard-footnote mono">assigned by {deadline.createdByName || deadline.createdBy}</div>

          {extraWork.length > 0 && (
            <div className="dcard-extrawork">
              <div className="dcard-extrawork-title">Extra work logged</div>
              {extraWork.map((item) => (
                <div className="dcard-extrawork-item" key={item.id}>
                  <p>{item.note}</p>
                  <span className="mono">— {item.addedByName || item.addedBy}</span>
                </div>
              ))}
            </div>
          )}

          {isAssignee && (
            showExtraForm ? (
              <div className="dcard-extraform" onClick={(e) => e.stopPropagation()}>
                <textarea
                  className="dcard-extraform-input"
                  placeholder="Describe the extra work you did…"
                  value={extraNote}
                  onChange={(e) => setExtraNote(e.target.value)}
                  rows={2}
                />
                <div className="dcard-extraform-actions">
                  <button
                    className="dcard-update"
                    disabled={!extraNote.trim() || savingExtra}
                    onClick={handleAddExtraWork}
                  >
                    Save note
                  </button>
                  <button
                    className="dcard-extraform-cancel"
                    onClick={() => { setShowExtraForm(false); setExtraNote('') }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="dcard-add-extra"
                onClick={(e) => { e.stopPropagation(); setShowExtraForm(true) }}
              >
                + Log extra work
              </button>
            )
          )}
        </div>
      )}

      {showBlockerModal && (
        <BlockerModal teamId={teamId} deadline={deadline} currentUser={currentUser} onClose={() => setShowBlockerModal(false)} />
      )}
      {showEvidenceModal && (
        <EvidenceModal teamId={teamId} deadline={deadline} currentUser={currentUser} onClose={() => setShowEvidenceModal(false)} />
      )}
    </div>
  )
}
