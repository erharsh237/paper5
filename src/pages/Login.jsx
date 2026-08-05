import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import './Auth.css'
import { InlineError } from '../components/states'

const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email;
  const [name, domain] = email.split('@');
  if (name.length <= 2) return `${name[0]}***@${domain}`;
  return `${name.substring(0, 2)}***${name.substring(name.length - 1)}@${domain}`;
}

import { getMainUrl } from '../lib/domain'
import { validateRequestHeaders, checkAccountLockout, recordFailedAttempt, resetSecurityState, checkIpBlocked } from '../lib/security'

export default function Login({ accessDenied, denialReason }) {
  const { 
    loginWithUsernameOrEmail, 
    sendLoginOtp, 
    verifyOtp,
    logout,
    setIsPending2FA,
    authError, 
    clearAuthError,
    userData
  } = useAuth()
  
  const navigate = useNavigate()
  
  const [step, setStep] = useState(1) // 1: Password, 2: OTP
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [verifiedEmail, setVerifiedEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showOtp, setShowOtp] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockoutTimer, setLockoutTimer] = useState(0)
  const [displayError, setDisplayError] = useState(null)

  useEffect(() => {
    if (authError) setDisplayError(authError)
    else setDisplayError(null)
  }, [authError])

  useEffect(() => {
    let timer
    if (lockoutTimer > 0) {
      timer = setInterval(() => {
        setLockoutTimer(t => {
          if (t <= 1) {
            setFailedAttempts(0)
            return 0
          }
          return t - 1
        })
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [lockoutTimer])

  useEffect(() => {
    if (!displayError) return
    const match = displayError.match(/after (\d+) seconds?/)
    if (match) {
      const seconds = parseInt(match[1], 10)
      if (seconds > 0) {
        const timer = setTimeout(() => {
          const newSeconds = seconds - 1
          if (newSeconds <= 0) {
            setDisplayError(null)
            clearAuthError()
          } else {
            setDisplayError(displayError.replace(`after ${seconds} second${seconds === 1 ? '' : 's'}`, `after ${newSeconds} second${newSeconds === 1 ? '' : 's'}`))
          }
        }, 1000)
        return () => clearTimeout(timer)
      }
    }
  }, [displayError, clearAuthError])

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown(c => c - 1), 1000)
    }
    return () => clearInterval(timer)
  }, [cooldown])

  useEffect(() => {
    clearAuthError()
  }, [])

  const handlePasswordLogin = async () => {
    try {
      // 1. Header Validation
      validateRequestHeaders()

      // 2. IP Blocking Check
      checkIpBlocked()

      // 3. Persistent Account Lockout Check
      const lockoutStatus = checkAccountLockout(identifier)
      if (lockoutStatus.isLocked) {
        setLockoutTimer(lockoutStatus.remainingSeconds)
        setMessage(lockoutStatus.message)
        return
      }
    } catch (secErr) {
      setMessage(secErr.message)
      return
    }

    setLoading(true)
    setMessage('')
    clearAuthError()
    
    try {
      if (!identifier || !password) {
        setMessage('Please enter your credentials.')
        setLoading(false)
        return
      }

      // Flag pending 2FA so App.jsx router does NOT unmount Login or navigate away
      setIsPending2FA(true)

      // 1. Verify password (Factor 1)
      const data = await loginWithUsernameOrEmail(identifier, password)
      const userEmail = data.user.email

      // 2. Trigger OTP (Factor 2)
      await sendLoginOtp(userEmail)
      
      setVerifiedEmail(userEmail)
      setMessage('Password verified. A 2FA code has been sent to your email.')
      setStep(2)
      setCooldown(60)
      setFailedAttempts(0)
      resetSecurityState(identifier)
    } catch (err) {
      setIsPending2FA(false)
      const result = recordFailedAttempt(identifier)
      setFailedAttempts(result.failedAttempts)
      if (result.lockoutSeconds > 0) {
        setLockoutTimer(result.lockoutSeconds)
        setMessage(`Account temporarily locked for ${result.lockoutSeconds} seconds due to repeated failed attempts.`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleOtpVerification = async (e) => {
    if (e) e.preventDefault()
    setLoading(true)
    setMessage('')
    clearAuthError()
    
    try {
      if (otp.length < 6) {
        setMessage('Please enter a valid code.')
        setLoading(false)
        return
      }
      
      // Verify OTP. This will fully authenticate the user and complete 2FA.
      await verifyOtp(verifiedEmail, otp)
      
      // Clear 2FA flag so App.jsx redirects to /workspace
      setIsPending2FA(false)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-layout">
      <a href={getMainUrl('/')} style={{ position: 'absolute', top: '32px', left: '32px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#666', textDecoration: 'none', fontWeight: 500 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back to website
      </a>
      
      <div className="auth-form-side">
        <div className="auth-form-container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '24px', color: '#111', fontWeight: 600, fontSize: '18px' }}>
            <div style={{ width: '24px', height: '24px', background: '#111', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fff' }} />
            </div>
            SprintOS
          </div>
          <h1>Welcome back</h1>
          <p className="auth-subtitle">Login to your account</p>

          {accessDenied && (
            <div style={{ marginBottom: 24 }}>
              <InlineError error={`Access Denied: ${denialReason || "You don't have access to this page."}`} />
            </div>
          )}

          {displayError && (
            <div style={{ marginBottom: 24 }}>
              <InlineError error={`Error: ${displayError}`} />
            </div>
          )}

          {message && (message.includes('Code') || message.includes('verified') || message.includes('Test account')) ? (
            <div className="auth-success">
              {message}
            </div>
          ) : message && (
            <div style={{ marginBottom: 24 }}>
              <InlineError error={message} />
            </div>
          )}

          <form onSubmit={step === 2 ? handleOtpVerification : (e) => e.preventDefault()} style={{ textAlign: 'left' }}>
            <div className="auth-input-group">
              <label htmlFor="identifier">Email</label>
              <input 
                id="identifier"
                type="text" 
                className="auth-input"
                placeholder="m@example.com"
                value={identifier}
                onChange={e => setIdentifier(e.target.value.toLowerCase())}
                required
                disabled={step > 1}
                autoComplete="username"
              />
            </div>
            
            <div className="auth-input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label htmlFor="password" style={{ marginBottom: 0 }}>Password</label>
                <Link to="/forgot-password" style={{ fontSize: '13px', color: '#111', textDecoration: 'none', fontWeight: 500 }}>
                  Forgot your password?
                </Link>
              </div>
              <div style={{ position: 'relative' }}>
                <input 
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder=""
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={step > 1}
                  autoComplete="current-password"
                  style={{ width: '100%', paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#666',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  disabled={step > 1}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
            </div>

            {step === 1 && (
              <button type="button" className="auth-submit-btn" onClick={handlePasswordLogin} disabled={loading || !identifier || !password}>
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            )}

            <div style={{ marginTop: '24px', opacity: step < 2 ? 0.4 : 1, pointerEvents: step < 2 ? 'none' : 'auto' }}>
              <div className="auth-input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="otp">2FA Verification Code</label>
                  {step === 2 && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setCooldown(60)
                        sendLoginOtp(verifiedEmail)
                      }} 
                      disabled={loading || cooldown > 0}
                      style={{ background: 'none', border: 'none', color: cooldown > 0 ? '#999' : 'var(--accent-primary)', fontSize: '12px', cursor: cooldown > 0 ? 'not-allowed' : 'pointer', padding: 0 }}
                    >
                      {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                    </button>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input 
                    id="otp"
                    type={showOtp ? 'text' : 'password'} 
                    className="auth-input"
                    placeholder="Enter verification code"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').substring(0, 8))}
                    required={step === 2}
                    disabled={step < 2}
                    autoComplete="one-time-code"
                    style={{ width: '100%', paddingRight: '40px', letterSpacing: !showOtp && otp ? '4px' : 'normal' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOtp(!showOtp)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#666',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    disabled={step < 2}
                  >
                    {showOtp ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    )}
                  </button>
                </div>
                {step === 2 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary, #666)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#10b981', fontSize: '13px' }}>🔒</span> 2FA verification code sent to your registered email address.
                  </div>
                )}
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading || step < 2 || otp.length < 6}>
                {loading && step === 2 ? 'Verifying...' : 'Sign In'}
              </button>
              
              {step === 2 && (
                <button 
                  type="button" 
                  className="auth-submit-btn" 
                  style={{ background: 'transparent', color: '#666', marginTop: '8px', border: '1px solid #eaeaea' }}
                  onClick={() => setStep(1)}
                  disabled={loading}
                >
                  Go Back
                </button>
              )}
            </div>
          </form>

          <div className="auth-footer">
            Don't have an account? <Link to="/signup" style={{ textDecoration: 'underline' }}>Sign up</Link>
          </div>
        </div>
      </div>
      
      <div className="auth-bottom-terms">
        By clicking continue, you agree to our <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>.
      </div>
    </div>
  )
}
