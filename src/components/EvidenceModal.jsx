import { useState } from 'react'
import { createPortal } from 'react-dom'
import { submitForReview } from '../lib/deadlines'
import { createNotification, NOTIFICATION_TYPES } from '../lib/notifications'
import { useWorkspace } from '../lib/WorkspaceContext'

import { EVIDENCE_TYPES } from '../lib/utils'

export default function EvidenceModal({ deadline, currentUser, onClose }) {
  const { workspaceId } = useWorkspace();
  const [evidenceType, setEvidenceType] = useState(EVIDENCE_TYPES[0].key)
  const [evidenceContent, setEvidenceContent] = useState('')
  const [repoName, setRepoName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!evidenceContent.trim()) return setError('Please provide a link, description, or detailed notes as evidence.')
    if ((evidenceType === 'pr' || evidenceType === 'commit') && !repoName) return setError('Please select a repository to proceed.')
    if (!deadline.definitionOfDone?.trim()) {
      // Not a hard block — DoD is optional metadata in Phase 1 — but flag it
      // so founders notice it wasn't set.
    }
    setError('')
    setSubmitting(true)
    try {
      await submitForReview(workspaceId, deadline.id, {
        evidenceType,
        evidenceContent: evidenceContent.trim(),
        repoName: (evidenceType === 'github_pr' || evidenceType === 'github_commit') ? repoName : null,
        submittedBy: currentUser?.email,
      })
      await createNotification(workspaceId, undefined, {
        type: NOTIFICATION_TYPES.REVIEW_PENDING,
        message: `${currentUser?.displayName || currentUser?.email} submitted "${deadline.title}" for review`,
        deadlineId: deadline.id,
        forEmail: null, // any founder other than the assignee can review
        createdBy: currentUser?.email,
      })
      onClose()
    } catch (err) {
      console.error(err)
      setError('Unable to submit evidence for review. Please verify your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
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

          {(evidenceType === 'github_pr' || evidenceType === 'github_commit') && (
            <div className="field">
              <label htmlFor="ev-repo">Repository</label>
              <select id="ev-repo" value={repoName} onChange={(e) => setRepoName(e.target.value)}>
                <option value="">Select a repository...</option>
                <option value="paper5">paper5</option>
                <option value="paper5-app">paper5-app</option>
              </select>
            </div>
          )}

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
    </div>,
    document.body
  )
}
