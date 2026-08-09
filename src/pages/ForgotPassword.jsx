import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import './Auth.css'
import { InlineError } from '../components/states'
import { validateEmail } from '../lib/validation'
import logo from '../assets/logo.png'
import Turnstile from '../components/Turnstile'

export default function ForgotPassword() {
  const { resetPassword, authError, clearAuthError } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const [turnstileToken, setTurnstileToken] = useState(null)
  const turnstileRef = useRef(null)

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
    <div className="auth-layout">
      <div className="auth-showcase-bg" aria-hidden="true" />

      <div className="auth-container" style={{ maxWidth: '440px', margin: '0 auto', padding: '40px 20px' }}>
        <div className="auth-card glass-panel" style={{ padding: '40px 32px' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <img src={logo} alt="Paper5 Logo" style={{ height: '36px', width: 'auto', marginBottom: '16px' }} />
            <h1 className="auth-title" style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px 0' }}>
              Reset Password
            </h1>
            <p className="auth-sub" style={{ fontSize: '14px', color: 'var(--text-secondary, #666)', margin: 0 }}>
              Enter your account email to receive a password reset link.
            </p>
          </div>

          {(error || authError) && (
            <div style={{ marginBottom: '20px' }}>
              <InlineError error={error || authError} />
            </div>
          )}

          {submitted ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ 
                background: 'rgba(15, 157, 99, 0.1)', 
                border: '1px solid rgba(15, 157, 99, 0.2)', 
                borderRadius: '8px', 
                padding: '16px', 
                marginBottom: '24px',
                color: 'var(--accent-signal, #0f9d63)',
                fontSize: '14px',
                lineHeight: 1.5
              }}>
                ✓ Check your inbox! We've sent password reset instructions to <strong>{email}</strong>.
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary, #888)', marginBottom: '20px' }}>
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <button 
                type="button" 
                className="btn-ghost" 
                onClick={() => setSubmitted(false)}
                style={{ width: '100%', marginBottom: '12px' }}
              >
                Resend Link
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
              <div className="auth-input-group" style={{ marginBottom: '24px' }}>
                <label htmlFor="reset-email" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>
                  Email Address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  className="auth-input"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  style={{ width: '100%' }}
                />
              </div>

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={loading || !email.trim()}
                style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 600 }}
              >
                {loading ? 'Sending Link...' : 'Send Reset Link'}
              </button>

              <Turnstile ref={turnstileRef} action="forgot-password" onSuccess={setTurnstileToken} />
            </form>
          )}

          <div style={{ marginTop: '24px', textAlign: 'center', borderTop: '1px solid var(--border-subtle, #eee)', paddingTop: '20px' }}>
            <Link to="/login" style={{ fontSize: '13px', color: 'var(--text-secondary, #555)', textDecoration: 'none', fontWeight: 500 }}>
              ← Back to Sign In
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
