import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { validatePassword } from '../lib/validation'
import './Auth.css'
import AlertModal from '../components/ui/AlertModal'

export default function AuthAction() {
  const [alertMessage, setAlertMessage] = useState(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // 1. Query params
  const tokenHash = searchParams.get('token_hash')
  const queryType = searchParams.get('type')
  const code = searchParams.get('code')

  // 2. Hash fragment params (#access_token=...&type=recovery)
  const hashParams = new URLSearchParams(window.location.hash.substring(1))
  const hashType = hashParams.get('type')
  const hashError = hashParams.get('error_description') || hashParams.get('error')

  const type = queryType || hashType || (window.location.hash.includes('recovery') ? 'recovery' : 'email')

  const [status, setStatus] = useState('processing')
  const [message, setMessage] = useState('Verifying link...')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  const isVerifying = useRef(false)

  useEffect(() => {
    // If hash contains error
    if (hashError) {
      setStatus('error')
      setMessage(decodeURIComponent(hashError).replace(/\+/g, ' '))
      return
    }

    // Listen to Supabase auth events (handles PKCE code exchange & recovery hash automatically)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && (type === 'recovery' || window.location.pathname.includes('reset')))) {
        setStatus('success')
        setMessage('Link verified. Please set your new password below.')
        setShowPasswordForm(true)
      }
    })

    const verifyLink = async () => {
      if (isVerifying.current) return
      isVerifying.current = true

      // 1. Check if user already has an active recovery session
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setStatus('success')
          setMessage('Link verified. Please set your new password below.')
          setShowPasswordForm(true)
          return
        }
      } catch (_) {}

      // 2. Try token verification attempts
      const rawToken = searchParams.get('token')
      const rawEmail = searchParams.get('email')
      const rawOtp = searchParams.get('otp')

      const payloadsToTry = []
      if (tokenHash) payloadsToTry.push({ token_hash: tokenHash, type: 'recovery' })
      if (rawToken) payloadsToTry.push({ token_hash: rawToken, type: 'recovery' })
      if (rawEmail && rawToken) payloadsToTry.push({ email: rawEmail, token: rawToken, type: 'recovery' })
      if (rawEmail && tokenHash) payloadsToTry.push({ email: rawEmail, token: tokenHash, type: 'recovery' })
      if (rawEmail && rawOtp) payloadsToTry.push({ email: rawEmail, token: rawOtp, type: 'recovery' })
      if (tokenHash) payloadsToTry.push({ token_hash: tokenHash, type: 'email' })

      for (const p of payloadsToTry) {
        try {
          const { data, error } = await supabase.auth.verifyOtp(p)
          if (!error && (data?.session || data?.user)) {
            setStatus('success')
            setMessage('Link verified. Please set your new password below.')
            setShowPasswordForm(true)
            return
          }
        } catch (_) {}
      }

      // 3. PKCE auth code in URL
      if (code) {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (!error && data?.session) {
            setStatus('success')
            setMessage('Link verified. Please set your new password below.')
            setShowPasswordForm(true)
            return
          }
        } catch (err) {
          console.warn('PKCE exchange error:', err)
        }
      }

      // 4. If all automated attempts failed, check session one last time
      try {
        const { data: { session: finalSession } } = await supabase.auth.getSession()
        if (finalSession) {
          setStatus('success')
          setMessage('Link verified. Please set your new password below.')
          setShowPasswordForm(true)
          return
        }
      } catch (_) {}

      setStatus('error')
      setMessage('Failed to verify link. The link may have expired or already been used.')
    }

    verifyLink()

    return () => {
      subscription.unsubscribe()
    }
  }, [tokenHash, queryType, code, hashError, type])

  const handleResetPassword = async (e) => {
    e.preventDefault()

    const pwdCheck = validatePassword(newPassword)
    if (!pwdCheck.valid) {
      setAlertMessage(`Password requirements not met: ${pwdCheck.errors.join(', ')}`)
      return
    }
    if (newPassword !== confirmPassword) {
      setAlertMessage('Passwords do not match.')
      return
    }

    setStatus('processing')
    setMessage('Updating your password...')

    try {
      // Update password directly using active session
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (updateError) throw updateError

      setShowPasswordForm(false)
      setStatus('success')
      setMessage('Your password has been reset successfully! Please sign in with your new password.')
    } catch (err) {
      console.error('Password reset error:', err)
      setStatus('error')
      setMessage(err?.message || 'Failed to reset password. Please try requesting a new reset link.')
      setShowPasswordForm(false)
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-showcase-bg" aria-hidden="true" />
      <div className="auth-form-side">
        <div className="auth-form-container glass-panel" style={{ textAlign: 'center', maxWidth: '440px', margin: '0 auto' }}>
          <div className="auth-logo" style={{ justifyContent: 'center', marginBottom: 24, color: 'var(--text-primary)' }}>
            <span className="auth-logo-dot" />
            Paper5 · SprintOS
          </div>

          <h1 style={{ marginTop: '16px', marginBottom: '16px', fontSize: '24px' }}>
            {type === 'recovery' || showPasswordForm ? 'Reset Your Password' : 'Email Verification'}
          </h1>

          {status === 'processing' && (
            <p className="auth-subtitle">{message}</p>
          )}

          {status === 'error' && (
            <div className="auth-error" style={{ marginBottom: '24px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '16px', borderRadius: '8px', color: '#ef4444' }}>
              {message}
            </div>
          )}

          {status === 'success' && !showPasswordForm && (
            <>
              <div className="auth-success" style={{ marginBottom: '24px', background: 'rgba(15, 157, 99, 0.1)', border: '1px solid rgba(15, 157, 99, 0.2)', padding: '16px', borderRadius: '8px', color: '#0f9d63' }}>
                {message}
              </div>
              <button
                className="auth-submit-btn"
                onClick={() => navigate('/login')}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Sign In
              </button>
            </>
          )}

          {showPasswordForm && (
            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px', textAlign: 'left' }}>
              <div>
                <label className="auth-label" style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 chars (A-Z, a-z, 0-9, special)"
                  className="auth-input"
                  required
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label className="auth-label" style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="auth-input"
                  required
                  style={{ width: '100%' }}
                />
              </div>
              <button type="submit" className="auth-submit-btn" style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
                Set New Password
              </button>
            </form>
          )}

          {status === 'error' && (
            <button
              className="btn-ghost"
              onClick={() => navigate('/login')}
              style={{ width: '100%', marginTop: '16px' }}
            >
              Return to Sign In
            </button>
          )}
        </div>
      </div>
      <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />
    </div>
  )
}
