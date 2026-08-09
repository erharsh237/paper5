import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import './Auth.css'
import { InlineError, InlineSuccess } from '../components/states'

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
import { validateEmail, validatePassword } from '../lib/validation'

import {
  TEAM_SIZE_OPTIONS,
  WORKFLOWS,
  getRecommendedWorkflow,
  getUnlockedWorkflowsForPlan,
  isWorkflowUnlocked
} from '../lib/workflows'
import { getMainUrl } from '../lib/domain'

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
  
  const [step, setStep] = useState(1) // 1: Info, 2: OTP Sent, 3: Verified
  
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [selectedPlan, setSelectedPlan] = useState('free')
  const [teamSize, setTeamSize] = useState('2-5')
  const [selectedWorkflow, setSelectedWorkflow] = useState('kanban')
  const [loading, setLoading] = useState(false)

  const handleTeamSizeChange = (newSize) => {
    setTeamSize(newSize)
    const rec = getRecommendedWorkflow(newSize)
    if (rec && isWorkflowUnlocked(rec.id, selectedPlan)) {
      setSelectedWorkflow(rec.id)
    } else {
      const unlocked = getUnlockedWorkflowsForPlan(selectedPlan)
      if (unlocked.length > 0) setSelectedWorkflow(unlocked[0].id)
    }
  }

  const handlePlanChange = (newPlan) => {
    setSelectedPlan(newPlan)
    if (!isWorkflowUnlocked(selectedWorkflow, newPlan)) {
      const unlocked = getUnlockedWorkflowsForPlan(newPlan)
      if (unlocked.length > 0) setSelectedWorkflow(unlocked[0].id)
    }
  }
  const [message, setMessage] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockoutTimer, setLockoutTimer] = useState(0)
  const [showOtp, setShowOtp] = useState(false)
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [displayError, setDisplayError] = useState(null)

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

  // If they somehow have a user but no username, force them to step 3
  useEffect(() => {
    if (user && !userData?.username && step < 3) {
      setStep(3)
    }
  }, [user, userData, step])

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
      
      setMessage('Verification code dispatched to your registered email.')
      setStep(2)
      setCooldown(60)
      setFailedAttempts(0)
      resetSecurityState(email)
    } catch (err) {
      const result = recordFailedAttempt(email)
      setFailedAttempts(result.failedAttempts)
      if (result.lockoutSeconds > 0) {
        setLockoutTimer(result.lockoutSeconds)
        setMessage(`Signup temporarily locked for ${result.lockoutSeconds} seconds due to repeated attempts.`)
      }
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
      
      setMessage('Email verified securely. You may now set your password.')
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
      
      await finalizeSignup(password, username, selectedPlan)
      setMessage('Account created successfully! Redirecting...')
      setTimeout(() => navigate('/workspace'), 800)
    } catch (err) {
      console.error(err)
      setMessage(getFriendlyError(err))
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

          {displayError && (
            <div style={{ marginBottom: 16 }}>
              <InlineError error={displayError.replace(/^Error:\s*/i, '')} />
            </div>
          )}

          {message && !(message.includes('already') || message.includes('must') || message.includes('required') || message.includes('failed') || message.includes('unable') || message.includes('locked')) ? (
            <InlineSuccess message={message} />
          ) : message && (
            <InlineError error={message.replace(/^Error:\s*/i, '')} />
          )}

          <form onSubmit={handleCompleteSignup} style={{ textAlign: 'left' }}>
            {/* Step 1: Info */}
            <div className="auth-input-group">
              <label htmlFor="username">Username</label>
              <input 
                id="username"
                type="text" 
                className="auth-input"
                placeholder="e.g. acme_admin"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                required
                disabled={step > 1}
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
                disabled={step > 1}
              />
            </div>

            {step === 1 && (
              <button type="button" className="auth-submit-btn" onClick={handleSendOtp} disabled={loading || !username || !email}>
                {loading ? 'Sending Code...' : 'Verify Email with OTP'}
              </button>
            )}

            {/* Step 2: OTP (Only visible after Step 1) */}
            {step >= 2 && (
              <div className="auth-input-group" style={{ marginTop: '24px', opacity: step === 3 ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="otp">Verification Code</label>
                  {step === 2 && (
                    <button 
                      type="button" 
                      onClick={handleSendOtp} 
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
                    required
                    disabled={step === 3}
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
                    disabled={step === 3}
                  >
                    {showOtp ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    )}
                  </button>
                </div>
                
                {step === 2 && (
                  <button type="button" className="auth-submit-btn" onClick={handleVerifyOtp} disabled={loading || otp.length < 6}>
                    {loading ? 'Verifying...' : 'Confirm Verification Code'}
                  </button>
                )}
              </div>
            )}

            {/* Step 3: Password (Only visible after Step 2) */}
            <div style={{ marginTop: '24px', opacity: step < 3 ? 0.4 : 1, pointerEvents: step < 3 ? 'none' : 'auto' }}>
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
                    required={step === 3}
                    disabled={step < 3}
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
                    disabled={step < 3}
                  >
                    {showSignupPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    )}
                  </button>
                </div>

                {step === 3 && (
                  <div style={{ marginTop: '10px', background: 'var(--bg-inset, #f8f9fa)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle, #e5e7eb)', fontSize: '12px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary, #4b5563)' }}>Password Requirements:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                      <span style={{ color: validatePassword(password).requirements.minLength ? '#0f9d63' : '#6b7280' }}>
                        {validatePassword(password).requirements.minLength ? '✓' : '○'} Min 8 chars
                      </span>
                      <span style={{ color: validatePassword(password).requirements.hasUpper ? '#0f9d63' : '#6b7280' }}>
                        {validatePassword(password).requirements.hasUpper ? '✓' : '○'} Uppercase (A-Z)
                      </span>
                      <span style={{ color: validatePassword(password).requirements.hasLower ? '#0f9d63' : '#6b7280' }}>
                        {validatePassword(password).requirements.hasLower ? '✓' : '○'} Lowercase (a-z)
                      </span>
                      <span style={{ color: validatePassword(password).requirements.hasNumber ? '#0f9d63' : '#6b7280' }}>
                        {validatePassword(password).requirements.hasNumber ? '✓' : '○'} Number (0-9)
                      </span>
                      <span style={{ color: validatePassword(password).requirements.hasSpecial ? '#0f9d63' : '#6b7280', gridColumn: 'span 2' }}>
                        {validatePassword(password).requirements.hasSpecial ? '✓' : '○'} Special char (!@#$%^&*)
                      </span>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div style={{ marginTop: '20px', textAlign: 'left' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary, #4b5563)', marginBottom: '8px', display: 'block' }}>
                      1. Select Account Tier (Early Access Unlocked):
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
                      {[
                        { id: 'free', name: 'Starter', price: 'Free', desc: '1 Workspace (3 Seats)' },
                        { id: 'team', name: 'Team', price: '$29/mo', desc: '5 Workspaces (7 Seats)' },
                        { id: 'scale', name: 'Scale', price: '$79/mo', desc: '10 Workspaces (Unlimited)' }
                      ].map(p => (
                        <div 
                          key={p.id}
                          onClick={() => handlePlanChange(p.id)}
                          style={{
                            padding: '10px 8px',
                            borderRadius: '8px',
                            border: selectedPlan === p.id ? '2px solid #10b981' : '1px solid var(--border-subtle, #e5e7eb)',
                            background: selectedPlan === p.id ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-layer-2, #ffffff)',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</div>
                          <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 600, margin: '2px 0' }}>{p.price}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary, #6b7280)' }}>{p.desc}</div>
                        </div>
                      ))}
                    </div>

                    {/* 2. Team Size Selection */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary, #4b5563)', marginBottom: '6px', display: 'block' }}>
                        2. Expected Team Size (Admin Configuration):
                      </label>
                      <select
                        value={teamSize}
                        onChange={(e) => handleTeamSizeChange(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-bright, #d1d5db)',
                          background: 'var(--bg-layer-1, #ffffff)',
                          color: 'var(--text-primary, #111827)',
                          fontSize: '14px',
                          fontWeight: 500
                        }}
                      >
                        {TEAM_SIZE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 3. Aligned Agile Workflow Selection */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary, #4b5563)', margin: 0 }}>
                          3. Aligned Agile Workflow:
                        </label>
                        <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                          Auto-Aligned to Team Size
                        </span>
                      </div>
                      
                      <select
                        value={selectedWorkflow}
                        onChange={(e) => setSelectedWorkflow(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-bright, #d1d5db)',
                          background: 'var(--bg-layer-1, #ffffff)',
                          color: 'var(--text-primary, #111827)',
                          fontSize: '14px',
                          fontWeight: 500
                        }}
                      >
                        {WORKFLOWS.map(wf => {
                          const unlocked = isWorkflowUnlocked(wf.id, selectedPlan)
                          return (
                            <option key={wf.id} value={wf.id} disabled={!unlocked}>
                              {wf.num}. {wf.name} ({wf.teamSizeLabel}) {!unlocked ? `🔒 [${selectedPlan === 'team' ? 'Scale Only' : 'Team/Scale Only'}]` : ''}
                            </option>
                          )
                        })}
                      </select>

                      {/* Active Workflow Details Card */}
                      {(() => {
                        const wf = WORKFLOWS.find(w => w.id === selectedWorkflow)
                        if (!wf) return null
                        return (
                          <div style={{ marginTop: '10px', padding: '12px', background: 'var(--bg-inset, rgba(16, 185, 129, 0.05))', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{wf.name}</span>
                              <span style={{ fontSize: '11px', background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: '100px', fontWeight: 600 }}>{wf.badge}</span>
                            </div>
                            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{wf.description}</p>
                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                              Board Columns: {wf.columns.map(c => c.title).join(' ➔ ')}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: '24px', opacity: step < 3 ? 0.4 : 1, pointerEvents: step < 3 ? 'none' : 'auto' }}>
              <button type="submit" className="auth-submit-btn" disabled={loading || step < 3 || password.length < 6}>
                {loading && step === 3 ? 'Processing...' : 'Create Account'}
              </button>
            </div>
          </form>

          <div className="auth-footer">
            Already have an account? <Link to="/login" style={{ textDecoration: 'underline' }}>Sign in</Link>
          </div>
        </div>
      </div>

      <div className="auth-bottom-terms">
        By clicking continue, you agree to our <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>.
      </div>
    </div>
  )
}
