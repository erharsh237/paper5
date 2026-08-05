import { useState } from 'react'
import { createDeadline } from '../lib/deadlines'
import { sendDeadlineEmail } from '../lib/email'
import { PRIORITIES, EVIDENCE_TYPES } from '../lib/utils'
import { useWorkspace } from '../lib/WorkspaceContext'

export default function NewDeadlineModal({ members, currentUser, activeSprint, onClose }) {
  const { workspaceId } = useWorkspace();
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [assigneeId, setAssigneeId] = useState(members[0]?.id || '')
  const [dueDate, setDueDate] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('')
  const [requiredEvidence, setRequiredEvidence] = useState([])
  const [notifyEmail, setNotifyEmail] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [emailStatus, setEmailStatus] = useState(null) // null | 'sending' | 'sent' | 'failed' | 'skipped'
  const [error, setError] = useState('')

  const assignee = members.find(m => m.id === assigneeId)
  const sprintLocked = !!activeSprint?.locked

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!title.trim()) return setError('A title is required to create a new deadline.')
    if (!dueDate) return setError('A valid due date is required for this deadline.')

    const parsedDate = new Date(dueDate)
    if (isNaN(parsedDate.getTime())) {
      return setError('The provided due date format is invalid. Please use the calendar picker to select a valid date.')
    }

    if (!assignee) return setError('Please assign a team member to this deadline.')
    if (!currentUser?.email) return setError('Ownership assignment failed: No email address is associated with your account.')
    if (sprintLocked) return setError('The current sprint is locked. Unlock the sprint to add new deadlines.')

    setSubmitting(true)
    try {
      await createDeadline(workspaceId, undefined, {
        title: title.trim(),
        description: description.trim(),
        priority,
        dueDate: parsedDate.toISOString(),
        assigneeId: assignee.id,
        assigneeName: assignee.name,
        assigneeEmail: assignee.email,
        createdBy: currentUser?.email,
        createdByName: currentUser?.displayName || currentUser?.email || 'Someone',
        sprintId: activeSprint?.id || null,
        estimatedHours: estimatedHours === '' ? null : Number(estimatedHours),
        requiredEvidence: requiredEvidence.map(type => ({ type, status: 'pending' })),
      })

      if (notifyEmail) {
        setEmailStatus('sending')
        try {
          await sendDeadlineEmail({
            toName: assignee.name,
            toEmail: assignee.email,
            title: title.trim(),
            description: description.trim(),
            dueDate: parsedDate.toLocaleString(undefined, {
              dateStyle: 'medium', timeStyle: 'short',
            }),
            priority,
            assignedBy: currentUser?.displayName || currentUser?.email || 'Team lead',
          })
          setEmailStatus('sent')
        } catch (err) {
          console.error(err)
          setEmailStatus('failed')
        }
      }

      if (!notifyEmail || emailStatus !== 'failed') {
        setTimeout(onClose, notifyEmail ? 700 : 0)
      }
    } catch (err) {
      console.error(err)
      setError('Failed to save the deadline. Please ensure your inputs are correct and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label="Create deadline">
        <div className="modal-header">
          <h2>New deadline</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="title">Title</label>
            <input
              id="title" type="text" value={title}
              onChange={(e) => setTitle(e.target.value)}
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
              <label htmlFor="assignee">Assign to</label>
              <select id="assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                {members.length === 0 && <option value="">No team members yet</option>}
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name} — {m.email}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="priority">Priority</label>
              <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="due">Due date & time</label>
              <input
                id="due" type="datetime-local" value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
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
              {submitting ? 'Saving…' : 'Create deadline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
