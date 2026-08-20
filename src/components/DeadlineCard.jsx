import { useState, useEffect } from 'react'
import { UrgencyBadge, PriorityBadge } from './Badge'
import { getUrgency, formatWorkspaceDate, STATUSES, EVIDENCE_TYPES } from '../lib/utils'
import {
  updateDeadlineStatus, addExtraWork, approveReview, rejectReview, clearBlocked,
  subscribeEvidence, subscribeExtraWork, deleteDeadline, claimDeadline
} from '../lib/deadlines'
import { createNotification, NOTIFICATION_TYPES } from '../lib/notifications'
import BlockerModal from './BlockerModal'
import EvidenceModal from './EvidenceModal'
import { useWorkspace } from '../lib/WorkspaceContext'
import './DeadlineCard.css'

export default function DeadlineCard({ deadline, currentUser, sprintLocked }) {
  const { workspaceId, workspace, workspaceRole } = useWorkspace();
  const isAdmin = workspaceRole === 'owner' || workspaceRole === 'admin'
  const [expanded, setExpanded] = useState(false)
  const [draftStatus, setDraftStatus] = useState(deadline.status)
  const [saving, setSaving] = useState(false)
  const [claiming, setClaiming] = useState(false)
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
  const due = formatWorkspaceDate(deadline.dueDate, workspace?.settings)
  
  const isUnassigned = !deadline.assigneeEmail || deadline.assigneeEmail === 'unassigned' || deadline.isUnassigned || deadline.assigneeName === 'Unassigned'
  const isAssignee = !isUnassigned && currentUser?.email &&
    deadline.assigneeEmail?.toLowerCase() === currentUser.email.toLowerCase()
  const canUpdateStatus = isAssignee
  const isDirty = draftStatus !== deadline.status
  const canReview = !isAssignee && !isUnassigned && deadline.status === 'review' && !!currentUser?.email
  const FREE_STATUSES = STATUSES.filter(s => ['not_started', 'in_progress'].includes(s.key))

  useEffect(() => {
    setDraftStatus(deadline.status)
  }, [deadline.status])

  useEffect(() => {
    if (!expanded) return
    const unsub1 = subscribeEvidence(workspaceId, deadline.id, setEvidence)
    const unsub2 = subscribeExtraWork(workspaceId, deadline.id, setExtraWork)
    return () => { unsub1(); unsub2() }
  }, [expanded, deadline.id, workspaceId])

  async function handleApprove() {
    setSaving(true)
    try {
      await approveReview(workspaceId, deadline.id, {
        reviewerId: currentUser?.uid || currentUser?.id,
        reviewerName: currentUser?.displayName || currentUser?.email,
      })
      if (deadline.assigneeEmail) {
        await createNotification(workspaceId, undefined, {
          type: NOTIFICATION_TYPES.TASK_APPROVED,
          message: `${currentUser?.displayName || currentUser?.email} approved your deadline: "${deadline.title}"`,
          deadlineId: deadline.id,
          forEmail: deadline.assigneeEmail,
          createdBy: currentUser?.email,
        })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleReject() {
    if (!rejectNote.trim()) return
    setSaving(true)
    try {
      await rejectReview(workspaceId, deadline.id, {
        reviewerId: currentUser?.uid || currentUser?.id,
        reviewerName: currentUser?.displayName || currentUser?.email,
        note: rejectNote.trim(),
      })
      if (deadline.assigneeEmail) {
        await createNotification(workspaceId, undefined, {
          type: NOTIFICATION_TYPES.REVIEW_REJECTED,
          message: `${currentUser?.displayName || currentUser?.email} sent back your deadline with note: "${rejectNote.trim()}"`,
          deadlineId: deadline.id,
          forEmail: deadline.assigneeEmail,
          createdBy: currentUser?.email,
        })
      }
      setShowRejectForm(false)
      setRejectNote('')
    } finally {
      setSaving(false)
    }
  }

  async function handleClearBlocker() {
    setSaving(true)
    try {
      await clearBlocked(workspaceId, deadline.id, 'in_progress')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddExtraWork() {
    const note = extraNote.trim()
    if (!note) return
    setSavingExtra(true)
    try {
      await addExtraWork(workspaceId, deadline.id, {
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

  async function handleDeleteDeadline(e) {
    e.stopPropagation()
    if (!isAdmin) return
    const confirmed = window.confirm(`Delete deadline "${deadline.title}"? This action cannot be undone.`)
    if (!confirmed) return
    try {
      await deleteDeadline(workspaceId, deadline.id)
    } catch (err) {
      console.error('Failed to delete deadline:', err)
      alert('Failed to delete deadline. Please try again.')
    }
  }

  const displayName = deadline.assigneeName?.includes('@') 
    ? deadline.assigneeName.split('@')[0] 
    : (deadline.assigneeName || 'Member')

  return (
    <div className={`dcard dcard--${urgency}`}>
      <div className="dcard-main" onClick={() => setExpanded(!expanded)}>
        
        {/* Top Header: Badges & Right Actions */}
        <div className="dcard-top">
          <div className="dcard-badges">
            {isUnassigned && (
              <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#D97706', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                ⚡ Open for Pickup
              </span>
            )}
            {urgency === 'overdue' && deadline.status !== 'done' && (
              <span className="badge badge--overdue">
                <span className="badge-dot" /> Overdue
              </span>
            )}
            {deadline.status === 'blocked' && (
              <span className="badge badge--overdue">
                <span className="badge-dot" /> Blocked
              </span>
            )}
            <PriorityBadge priority={deadline.priority} />
          </div>
          
          <div className="dcard-top-right">
            <span className="dcard-due mono" title={due.full}>{due.relative}</span>
            {sprintLocked && <span className="dcard-due mono" title="Sprint locked — deadline scope is frozen">🔒</span>}
            {isAdmin && (
              <button
                type="button"
                className="dcard-delete-btn"
                onClick={handleDeleteDeadline}
                title="Delete Deadline (Admin only)"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            )}
          </div>
        </div>

        <h3 className="dcard-title">{deadline.title}</h3>

        <div className="dcard-meta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <span className="dcard-assignee" title={deadline.assigneeEmail || deadline.assigneeName}>
              <span className="avatar-dot mono" style={{ background: isUnassigned ? '#F59E0B' : undefined, color: isUnassigned ? '#FFFFFF' : undefined }}>
                {isUnassigned ? '?' : (displayName[0]?.toUpperCase() || '?')}
              </span>
              <span className="dcard-assignee-name" style={{ color: isUnassigned ? '#D97706' : undefined, fontWeight: isUnassigned ? 600 : undefined }}>
                {displayName}
              </span>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {isUnassigned && currentUser?.email && (
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={claiming}
                onClick={async (e) => {
                  e.stopPropagation()
                  setClaiming(true)
                  setDraftStatus('in_progress')
                  try {
                    await claimDeadline(workspaceId, deadline.id, currentUser)
                    await createNotification(workspaceId, undefined, {
                      type: NOTIFICATION_TYPES.TASK_ASSIGNED || 'task_assigned',
                      message: `⚡ ${currentUser?.displayName || currentUser?.email} claimed task "${deadline.title}"`,
                      deadlineId: deadline.id,
                      forEmail: null,
                      createdBy: currentUser?.email,
                    })
                  } catch (err) {
                    console.error('Failed to claim task:', err)
                    setDraftStatus(deadline.status)
                  } finally {
                    setClaiming(false)
                  }
                }}
                style={{
                  padding: '2px 10px',
                  fontSize: '11.5px',
                  borderRadius: '6px',
                  background: '#4F46E5',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  border: 'none',
                  cursor: 'pointer'
                }}
                title="Assign this task to yourself"
              >
                {claiming ? 'Assigning...' : '✋ Assign to Me'}
              </button>
            )}
            <span className="dcard-date mono" title={due.full}>{due.short || due.full}</span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="dcard-expanded">
          {isUnassigned && currentUser?.email && (
            <div style={{ background: 'rgba(79, 70, 229, 0.05)', border: '1px dashed #4F46E5', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#4F46E5' }}>Task Available for Pickup</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary, #6E7091)', marginTop: '2px' }}>Click assign to take ownership of this deadline and lock it for others.</div>
              </div>
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={claiming}
                onClick={async (e) => {
                  e.stopPropagation()
                  setClaiming(true)
                  setDraftStatus('in_progress')
                  try {
                    await claimDeadline(workspaceId, deadline.id, currentUser)
                    await createNotification(workspaceId, undefined, {
                      type: NOTIFICATION_TYPES.TASK_ASSIGNED || 'task_assigned',
                      message: `⚡ ${currentUser?.displayName || currentUser?.email} claimed task "${deadline.title}"`,
                      deadlineId: deadline.id,
                      forEmail: null,
                      createdBy: currentUser?.email,
                    })
                  } catch (err) {
                    console.error('Failed to claim task:', err)
                    setDraftStatus(deadline.status)
                  } finally {
                    setClaiming(false)
                  }
                }}
                style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '6px', background: '#4F46E5', color: '#FFFFFF', fontWeight: 700, whiteSpace: 'nowrap', border: 'none', cursor: 'pointer' }}
              >
                {claiming ? 'Assigning...' : '✋ Assign to Me'}
              </button>
            </div>
          )}
          {deadline.description && <p className="dcard-desc">{deadline.description}</p>}

          {/* Required Evidence Box */}
          {deadline.requiredEvidence && deadline.requiredEvidence.length > 0 && (
            <div className="dcard-evidence-box">
              <div className="dcard-section-title">REQUIRED EVIDENCE</div>
              <div className="dcard-evidence-list">
                {deadline.requiredEvidence.map(req => {
                  const isSubmitted = evidence.some(ev => ev.type === req.type)
                  return (
                    <div key={req.type} className="dcard-evidence-item">
                      <span className={`dcard-evidence-check ${isSubmitted ? 'checked' : 'pending'}`}>
                        {isSubmitted ? '✓' : ''}
                      </span>
                      <span className="dcard-evidence-label">
                        {EVIDENCE_TYPES.find(t => t.key === req.type)?.label || req.type}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {deadline.status === 'blocked' && deadline.blockerInfo && (
            <div className="dcard-blocker">
              <div className="dcard-section-title" style={{ color: '#DC2626' }}>Blocked Reason</div>
              <p><strong>{deadline.blockerInfo.reason}</strong></p>
              {deadline.blockerInfo.needHelpFrom && <p>Needs help from: {deadline.blockerInfo.needHelpFrom}</p>}
              {deadline.blockerInfo.description && <p>{deadline.blockerInfo.description}</p>}
            </div>
          )}

          {deadline.status === 'review' && evidence.length > 0 && (
            <div className="dcard-blocker">
              <div className="dcard-section-title">Evidence submitted</div>
              {evidence.slice(-1).map((ev) => (
                <p key={ev.id}>
                  [{ev.type}] {ev.repoName ? `(${ev.repoName}) ` : ''}{ev.content}
                </p>
              ))}
            </div>
          )}

          {deadline.reviewNote && deadline.status === 'in_progress' && (
            <div className="dcard-blocker">
              <div className="dcard-section-title">Sent back by reviewer</div>
              <p>{deadline.reviewNote}</p>
            </div>
          )}

          {/* Controls & Actions */}
          <div className="dcard-controls">
            {canUpdateStatus && deadline.status !== 'blocked' && deadline.status !== 'review' && deadline.status !== 'done' ? (
              <div className="dcard-action-group">
                <div className="dcard-select-row">
                  <span className="dcard-control-label">Status</span>
                  <select
                    value={draftStatus}
                    onChange={async (e) => {
                      const newStatus = e.target.value
                      setDraftStatus(newStatus)
                      setSaving(true)
                      setStatusError(null)
                      try {
                        await updateDeadlineStatus(workspaceId, deadline.id, newStatus)
                      } catch (err) {
                        console.error('Failed to update status:', err)
                        setStatusError('Failed to update status.')
                        setDraftStatus(deadline.status)
                      } finally {
                        setSaving(false)
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    disabled={saving}
                    className="dcard-status-select"
                  >
                    {FREE_STATUSES.map(s => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div className="dcard-btn-row">
                  <button
                    type="button"
                    className="dcard-btn-blocked"
                    disabled={saving}
                    onClick={(e) => { e.stopPropagation(); setShowBlockerModal(true) }}
                  >
                    Mark Blocked
                  </button>
                  <button
                    type="button"
                    className="dcard-btn-review"
                    disabled={saving}
                    onClick={(e) => { e.stopPropagation(); setShowEvidenceModal(true) }}
                  >
                    Submit for Review →
                  </button>
                </div>
              </div>
            ) : canUpdateStatus && deadline.status === 'blocked' ? (
              <button
                type="button"
                className="dcard-btn-resume"
                disabled={saving}
                onClick={(e) => { e.stopPropagation(); handleClearBlocker() }}
              >
                Clear Blocker & Resume
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
                    <button type="button" className="dcard-btn-blocked" disabled={!rejectNote.trim() || saving} onClick={handleReject}>Send Back</button>
                    <button type="button" className="dcard-extraform-cancel" onClick={() => setShowRejectForm(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="dcard-btn-row">
                  <button type="button" className="dcard-btn-approve" disabled={saving} onClick={(e) => { e.stopPropagation(); handleApprove() }}>✓ Approve</button>
                  <button type="button" className="dcard-btn-reject" disabled={saving} onClick={(e) => { e.stopPropagation(); setShowRejectForm(true) }}>✕ Reject</button>
                </div>
              )
            ) : (
              <span className="dcard-status-readonly mono">
                {STATUSES.find(s => s.key === deadline.status)?.label || deadline.status}
              </span>
            )}
          </div>

          {statusError && <div className="form-error">{statusError}</div>}

          {/* Clean Footnote */}
          <div className="dcard-footnote">
            <span style={{ color: 'var(--muted-2)' }}>assigned by</span>
            <span className="dcard-creator-name" title={deadline.createdByName || deadline.createdBy}>
              {deadline.createdByName || deadline.createdBy || 'Team Lead'}
            </span>
          </div>

          {extraWork.length > 0 && (
            <div className="dcard-extrawork">
              <div className="dcard-section-title">Extra work logged</div>
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
                    type="button"
                    className="dcard-btn-save-note"
                    disabled={!extraNote.trim() || savingExtra}
                    onClick={handleAddExtraWork}
                  >
                    Save note
                  </button>
                  <button
                    type="button"
                    className="dcard-extraform-cancel"
                    onClick={() => { setShowExtraForm(false); setExtraNote('') }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
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
        <BlockerModal deadline={deadline} currentUser={currentUser} onClose={() => setShowBlockerModal(false)} />
      )}
      {showEvidenceModal && (
        <EvidenceModal deadline={deadline} currentUser={currentUser} onClose={() => setShowEvidenceModal(false)} />
      )}
    </div>
  )
}
