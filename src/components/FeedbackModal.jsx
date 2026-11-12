import { useState, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useSubmitRateLimit } from '../hooks/useSubmitRateLimit'
import { trackEvent } from '../lib/metrics'
import Turnstile from './Turnstile'
import './FeedbackModal.css'

export default function FeedbackModal({ isOpen, onClose }) {
  const { user } = useAuth()
  const [category, setCategory] = useState('Feedback')
  const [rating, setRating] = useState('5')
  const [message, setMessage] = useState('')
  const [name, setName] = useState(user?.displayName || '')
  const [email, setEmail] = useState(user?.email || '')
  const [website, setWebsite] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const turnstileRef = useRef(null)
  const hasTurnstileKey = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY)
  const { isLockedOut, isHardLocked, cooldownRemaining, startCooldown } = useSubmitRateLimit(30, 5)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    if (!message.trim()) {
      setError('Please enter your feedback message.')
      return
    }
    if (message.trim().length < 3) {
      setError('Please enter at least 3 characters.')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name: (name || user?.displayName || 'Anonymous User').trim(),
          email: (email || user?.email || 'not-provided').trim(),
          category,
          rating,
          message: message.trim(),
          website,
          turnstileToken,
          source: 'Paper5 Application Feedback'
        })
      })

      const data = await response.json().catch(() => ({}))
      if (response.ok) {
        setSubmitted(true)
        setMessage('')
        setWebsite('')
        trackEvent('form_submit', { form_source: 'feedback_modal', category })
      } else {
        throw new Error(data.error || 'Failed to submit feedback.')
      }
    } catch (err) {
      console.error('Feedback submit error:', err)
      if (turnstileRef.current) turnstileRef.current.reset()
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
      startCooldown() // Start cooldown after every attempt (success or failure)
    }
  }

  const handleResetAndClose = () => {
    setSubmitted(false)
    setError(null)
    onClose()
  }

  return (
    <div className="feedback-modal-overlay" onClick={handleResetAndClose}>
      <div className="feedback-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="feedback-modal-close" onClick={handleResetAndClose} aria-label="Close modal">
          &times;
        </button>

        <div className="feedback-modal-header">
          <div className="feedback-icon-badge">💬</div>
          <h2>Share Your Feedback</h2>
          <p>Help us improve Paper5. We read every single message!</p>
        </div>

        {submitted ? (
          <div className="feedback-success-state">
            <div className="success-icon">🎉</div>
            <h3>Thank You!</h3>
            <p>Your feedback has been delivered to the Paper5 product team.</p>
            <button className="btn-primary w-full" onClick={handleResetAndClose} style={{ marginTop: '20px' }}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="feedback-form">
            {error && <div className="feedback-error-banner">{error}</div>}

            <div className="feedback-row-grid">
              <div className="form-group">
                <label className="feedback-label">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="feedback-input"
                >
                  <option value="Feature Request">💡 Feature Request</option>
                  <option value="Bug Report">🐛 Bug Report</option>
                  <option value="UI/UX Feedback">🎨 UI / UX Feedback</option>
                  <option value="General Feedback">💬 General Feedback</option>
                </select>
              </div>

              <div className="form-group">
                <label className="feedback-label">Experience Rating</label>
                <select
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  className="feedback-input"
                >
                  <option value="5">⭐⭐⭐⭐⭐ Excellent (5/5)</option>
                  <option value="4">⭐⭐⭐⭐ Good (4/5)</option>
                  <option value="3">⭐⭐⭐ Neutral (3/5)</option>
                  <option value="2">⭐⭐ Poor (2/5)</option>
                  <option value="1">⭐ Critical Issue (1/5)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="feedback-label" style={{ margin: 0 }}>Your Email</label>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary, #6b7280)', fontWeight: 500 }}>
                  🔒 Account Email
                </span>
              </div>
              <input
                type="email"
                value={user?.email || email || ''}
                readOnly
                tabIndex={-1}
                autoComplete="off"
                className="feedback-input"
                style={{
                  background: 'var(--surface-2, #f3f4f6)',
                  color: 'var(--text-primary, #111827)',
                  cursor: 'not-allowed',
                  opacity: 0.9,
                  borderColor: 'var(--border-subtle, #e5e7eb)',
                  boxShadow: 'none'
                }}
              />
            </div>

            <div className="form-group">
              <label className="feedback-label">Your Feedback / Feature Suggestion</label>
              <div style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }} aria-hidden="true">
                <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you love or what we can fix..."
                className="feedback-textarea"
                rows={4}
                minLength={3}
                maxLength={3000}
                required
              />
            </div>

            {hasTurnstileKey && (
              <Turnstile
                ref={turnstileRef}
                action="feedback"
                onSuccess={(tok) => setTurnstileToken(tok)}
                onExpire={() => setTurnstileToken('')}
              />
            )}

            <div className="feedback-actions">
              <button type="button" className="btn-ghost" onClick={handleResetAndClose}>
                Cancel
              </button>
              {isHardLocked ? (
                <button type="button" className="btn-primary" disabled>
                  Too many attempts
                </button>
              ) : (
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting || isLockedOut}
                >
                  {submitting
                    ? 'Sending...'
                    : isLockedOut
                    ? `Wait ${cooldownRemaining}s`
                    : 'Send Feedback'}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
