import { useState, useEffect } from 'react'
import { UrgencyBadge, PriorityBadge } from './Badge'
import { getUrgency, formatDue, STATUSES } from '../lib/utils'
import { updateDeadlineStatus, addExtraWork } from '../lib/deadlines'
import './DeadlineCard.css'

export default function DeadlineCard({ deadline, currentUser }) {
  const [expanded, setExpanded] = useState(false)
  const [draftStatus, setDraftStatus] = useState(deadline.status)
  const [saving, setSaving] = useState(false)
  const [showExtraForm, setShowExtraForm] = useState(false)
  const [extraNote, setExtraNote] = useState('')
  const [savingExtra, setSavingExtra] = useState(false)
  const urgency = getUrgency(deadline.dueDate, deadline.status)
  const due = formatDue(deadline.dueDate)
  const isAssignee = currentUser?.email && deadline.assigneeEmail === currentUser.email
  // Only the assignee moves their own progress.
  const canUpdateStatus = isAssignee
  const isDirty = draftStatus !== deadline.status

  // Keep the draft in sync if status changes elsewhere (other tab/device).
  useEffect(() => {
    setDraftStatus(deadline.status)
  }, [deadline.status])

  async function handleSaveUpdate() {
    if (!isDirty || draftStatus === 'done') return
    setSaving(true)
    try {
      await updateDeadlineStatus(deadline.id, draftStatus)
    } finally {
      setSaving(false)
    }
  }

  async function handleMarkComplete() {
    if (!confirm(`Mark "${deadline.title}" as done?`)) return
    setSaving(true)
    try {
      await updateDeadlineStatus(deadline.id, 'done')
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
          <div className="dcard-controls">
            {canUpdateStatus ? (
              <>
                <select
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  disabled={deadline.status === 'done' || saving}
                  className="dcard-status-select"
                >
                  {STATUSES.filter(s => s.key !== 'done').map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
                <button
                  className="dcard-update"
                  disabled={!isDirty || saving || deadline.status === 'done'}
                  onClick={(e) => { e.stopPropagation(); handleSaveUpdate() }}
                >
                  Update
                </button>
                {deadline.status !== 'done' && (
                  <button
                    className="dcard-complete"
                    disabled={saving}
                    onClick={(e) => { e.stopPropagation(); handleMarkComplete() }}
                  >
                    Mark Complete
                  </button>
                )}
              </>
            ) : (
              <span className="dcard-status-readonly mono">
                {STATUSES.find(s => s.key === deadline.status)?.label || deadline.status}
              </span>
            )}
          </div>
          <div className="dcard-footnote mono">assigned by {deadline.createdByName || deadline.createdBy}</div>

          {deadline.extraWork?.length > 0 && (
            <div className="dcard-extrawork">
              <div className="dcard-extrawork-title">Extra work logged</div>
              {deadline.extraWork.map((item, i) => (
                <div className="dcard-extrawork-item" key={i}>
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
    </div>
  )
}
