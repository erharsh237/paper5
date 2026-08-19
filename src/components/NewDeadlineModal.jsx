import { useState, useEffect, useMemo } from 'react'
import { createDeadline } from '../lib/deadlines'
import { sendDeadlineEmail } from '../lib/email'
import { PRIORITIES, EVIDENCE_TYPES } from '../lib/utils'
import { useWorkspace } from '../lib/WorkspaceContext'
import { subscribeSprints } from '../lib/sprints'
import { createNotification, NOTIFICATION_TYPES } from '../lib/notifications'

export default function NewDeadlineModal({ members, currentUser, activeSprint, sprints = [], onClose, title = 'New deadline', submitText = 'Create deadline' }) {
  const { workspaceId, canAddKanbanItems } = useWorkspace();
  const [titleInput, setTitleInput] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  
  const defaultMember = members.find(m => {
    const mEmail = (m.email || '').trim().toLowerCase()
    const myEmail = (currentUser?.email || '').trim().toLowerCase()
    const myId = currentUser?.id || currentUser?.uid
    return (mEmail && mEmail === myEmail) || (m.id === myId || m.userId === myId)
  }) || members[0]

  const isSprintOpen = (s) => s && s.status !== 'completed' && s.status !== 'closed' && (s.status === 'active' || s.status === 'planning')

  const [assigneeId, setAssigneeId] = useState(defaultMember?.id || '')
  const [selectedSprintId, setSelectedSprintId] = useState((activeSprint && isSprintOpen(activeSprint)) ? activeSprint.id : '')
  const [loadedSprints, setLoadedSprints] = useState(Array.isArray(sprints) ? sprints.filter(isSprintOpen) : [])
  const [dueDate, setDueDate] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('')
  const [requiredEvidence, setRequiredEvidence] = useState([])
  const [notifyEmail, setNotifyEmail] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [emailStatus, setEmailStatus] = useState(null) // null | 'sending' | 'sent' | 'failed' | 'skipped'
  const [error, setError] = useState('')

  useEffect(() => {
    if (!assigneeId && defaultMember?.id) {
      setAssigneeId(defaultMember.id)
    }
  }, [defaultMember, assigneeId])

  useEffect(() => {
    if (sprints && sprints.length > 0) {
      setLoadedSprints(sprints.filter(isSprintOpen))
    } else if (workspaceId) {
      const unsub = subscribeSprints(workspaceId, undefined, (all) => {
        setLoadedSprints((all || []).filter(isSprintOpen))
      })
      return () => unsub && unsub()
    }
  }, [workspaceId, sprints])

  const activeSprints = useMemo(() => {
    return (loadedSprints || []).filter(isSprintOpen)
  }, [loadedSprints])

  useEffect(() => {
    if (activeSprint?.id && isSprintOpen(activeSprint) && !selectedSprintId) {
      setSelectedSprintId(activeSprint.id)
    }
  }, [activeSprint])

  const assignee = members.find(m => m.id === assigneeId)
  const chosenSprint = loadedSprints.find(s => s.id === selectedSprintId)
  const sprintLocked = !!(chosenSprint?.locked || (!selectedSprintId && activeSprint?.locked))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (canAddKanbanItems === false) {
      return setError('Permission Denied: You do not have permission to add tasks in this workspace. Please ask an admin to grant you task management permissions.')
    }

    if (!titleInput.trim()) return setError('A title is required.')
    if (!dueDate) return setError('A valid due date is required.')

    const parsedDate = new Date(dueDate)
    if (isNaN(parsedDate.getTime())) {
      return setError('The provided due date format is invalid. Please select a valid date.')
    }

    if (!assignee) return setError('Please assign a team member.')
    if (!currentUser?.email) return setError('Ownership assignment failed: No email address is associated with your account.')
    if (sprintLocked) return setError('The selected sprint is locked. Unlock the sprint to add new items.')

    setSubmitting(true)
    try {
      const createdItem = await createDeadline(workspaceId, undefined, {
        title: titleInput.trim(),
        description: description.trim(),
        priority,
        dueDate: parsedDate.toISOString(),
        assigneeId: assignee.id,
        assigneeName: assignee.name || assignee.fullName || assignee.displayLabel || assignee.email || 'Member',
        assigneeEmail: assignee.email || '',
        createdBy: currentUser?.email,
        createdByName: currentUser?.displayName || currentUser?.email || 'Someone',
        sprintId: selectedSprintId || null,
        estimatedHours: estimatedHours === '' ? null : Number(estimatedHours),
        requiredEvidence: requiredEvidence.map(type => ({ type, status: 'pending' })),
      })

      // 1. In-App Notification (Notification Bell)
      const myEmail = (currentUser?.email || '').trim().toLowerCase()
      const myId = currentUser?.id || currentUser?.uid
      const assigneeEmail = (assignee?.email || '').trim().toLowerCase()
      const isSelf = (assigneeEmail && assigneeEmail === myEmail) || (assignee?.id && (assignee.id === myId || assignee.userId === myId))

      if (!isSelf && assigneeEmail) {
        try {
          await createNotification(workspaceId, undefined, {
            type: NOTIFICATION_TYPES.TASK_ASSIGNED,
            message: `${currentUser?.displayName || currentUser?.email || 'A team member'} assigned you a new deadline: "${titleInput.trim()}"`,
            deadlineId: createdItem?.id || null,
            forEmail: assigneeEmail,
            createdBy: currentUser?.email,
          })
        } catch (notifErr) {
          console.error('In-app notification creation error:', notifErr)
        }
      }

      if (notifyEmail && !isSelf && assigneeEmail) {
        setEmailStatus('sending')
        try {
          await sendDeadlineEmail({
            toName: assignee.name || assignee.fullName || assignee.displayLabel,
            toEmail: assigneeEmail,
            title: titleInput.trim(),
            description: description.trim(),
            dueDate: parsedDate.toLocaleString(undefined, {
              dateStyle: 'medium', timeStyle: 'short',
            }),
            priority,
            assignedBy: currentUser?.displayName || currentUser?.email || 'Team lead',
          })
          setEmailStatus('sent')
        } catch (err) {
          console.error('Email send error:', err)
          setEmailStatus('failed')
        }
      } else {
        setEmailStatus('skipped')
      }

      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (err) {
      console.error(err)
      setError('Failed to save. Please ensure your inputs are correct and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()} style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label={title} style={{ maxHeight: '90vh', overflowY: 'auto', margin: 'auto' }}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="title">Title</label>
            <input
              id="title" type="text" value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="e.g. Pen-test report — client Acme"
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="desc">Description</label>
            <textarea
              id="desc" value={description} rows={3}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope, links, context for the assignee..."
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="sprint-select">Sprint</label>
              <select
                id="sprint-select"
                value={selectedSprintId}
                onChange={(e) => setSelectedSprintId(e.target.value)}
              >
                <option value="">No Sprint (Backlog)</option>
                {activeSprints.map(s => (
                  <option key={s.id} value={s.id}>
                    Sprint {s.number}{s.goal ? ` — ${s.goal}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="assignee">Assign to</label>
              <select id="assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                {members.length === 0 && <option value="">No team members yet</option>}
                {members.map(m => {
                  const name = m.name || m.fullName || m.displayLabel || (m.email ? m.email.split('@')[0] : `Member (${(m.id || '').slice(0, 6)})`)
                  const email = m.email || ''
                  const displayText = name && email && name !== email ? `${name} (${email})` : (name || email || 'Member')
                  return (
                    <option key={m.id} value={m.id}>{displayText}</option>
                  )
                })}
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="priority">Priority</label>
              <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="est-hours">Estimated hours</label>
              <input
                id="est-hours" type="number" min="0" step="0.5" value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="e.g. 4"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="due">Due date & time</label>
            <input
              id="due" type="datetime-local" value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Required Evidence (Proof of Work)</label>
            <div className="checkbox-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
              {EVIDENCE_TYPES.map(ev => (
                <label key={ev.key} className="checkbox-row" style={{ fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={requiredEvidence.includes(ev.key)}
                    onChange={(e) => {
                      if (e.target.checked) setRequiredEvidence([...requiredEvidence, ev.key])
                      else setRequiredEvidence(requiredEvidence.filter(k => k !== ev.key))
                    }}
                  />
                  {ev.label}
                </label>
              ))}
            </div>
          </div>

          {activeSprint && (
            <div className="form-status form-status--pending">
              Will be added to Sprint {activeSprint.number}{sprintLocked ? ' — currently locked' : ''}.
            </div>
          )}
          {sprintLocked && (
            <div className="form-error">The active sprint is locked. Unlock it from the dashboard to add new tasks.</div>
          )}

          <label className="checkbox-row">
            <input
              type="checkbox" checked={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.checked)}
            />
            Email {assignee ? assignee.name : 'assignee'} the details now
          </label>

          {error && <div className="form-error">{error}</div>}

          {emailStatus === 'sending' && <div className="form-status form-status--pending">Sending notification email…</div>}
          {emailStatus === 'sent' && <div className="form-status form-status--ok">Deadline saved and email sent.</div>}
          {emailStatus === 'failed' && <div className="form-status form-status--warn">Deadline saved, but the email failed to send. Check EmailJS config.</div>}
          {emailStatus === 'skipped' && <div className="form-status form-status--warn">Deadline saved. Email sending isn't configured yet.</div>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting || members.length === 0 || sprintLocked}>
              {submitting ? 'Saving…' : submitText}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
