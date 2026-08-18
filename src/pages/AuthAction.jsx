import { useEffect, useState, useRef, useMemo } from 'react'
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
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)

  const isVerifying = useRef(false)

  const pwdValidation = useMemo(() => validatePassword(newPassword), [newPassword])
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword

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
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onFocus={() => setIsPasswordFocused(true)}
                    placeholder="Min 8 chars (A-Z, a-z, 0-9, special)"
                    className="auth-input"
                    required
                    maxLength={72}
                    style={{ width: '100%', paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-secondary, #666)',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    )}
                  </button>
                </div>

                {/* Password Requirements Checklist */}
                {(isPasswordFocused || newPassword.length > 0) && (
                  <div style={{
                    marginTop: '10px',
                    padding: '12px 14px',
                    background: 'rgba(0, 0, 0, 0.03)',
                    border: '1px solid var(--border-subtle, #e5e7eb)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-secondary, #4b5563)', marginBottom: '2px' }}>
                      Password Requirements:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: pwdValidation.requirements.minLength ? '#10b981' : '#6b7280' }}>
                        <span style={{ fontWeight: 700 }}>{pwdValidation.requirements.minLength ? '✓' : '○'}</span>
                        <span>Min 8 characters</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: pwdValidation.requirements.hasUpper ? '#10b981' : '#6b7280' }}>
                        <span style={{ fontWeight: 700 }}>{pwdValidation.requirements.hasUpper ? '✓' : '○'}</span>
                        <span>Uppercase (A-Z)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: pwdValidation.requirements.hasLower ? '#10b981' : '#6b7280' }}>
                        <span style={{ fontWeight: 700 }}>{pwdValidation.requirements.hasLower ? '✓' : '○'}</span>
                        <span>Lowercase (a-z)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: pwdValidation.requirements.hasNumber ? '#10b981' : '#6b7280' }}>
                        <span style={{ fontWeight: 700 }}>{pwdValidation.requirements.hasNumber ? '✓' : '○'}</span>
                        <span>Number (0-9)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: pwdValidation.requirements.hasSpecial ? '#10b981' : '#6b7280' }}>
                        <span style={{ fontWeight: 700 }}>{pwdValidation.requirements.hasSpecial ? '✓' : '○'}</span>
                        <span>Special character</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="auth-label" style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Confirm New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="auth-input"
                    required
                    maxLength={72}
                    style={{ 
                      width: '100%', 
                      paddingRight: '40px',
                      borderColor: passwordsMismatch ? '#ef4444' : passwordsMatch ? '#10b981' : undefined
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-secondary, #666)',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    )}
                  </button>
                </div>

                {confirmPassword.length > 0 && (
                  <div style={{ marginTop: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: passwordsMatch ? '#10b981' : '#ef4444' }}>
                    <span>{passwordsMatch ? '✓ Passwords match' : '✕ Passwords do not match'}</span>
                  </div>
                )}
              </div>

              <button 
                type="submit" 
                className="auth-submit-btn" 
                disabled={!pwdValidation.valid || !passwordsMatch || status === 'processing'}
                style={{ width: '100%', justifyContent: 'center', marginTop: '8px', opacity: (!pwdValidation.valid || !passwordsMatch) ? 0.6 : 1 }}
              >
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
