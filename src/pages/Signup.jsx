import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import './Auth.css'
import { InlineError, InlineSuccess } from '../components/states'
import Turnstile from '../components/Turnstile'
import OtpInput from '../components/OtpInput'

const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email;
  const [name, domain] = email.split('@');
  if (name.length <= 2) return `${name[0]}***@${domain}`;
  return `${name.substring(0, 2)}***${name.substring(name.length - 1)}@${domain}`;
}

import { 
  validateRequestHeaders, 
  checkAccountLockout, 
  checkIpBlocked,
  recordFailedAttempt, 
  resetSecurityState 
} from '../lib/security'
import { validateEmail, validatePassword, validateUsername } from '../lib/validation'

import { getMainUrl } from '../lib/domain'
import NotFound from './NotFound'

const VALID_PLANS = ['starter', 'free', 'team', 'scale']

export default function Signup() {
  const { 
    checkUsername, 
    sendSignupOtp, 
    verifyOtp, 
    finalizeSignup, 
    authError, 
    clearAuthError,
    getFriendlyError,
    user,
    userData
  } = useAuth()
  
  const navigate = useNavigate()

  // Validate plan URL query parameter
  const searchParams = new URLSearchParams(window.location.search)
  const rawPlanParam = searchParams.get('plan')
  const isInvalidPlan = rawPlanParam && !VALID_PLANS.includes(rawPlanParam.toLowerCase().trim())

  const [step, setStep] = useState(1) // 1: Info, 2: OTP Sent, 3: Verified
  
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const [message, setMessage] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockoutTimer, setLockoutTimer] = useState(0)
  const [showOtp, setShowOtp] = useState(false)
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)
  const [displayError, setDisplayError] = useState(null)
  const [turnstileToken, setTurnstileToken] = useState(null)
  const turnstileRef = useRef(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const plan = params.get('plan')
    if (plan && VALID_PLANS.includes(plan.toLowerCase().trim())) {
      localStorage.setItem('sprintos_selected_plan', plan.toLowerCase().trim())
    }
  }, [])

  useEffect(() => {
    let timer
    if (lockoutTimer > 0) {
      timer = setInterval(() => {
        setLockoutTimer(t => {
          if (t <= 1) {
            setFailedAttempts(0)
            setMessage('')
            return 0
          }
          return t - 1
        })
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [lockoutTimer])

  useEffect(() => {
    if (authError) setDisplayError(authError)
    else setDisplayError(null)
  }, [authError])

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

  const handleSendOtp = async () => {
    try {
      // 1. Header Validation
      validateRequestHeaders()

      // 2. IP Blocking Check
      checkIpBlocked()

      // 3. Persistent Lockout Check
      const lockoutStatus = checkAccountLockout(email)
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
      const usernameCheck = validateUsername(username)
      if (!usernameCheck.valid) {
        setMessage(usernameCheck.error)
        setLoading(false)
        return
      }

      const emailCheck = validateEmail(email)
      if (!emailCheck.valid) {
        setMessage(emailCheck.error)
        setLoading(false)
        return
      }
      
      const isAvailable = await checkUsername(username)
      if (!isAvailable) {
        setMessage('This username is already taken.')
        setLoading(false)
        return
      }
      
      await sendSignupOtp(email)
      
      setMessage('An 8-digit verification code has been sent to your email address.')
      setStep(2)
      setCooldown(60)
      setFailedAttempts(0)
      resetSecurityState(email)
    } catch (err) {
      console.error('OTP Dispatch Error:', err)
      const friendlyMsg = err?.message?.includes('60 seconds') || err?.message?.includes('rate limit')
        ? 'For security reasons, email verification codes can only be requested once every 60 seconds. Please check your inbox or wait a moment.'
        : (err?.message || 'Unable to send verification code right now. Please check your email or try again shortly.')
      setMessage(friendlyMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    setLoading(true)
    setMessage('')
    clearAuthError()
    
    try {
      if (otp.length < 6) {
        setMessage('Please enter a valid code.')
        setLoading(false)
        return
      }
      
      await verifyOtp(email, otp)
      
      setMessage('Email verified successfully! Please set your password to complete registration.')
      setStep(3)
    } catch (err) {
      console.error(err)
      setMessage(getFriendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteSignup = async (e) => {
    if (e) e.preventDefault()
    setLoading(true)
    setMessage('')
    clearAuthError()
    
    try {
      const pwdCheck = validatePassword(password)
      if (!pwdCheck.valid) {
        setMessage(`Password requirements not met: ${pwdCheck.errors.join(', ')}`)
        setLoading(false)
        return
      }
      
      await finalizeSignup(password, username)
      setMessage('Account created successfully! Redirecting to onboarding...')
      setTimeout(() => {
        window.location.href = '/workspace'
      }, 500)
    } catch (err) {
      console.error(err)
      setMessage(getFriendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  if (isInvalidPlan) {
    return <NotFound />
  }

  return (
    <div className="auth-layout">
      <a href={getMainUrl('/')} style={{ position: 'absolute', top: '32px', left: '32px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#666', textDecoration: 'none', fontWeight: 500 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back to website
      </a>

      <div className="auth-form-side" style={{ padding: 0 }}>
        <div className="auth-form-container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '24px', color: '#111', fontWeight: 600, fontSize: '18px' }}>
            <div style={{ width: '24px', height: '24px', background: '#111', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fff' }} />
            </div>
            SprintOS
          </div>
          <h1>Create your account</h1>
          <p className="auth-subtitle">Enter your email below to create your account</p>

          {lockoutTimer > 0 ? (
            <div style={{ marginBottom: 16 }}>
              <InlineError error={`Account is temporarily locked due to multiple failed attempts. Please try again in ${Math.floor(lockoutTimer / 60)}m ${lockoutTimer % 60}s.`} />
            </div>
          ) : (message || displayError) ? (
            (() => {
              const activeMsg = message || displayError
              const isSuccess = (
                activeMsg.toLowerCase().includes('success') || 
                activeMsg.toLowerCase().includes('verified') || 
                activeMsg.toLowerCase().includes('an 8-digit')
              ) && 
              !activeMsg.toLowerCase().includes('invalid') && 
              !activeMsg.toLowerCase().includes('error') && 
              !activeMsg.toLowerCase().includes('failed') &&
              !activeMsg.toLowerCase().includes('taken')

              return isSuccess ? (
                <div style={{ marginBottom: 16 }}>
                  <InlineSuccess message={activeMsg} />
                </div>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  <InlineError error={activeMsg.replace(/^Error:\s*/i, '')} />
                </div>
              )
            })()
          ) : null}

          <form onSubmit={handleCompleteSignup} style={{ textAlign: 'left' }}>
            {/* Step 1: Info */}
            {/* Step 1: Username & Work Email */}
            {step === 1 && (
              <>
                <div className="auth-input-group">
                  <label htmlFor="username">Username</label>
                  <input 
                    id="username"
                    type="text" 
                    className="auth-input"
                    placeholder="e.g. acmeadmin"
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                    required
                    autoComplete="off"
                  />
                </div>
                
                <div className="auth-input-group">
                  <label htmlFor="email">Work email</label>
                  <input 
                    id="email"
                    type="email" 
                    className="auth-input"
                    placeholder="you@company.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div style={{ marginTop: '24px' }}>
                  <button 
                    type="button" 
                    className="auth-submit-btn" 
                    onClick={handleSendOtp} 
                    disabled={loading || !username || !email || lockoutTimer > 0}
                    style={lockoutTimer > 0 ? { opacity: 0.5, cursor: 'not-allowed', background: '#9ca3af', borderColor: '#9ca3af' } : {}}
                  >
                    {loading 
                      ? 'Sending Code...' 
                      : lockoutTimer > 0 
                        ? `Try again in ${Math.floor(lockoutTimer / 60)}m ${lockoutTimer % 60}s` 
                        : 'Verify Email with OTP'}
                  </button>
                </div>
              </>
            )}

            {/* Step 2: 8-Digit Verification Code */}
            {step === 2 && (
              <>
                <div className="auth-input-group" style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-layer-2, #f9fafb)', borderRadius: '8px', border: '1px solid var(--border-subtle, #e5e7eb)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary, #6b7280)', marginBottom: '2px' }}>Account Details</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>@{username} • {email}</div>
                </div>

                <div className="auth-input-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label htmlFor="otp">Verification Code</label>
                    <button 
                      type="button" 
                      onClick={handleSendOtp} 
                      disabled={loading || cooldown > 0}
                      style={{ background: 'none', border: 'none', color: cooldown > 0 ? '#999' : 'var(--accent-primary, #10b981)', fontSize: '12px', cursor: cooldown > 0 ? 'not-allowed' : 'pointer', padding: 0, fontWeight: 600 }}
                    >
                      {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => setShowOtp(!showOtp)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-secondary, #666)',
                          fontSize: '11px',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {showOtp ? (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                            Hide Digits
                          </>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            Show Digits
                          </>
                        )}
                      </button>
                    </div>

                    <OtpInput 
                      value={otp} 
                      onChange={setOtp} 
                      length={8} 
                      showOtp={showOtp}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '24px' }}>
                  <button type="button" className="auth-submit-btn" onClick={handleVerifyOtp} disabled={loading || otp.length < 6}>
                    {loading ? 'Verifying...' : 'Confirm Verification Code'}
                  </button>
                </div>
              </>
            )}

            {/* Step 3: Password Creation */}
            {step === 3 && (
              <>
                <div className="auth-input-group" style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-layer-2, #f9fafb)', borderRadius: '8px', border: '1px solid var(--border-subtle, #e5e7eb)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary, #6b7280)', marginBottom: '2px' }}>Verified Account</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>✓</span> @{username} ({email})
                  </div>
                </div>

                <div className="auth-input-group">
                  <label htmlFor="password">Secure Password</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      id="password"
                      type={showSignupPassword ? 'text' : 'password'} 
                      className="auth-input"
                      placeholder="Min 8 chars (A-Z, a-z, 0-9, special)"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setIsPasswordFocused(true)}
                      onBlur={() => setIsPasswordFocused(false)}
                      required
                      maxLength={72}
                      style={{ width: '100%', paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
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
                    >
                      {showSignupPassword ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      )}
                    </button>

                    {/* Password Requirements Tooltip (Right side, black bg) */}
                    {(isPasswordFocused || password.length > 0) && (
                      <div style={{
                        position: 'absolute',
                        left: 'calc(100% + 14px)',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '210px',
                        background: '#09090b',
                        color: '#ffffff',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: '1px solid #27272a',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
                        fontSize: '11px',
                        zIndex: 1000,
                        pointerEvents: 'none'
                      }}>
                        {/* Pointer Arrow */}
                        <div style={{
                          position: 'absolute',
                          left: '-6px',
                          top: '50%',
                          transform: 'translateY(-50%) rotate(45deg)',
                          width: '10px',
                          height: '10px',
                          background: '#09090b',
                          borderLeft: '1px solid #27272a',
                          borderBottom: '1px solid #27272a'
                        }} />

                        <div style={{ fontWeight: 700, marginBottom: '6px', color: '#f4f4f5', fontSize: '11px', letterSpacing: '0.02em' }}>
                          Password Requirements:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: validatePassword(password).requirements.minLength ? '#10b981' : '#a1a1aa' }}>
                            <span style={{ fontWeight: 700 }}>{validatePassword(password).requirements.minLength ? '✓' : '○'}</span>
                            <span>Min 8 chars</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: validatePassword(password).requirements.hasUpper ? '#10b981' : '#a1a1aa' }}>
                            <span style={{ fontWeight: 700 }}>{validatePassword(password).requirements.hasUpper ? '✓' : '○'}</span>
                            <span>Uppercase (A-Z)</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: validatePassword(password).requirements.hasLower ? '#10b981' : '#a1a1aa' }}>
                            <span style={{ fontWeight: 700 }}>{validatePassword(password).requirements.hasLower ? '✓' : '○'}</span>
                            <span>Lowercase (a-z)</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: validatePassword(password).requirements.hasNumber ? '#10b981' : '#a1a1aa' }}>
                            <span style={{ fontWeight: 700 }}>{validatePassword(password).requirements.hasNumber ? '✓' : '○'}</span>
                            <span>Number (0-9)</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: validatePassword(password).requirements.hasSpecial ? '#10b981' : '#a1a1aa' }}>
                            <span style={{ fontWeight: 700 }}>{validatePassword(password).requirements.hasSpecial ? '✓' : '○'}</span>
                            <span>Special char (!@#$%^&*)</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '24px' }}>
                  <button type="submit" className="auth-submit-btn" disabled={loading || !validatePassword(password).valid}>
                    {loading ? 'Creating Account...' : 'Complete Account Registration'}
                  </button>
                </div>
              </>
            )}

            <Turnstile ref={turnstileRef} action="signup" onSuccess={setTurnstileToken} />
          </form>

          <div className="auth-footer">
            Already have an account? <Link to="/login" style={{ textDecoration: 'underline' }}>Sign in</Link>
          </div>

          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle, #f0f0f0)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-tertiary, #888)', fontFamily: 'var(--mono)' }}>
            Protected by Cloudflare Turnstile Anti-Bot Challenge Tokens
          </div>
        </div>
      </div>

      <div className="auth-bottom-terms">
        By clicking continue, you agree to our <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>.
      </div>
    </div>
  )
}
