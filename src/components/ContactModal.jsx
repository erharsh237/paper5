import { useState, useRef } from 'react'
import { useSubmitRateLimit } from '../hooks/useSubmitRateLimit'
import { trackEvent } from '../lib/metrics'
import Turnstile from './Turnstile'

export default function ContactModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('')
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    if (!email.trim() || !message.trim()) return
    if (message.trim().length < 5) {
      setError('Please enter a message of at least 5 characters.')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const response = await fetch('/api/public?action=contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email: email.trim(),
          subject: 'Contact Sales',
          message: message.trim(),
          website,
          turnstileToken,
          source: 'Paper5 Contact Sales'
        })
      })

      const data = await response.json().catch(() => ({}))
      if (response.ok) {
        setSubmitted(true)
        setEmail('')
        setMessage('')
        setWebsite('')
        trackEvent('contact_submit', { form_source: 'contact_sales_modal', subject: 'Contact Sales' })
      } else {
        throw new Error(data.error || 'Failed to send message.')
      }
    } catch (err) {
      console.error('Contact submit error:', err)
      if (turnstileRef.current) turnstileRef.current.reset()
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
      startCooldown()
    }
  }

  const handleClose = () => {
    setSubmitted(false)
    setError(null)
    onClose()
  }

  return (
    <>
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, backdropFilter: 'blur(4px)' }}
        onClick={handleClose}
      />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--bg-layer)', padding: '32px', borderRadius: '12px', zIndex: 1001, width: '100%', maxWidth: '400px', border: '1px solid var(--border)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>Contact Sales</h2>
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <p style={{ fontSize: '15px', marginBottom: '16px' }}>✅ Message sent! We'll get back to you shortly.</p>
            <button className="btn-primary" onClick={handleClose} style={{ width: '100%', justifyContent: 'center' }}>Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '13px', color: '#dc2626' }}>{error}</div>}
            <div style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }} aria-hidden="true">
              <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Email</label>
              <input
                type="email"
                name="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-layer-2)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Message</label>
              <textarea
                name="message"
                minLength={5}
                maxLength={3000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows="4"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-layer-2)', color: 'var(--text-primary)', resize: 'vertical', boxSizing: 'border-box' }}
                placeholder="How can we help you scale?"
              />
            </div>
            {hasTurnstileKey && (
              <Turnstile
                ref={turnstileRef}
                action="contact_sales"
                onSuccess={(tok) => setTurnstileToken(tok)}
                onExpire={() => setTurnstileToken('')}
              />
            )}
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button type="button" className="btn-ghost" onClick={handleClose} style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
              {isHardLocked ? (
                <button type="button" className="btn-primary" disabled style={{ flex: 1, justifyContent: 'center' }}>Too many attempts</button>
              ) : (
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting || isLockedOut}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {submitting ? 'Sending...' : isLockedOut ? `Wait ${cooldownRemaining}s` : 'Send Message'}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </>
  )
}
