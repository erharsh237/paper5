import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import './Auth.css'

export default function VerifyEmail() {
  const { user, resendVerification, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const pendingEmail = location.state?.email || user?.email

  const handleResend = async () => {
    if (!pendingEmail) return
    setLoading(true)
    try {
      await resendVerification(pendingEmail)
      setMessage('Verification email sent! Check your inbox.')
    } catch (err) {
      console.error(err)
      setMessage('Failed to send verification email. Try again later.')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    if (user) {
      window.location.reload()
    } else {
      navigate('/login')
    }
  }

  if (!pendingEmail) {
    navigate('/login')
    return null
  }

  return (
    <div className="auth-layout">
      <div className="auth-showcase-bg" aria-hidden="true" />
      <div className="auth-form-side">
        <div className="auth-form-container glass-panel" style={{ textAlign: 'center' }}>
          <div className="auth-logo" style={{ justifyContent: 'center', marginBottom: 24, color: 'var(--text-primary)' }}>
            <span className="auth-logo-dot" />
            SprintOS
          </div>
        
        <h1>Verify your email</h1>
        
        <p className="auth-subtitle">
          We sent a verification link to <strong>{pendingEmail}</strong>. 
          Please click the link in that email to continue.
        </p>

        {message && (
          <div className="auth-success" style={{ marginBottom: '16px' }}>
            {message}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
          <button className="auth-submit-btn" onClick={handleRefresh} style={{ justifyContent: 'center' }}>
            I've verified my email (Refresh)
          </button>
          
          <button className="auth-submit-btn" onClick={handleResend} disabled={loading} style={{ justifyContent: 'center', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
            {loading ? 'Sending...' : 'Resend verification email'}
          </button>
          
          <button className="auth-submit-btn" onClick={logout} style={{ justifyContent: 'center', background: 'transparent', color: 'var(--text-tertiary)', border: 'none', boxShadow: 'none' }}>
            Sign out
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}
