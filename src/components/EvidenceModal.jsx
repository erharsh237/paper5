import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { submitForReview } from '../lib/deadlines'
import { createNotification, NOTIFICATION_TYPES } from '../lib/notifications'
import { useWorkspace } from '../lib/WorkspaceContext'

import { EVIDENCE_TYPES } from '../lib/utils'

export default function EvidenceModal({ deadline, currentUser, onClose }) {
  const { workspaceId } = useWorkspace();

  // Extract required types configured when the deadline was created
  const requiredTypesList = useMemo(() => {
    const raw = deadline?.requiredEvidence || deadline?.required_evidence || []
    return raw.map(item => typeof item === 'string' ? item : item.type).filter(Boolean)
  }, [deadline])

  // Filter available evidence types to the configured required types if specified
  const availableOptions = useMemo(() => {
    if (requiredTypesList.length > 0) {
      const filtered = EVIDENCE_TYPES.filter(t => requiredTypesList.includes(t.key))
      if (filtered.length > 0) return filtered
    }
    return EVIDENCE_TYPES
  }, [requiredTypesList])

  const [evidenceType, setEvidenceType] = useState(
    availableOptions[0]?.key || EVIDENCE_TYPES[0].key
  )
  const [evidenceContent, setEvidenceContent] = useState('')
  const [repoName, setRepoName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!evidenceContent.trim()) return setError('Please provide a link, description, or detailed notes as evidence.')
    if ((evidenceType === 'github_pr' || evidenceType === 'github_commit') && !repoName) return setError('Please select a repository to proceed.')
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

          {/* If exactly 1 evidence type was required during creation, lock and display it */}
          {availableOptions.length === 1 ? (
            <div className="field">
              <label>Evidence type</label>
              <div style={{
                background: 'var(--surface-2, #F8FAFC)',
                border: '1px solid var(--border-soft, #E2E8F0)',
                borderRadius: '8px',
                padding: '9px 12px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--accent, #4F46E5)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '11px', background: 'var(--accent-dim, rgba(79, 70, 229, 0.08))', padding: '2px 8px', borderRadius: '4px' }}>Required</span>
                <span>{availableOptions[0]?.label || availableOptions[0]?.key}</span>
              </div>
            </div>
          ) : (
            <div className="field">
              <label htmlFor="ev-type">Evidence type</label>
              <select id="ev-type" value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)}>
                {availableOptions.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
          )}

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
