import { useState, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useSubmitRateLimit } from '../hooks/useSubmitRateLimit'
import { trackEvent } from '../lib/metrics'
import Turnstile from './Turnstile'
import './FeedbackModal.css'

const SENTIMENT_OPTIONS = [
  { value: '1', emoji: '😰', label: 'Terrible' },
  { value: '2', emoji: '😔', label: 'Bad' },
  { value: '3', emoji: '😑', label: 'Medium' },
  { value: '4', emoji: '🙂', label: 'Good' },
  { value: '5', emoji: '🥰', label: 'Awesome' }
]

export default function FeedbackModal({ isOpen, onClose }) {
  const { user } = useAuth()
  const [rating, setRating] = useState('3')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const turnstileRef = useRef(null)
  const hasTurnstileKey = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY)
  const { isLockedOut, isHardLocked, cooldownRemaining, startCooldown } = useSubmitRateLimit(30, 5)

  if (!isOpen) return null

  const activeMood = SENTIMENT_OPTIONS.find((item) => item.value === rating) || SENTIMENT_OPTIONS[2]

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    if (!message.trim()) {
      setError('Please add a comment before submitting.')
      return
    }
    if (message.trim().length < 3) {
      setError('Please enter at least 3 characters.')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const response = await fetch('/api/public?action=feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          name: (user?.displayName || 'Anonymous User').trim(),
          email: (user?.email || 'not-provided').trim(),
          category: 'General Feedback',
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
        trackEvent('form_submit', {
          form_source: 'feedback_modal',
          category: 'General Feedback',
          rating
        })
      } else {
        throw new Error(data.error || 'Failed to submit feedback.')
      }
    } catch (err) {
      console.error('Feedback submit error:', err)
      if (turnstileRef.current) turnstileRef.current.reset()
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
      startCooldown()
    }
  }

  const handleResetAndClose = () => {
    setSubmitted(false)
    setError(null)
    setRating('3')
    onClose()
  }

  return (
    <div className="feedback-modal-overlay" onClick={handleResetAndClose}>
      <div
        className="feedback-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-heading"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="feedback-topbar">
          <div className="feedback-topbar-brand">
            <span className="feedback-topbar-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </span>
            <span className="feedback-topbar-title">Feedback</span>
          </div>
          <button
            type="button"
            className="feedback-modal-close"
            onClick={handleResetAndClose}
            aria-label="Close modal"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="feedback-modal-body">
          {submitted ? (
            <div className="feedback-success-state">
              <div className="feedback-success-emoji" aria-hidden="true">
                {activeMood.emoji}
              </div>
              <h2 id="feedback-modal-heading">Thank you for your feedback!</h2>
              <p>Your response has been shared with the Paper5 team to help us improve your experience.</p>
              <button
                type="button"
                className="feedback-submit-btn"
                onClick={handleResetAndClose}
                style={{ marginTop: '24px' }}
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="feedback-form">
              <div className="feedback-modal-header">
                <h2 id="feedback-modal-heading">How are you feeling?</h2>
                <p>Your input is valuable in helping us better understand your needs and tailor our service accordingly.</p>
              </div>

              {error && <div className="feedback-error-banner">{error}</div>}

              <div className="feedback-emoji-track" role="group" aria-label="Experience rating">
                {SENTIMENT_OPTIONS.map((item) => {
                  const isSelected = rating === item.value
                  return (
                    <div key={item.value} className={`feedback-emoji-slot ${isSelected ? 'selected' : ''}`}>
                      <button
                        type="button"
                        className={`feedback-emoji-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => setRating(item.value)}
                        aria-label={`${item.label} (${item.value} out of 5)`}
                        aria-pressed={isSelected}
                      >
                        <span className="feedback-emoji-glyph" aria-hidden="true">{item.emoji}</span>
                      </button>
                      {isSelected && (
                        <span className="feedback-mood-pill">{item.label}</span>
                      )}
                    </div>
                  )
                })}
              </div>

              <div style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }} aria-hidden="true">
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a Comment..."
                aria-label="Add a comment"
                className="feedback-textarea"
                rows={4}
                minLength={3}
                maxLength={3000}
                required
              />

              {hasTurnstileKey && (
                <Turnstile
                  ref={turnstileRef}
                  action="feedback"
                  onSuccess={(tok) => setTurnstileToken(tok)}
                  onExpire={() => setTurnstileToken('')}
                />
              )}

              {isHardLocked ? (
                <button type="button" className="feedback-submit-btn" disabled>
                  Too many attempts
                </button>
              ) : (
                <button
                  type="submit"
                  className="feedback-submit-btn"
                  disabled={submitting || isLockedOut}
                >
                  {submitting
                    ? 'Submitting...'
                    : isLockedOut
                    ? `Wait ${cooldownRemaining}s`
                    : 'Submit Now'}
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
