import { useState } from 'react'
import { setBlocked } from '../lib/deadlines'
import { createNotification, NOTIFICATION_TYPES } from '../lib/notifications'

export default function BlockerModal({ teamId, deadline, currentUser, onClose }) {
  const [reason, setReason] = useState('')
  const [needHelpFrom, setNeedHelpFrom] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!reason.trim()) return setError('Reason is required.')
    setError('')
    setSubmitting(true)
    try {
      await setBlocked(deadline.id, {
        reason: reason.trim(),
        needHelpFrom: needHelpFrom.trim(),
        description: description.trim(),
      })
      await createNotification(teamId, {
        type: NOTIFICATION_TYPES.BLOCKER,
        message: `${currentUser?.displayName || currentUser?.email} blocked "${deadline.title}" — ${reason.trim()}`,
        deadlineId: deadline.id,
        forEmail: null, // broadcast to the whole team
        createdBy: currentUser?.email,
      })
      onClose()
    } catch (err) {
      console.error(err)
      setError('Could not save the blocker. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label="Report blocker">
        <div className="modal-header">
          <h2>Report blocker</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="blocker-reason">Reason</label>
            <input
              id="blocker-reason" type="text" value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Waiting on API credentials"
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="blocker-help">Need help from</label>
            <input
              id="blocker-help" type="text" value={needHelpFrom}
              onChange={(e) => setNeedHelpFrom(e.target.value)}
              placeholder="e.g. Kanishka"
            />
          </div>

          <div className="field">
            <label htmlFor="blocker-desc">Description</label>
            <textarea
              id="blocker-desc" rows={3} value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's blocking this and what's been tried…"
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Mark blocked & notify team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
