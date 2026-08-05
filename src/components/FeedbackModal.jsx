import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import './FeedbackModal.css'

export default function FeedbackModal({ isOpen, onClose }) {
  const { user } = useAuth()
  const [category, setCategory] = useState('Feedback')
  const [rating, setRating] = useState('5')
  const [message, setMessage] = useState('')
  const [name, setName] = useState(user?.displayName || '')
  const [email, setEmail] = useState(user?.email || '')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!message.trim()) {
      setError('Please enter your feedback message.')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const response = await fetch('https://formspree.io/f/xwlekeea', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name: name || user?.displayName || 'Anonymous User',
          email: email || user?.email || 'not-provided',
          category,
          rating: `${rating} / 5 Stars`,
          message,
          source: 'SprintOS Application Feedback'
        })
      })

      if (response.ok) {
        setSubmitted(true)
        setMessage('')
      } else {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit feedback.')
      }
    } catch (err) {
      console.error('Feedback submit error:', err)
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
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
          <p>Help us improve SprintOS. We read every single message!</p>
        </div>

        {submitted ? (
          <div className="feedback-success-state">
            <div className="success-icon">🎉</div>
            <h3>Thank You!</h3>
            <p>Your feedback has been delivered to the SprintOS product team.</p>
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
              <label className="feedback-label">Your Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="feedback-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="feedback-label">Your Feedback / Feature Suggestion</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you love or what we can fix..."
                className="feedback-textarea"
                rows={4}
                required
              />
            </div>

            <div className="feedback-actions">
              <button type="button" className="btn-ghost" onClick={handleResetAndClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Sending...' : 'Send Feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
