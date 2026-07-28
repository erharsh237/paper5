import { useState } from 'react'
import { submitForReview } from '../lib/deadlines'
import { createNotification, NOTIFICATION_TYPES } from '../lib/notifications'

const EVIDENCE_TYPES = [
  { key: 'pr', label: 'GitHub PR link' },
  { key: 'commit', label: 'GitHub commit link' },
  { key: 'screenshot', label: 'Screenshot (describe / link)' },
  { key: 'video', label: 'Video (describe / link)' },
  { key: 'notes', label: 'Notes' },
]

export default function EvidenceModal({ teamId, deadline, currentUser, onClose }) {
  const [evidenceType, setEvidenceType] = useState('pr')
  const [evidenceContent, setEvidenceContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!evidenceContent.trim()) return setError('Add a link, description, or notes as evidence.')
    if (!deadline.definitionOfDone?.trim()) {
      // Not a hard block — DoD is optional metadata in Phase 1 — but flag it
      // so founders notice it wasn't set.
    }
    setError('')
    setSubmitting(true)
    try {
      await submitForReview(deadline.id, {
        evidenceType,
        evidenceContent: evidenceContent.trim(),
        submittedBy: currentUser?.email,
      })
      await createNotification(teamId, {
        type: NOTIFICATION_TYPES.REVIEW_PENDING,
        message: `${currentUser?.displayName || currentUser?.email} submitted "${deadline.title}" for review`,
        deadlineId: deadline.id,
        forEmail: null, // any founder other than the assignee can review
        createdBy: currentUser?.email,
      })
      onClose()
    } catch (err) {
      console.error(err)
      setError('Could not submit for review. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label="Submit for review">
        <div className="modal-header">
          <h2>Submit for review</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          {deadline.definitionOfDone && (
            <div className="form-status form-status--pending">
              <strong>Definition of done:</strong> {deadline.definitionOfDone}
            </div>
          )}

          <div className="field">
            <label htmlFor="ev-type">Evidence type</label>
            <select id="ev-type" value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)}>
              {EVIDENCE_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>

          <div className="field">
            <label htmlFor="ev-content">Evidence</label>
            <textarea
              id="ev-content" rows={3} value={evidenceContent}
              onChange={(e) => setEvidenceContent(e.target.value)}
              placeholder="Paste the PR/commit link, or describe what was done…"
              autoFocus
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit for review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
