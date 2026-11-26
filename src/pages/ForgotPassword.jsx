import { useState, useRef, useEffect } from 'react'
import { Mail } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import './Auth.css'
import { InlineError } from '../components/states'
import { validateEmail } from '../lib/validation'
import Turnstile from '../components/Turnstile'
import ThemeToggle from '../components/ThemeToggle'; import SEOHead from '../components/SEOHead'

export default function ForgotPassword() {
  const { resetPassword, authError, clearAuthError } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const [turnstileToken, setTurnstileToken] = useState(null)
  const turnstileRef = useRef(null)

  useEffect(() => {
    clearAuthError()
    return () => clearAuthError()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const emailCheck = validateEmail(email)
    if (!emailCheck.valid) {
      setError(emailCheck.error)
      return
    }

    setError(null)
    clearAuthError()
    setLoading(true)

    try {
      const { error: resetErr } = await resetPassword(email.trim().toLowerCase())
      if (resetErr) throw resetErr
      setSubmitted(true)
    } catch (err) {
      console.error('Password reset error:', err)
      if (turnstileRef.current) turnstileRef.current.reset()
      setError(err?.message || 'Failed to send password reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-layout"><SEOHead title="Reset Password | Paper5" description="Reset the password for your Paper5 account." noIndex={true} />
      <a 
        href="https://paper5.co" 
        className="auth-back-to-website"
        onClick={(e) => {
          e.preventDefault()
          window.location.href = 'https://paper5.co'
        }}
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back to website
      </a>

      <div className="auth-top-actions">
        <ThemeToggle />
      </div>

      <div className="auth-showcase-bg" aria-hidden="true" />

      <div className="auth-container" style={{ maxWidth: '420px', margin: '0 auto', padding: '40px 20px' }}>
        <div className="reset-card">
          <div style={{ textAlign: 'center' }}>
            <div className="reset-icon-ring" aria-hidden="true">
              <div className="reset-icon-inner">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 10h-1V7a4 4 0 0 0-8 0v3H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2Zm-7-3a2 2 0 1 1 4 0v3h-4V7Zm3 9.73V18a1 1 0 1 1-2 0v-1.27a1.5 1.5 0 1 1 2 0Z" />
                </svg>
              </div>
            </div>
            <h1 className="reset-title">Reset Password</h1>
            <p className="reset-sub">Enter your email to reset your password.</p>
          </div>

          <hr className="reset-divider" />

          {(error || authError) && (
            <div style={{ marginBottom: '18px' }}>
              <InlineError error={error || authError} />
            </div>
          )}

          {submitted ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{
                background: 'rgba(15, 157, 99, 0.1)',
                border: '1px solid rgba(15, 157, 99, 0.2)',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '18px',
                color: 'var(--accent-signal, #0f9d63)',
                fontSize: '13.5px',
                lineHeight: 1.5
              }}>
                ✓ Check your inbox! We've sent password reset instructions to <strong>{email}</strong>.
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary, #888)', marginBottom: '18px' }}>
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <button
                type="button"
                className="reset-submit-btn"
                onClick={() => setSubmitted(false)}
              >
                Resend Link
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="reset-email" className="reset-label">
                  Email Address<span className="reset-required">*</span>
                </label>
                <div className="auth-input-with-icon">
                  <Mail size={16} className="auth-field-icon" aria-hidden="true" />
                  <input
                    id="reset-email"
                    type="email"
                    className="auth-input reset-input"
                    placeholder="hello@paper5.co"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                className="reset-submit-btn"
                disabled={loading || !email.trim()}
              >
                {loading ? 'Sending Link...' : 'Reset Password'}
              </button>

              <Turnstile ref={turnstileRef} action="forgot-password" onSuccess={setTurnstileToken} />
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
