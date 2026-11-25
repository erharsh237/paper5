import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, CheckCircle2, Mail, Lock, User, Fingerprint } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import './Auth.css'
import { InlineError, InlineSuccess } from '../components/states'
import Turnstile from '../components/Turnstile'
import OtpInput from '../components/OtpInput'
import { triggerSpamNotice } from '../components/FloatingNotice'
import ThemeToggle from '../components/ThemeToggle'
import SEOHead from '../components/SEOHead'
import AuthIllustration from '../components/AuthIllustration'
import { safeRedirect } from '../lib/safeRedirect'
import { trackEvent } from '../lib/metrics'
import {
  validateRequestHeaders,
  checkAccountLockout,
  recordFailedAttempt,
  resetSecurityState,
  checkIpBlocked
} from '../lib/security'
import { validateEmail, validatePassword, validateUsername } from '../lib/validation'
import NotFound from './NotFound'
import { decryptPlanParam } from '../lib/urlSecurity'
import { getMainUrl } from '../lib/domain'
import { isPasskeySupported, registerPasskey, signInWithPasskey } from '../lib/passkeys'

function LoginForm({ accessDenied, denialReason, prefillEmail, onSwitchToSignup }) {
  const {
    loginWithUsernameOrEmail,
    logout,
    setIsPending2FA,
    authError,
    clearAuthError
  } = useAuth()

  const navigate = useNavigate()

  const [step, setStep] = useState(1) // 1: Password, 2: Passkey Required
  const [identifier, setIdentifier] = useState(prefillEmail || '')
  const [password, setPassword] = useState('')
  const [pendingAccessToken, setPendingAccessToken] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockoutTimer, setLockoutTimer] = useState(0)
  const [displayError, setDisplayError] = useState(null)
  const [turnstileToken, setTurnstileToken] = useState(null)
  const turnstileRef = useRef(null)

  useEffect(() => {
    if (prefillEmail && !identifier) {
      setIdentifier(prefillEmail)
    }
  }, [prefillEmail])

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
            setDisplayError(
              displayError.replace(
                `after ${seconds} second${seconds === 1 ? '' : 's'}`,
                `after ${newSeconds} second${newSeconds === 1 ? '' : 's'}`
              )
            )
          }
        }, 1000)
        return () => clearTimeout(timer)
      }
    }
  }, [displayError, clearAuthError])

  useEffect(() => {
    clearAuthError()
    try {
      const pendingEmail = sessionStorage.getItem('sprintos:2fa_pending_email')
      if (pendingEmail) {
        setStep(2)
        setMessage('Passkey Required: Please verify your passkey to complete sign-in.')
      }
    } catch (_) {}
  }, [])

  const handleVerifyRequiredPasskey = async (tokenOverride = null) => {
    setLoading(true)
    setMessage('')
    clearAuthError()
    try {
      await signInWithPasskey({ accessToken: tokenOverride || pendingAccessToken })
      trackEvent('login', { method: 'password_plus_passkey' })
      setIsPending2FA(false)
      navigate('/workspace')
    } catch (err) {
      setMessage(err?.message || 'Passkey verification is required to sign in.')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordLogin = async () => {
    try {
      validateRequestHeaders()
      checkIpBlocked()
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

      const data = await loginWithUsernameOrEmail(identifier, password)

      if (data?.isInviteDirectLogin || data?.requiresPasswordReset) {
        trackEvent('login', { method: 'invite_temp_password' })
        setIsPending2FA(false)
        navigate('/workspace')
        return
      }

      const userEmail = data?.user?.email || data?.email || identifier.trim().toLowerCase()
      const userPasskeys = Array.isArray(data?.user?.app_metadata?.passkeys) ? data.user.app_metadata.passkeys : []

      setFailedAttempts(0)
      resetSecurityState(identifier)

      // If user has set up a passkey, require passkey verification before allowing sign-in
      if (userPasskeys.length > 0) {
        const token = data?.session?.access_token || null
        setIsPending2FA(true, userEmail)
        setPendingAccessToken(token)
        setStep(2)
        setMessage('Passkey required: Please verify with Windows Hello, Touch ID, or your device passkey.')
        setLoading(false)
        await handleVerifyRequiredPasskey(token)
        return
      }

      // No passkey configured -> sign straight in (no OTP)
      setIsPending2FA(false)
      trackEvent('login', { method: 'password' })
      navigate('/workspace')
    } catch (err) {
      setIsPending2FA(false)
      if (turnstileRef.current) turnstileRef.current.reset()
      const result = recordFailedAttempt(identifier)
      setFailedAttempts(result.failedAttempts)
      if (result.lockoutSeconds > 0) {
        setLockoutTimer(result.lockoutSeconds)
        setMessage(`Account temporarily locked for ${result.lockoutSeconds} seconds due to repeated failed attempts.`)
      } else {
        setMessage(err?.message || 'Invalid email/username or password')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {accessDenied ? (
        <div style={{ marginBottom: 14 }}>
          <InlineError error={denialReason || "You don't have access to this page."} />
        </div>
      ) : (message || displayError) ? (
        (() => {
          const activeMsg = message || displayError
          const isSuccess =
            (activeMsg.toLowerCase().includes('success') ||
              activeMsg.toLowerCase().includes('verified') ||
              activeMsg.toLowerCase().includes('password validated')) &&
            !activeMsg.toLowerCase().includes('invalid') &&
            !activeMsg.toLowerCase().includes('error') &&
            !activeMsg.toLowerCase().includes('failed') &&
            !activeMsg.toLowerCase().includes('not found')

          return isSuccess ? (
            <div style={{ marginBottom: 14 }}>
              <InlineSuccess message={activeMsg} />
            </div>
          ) : (
            <div style={{ marginBottom: 14 }}>
              <InlineError error={activeMsg.replace(/^Error:\s*/i, '')} />
            </div>
          )
        })()
      ) : null}

      <form onSubmit={step === 2 ? (e) => { e.preventDefault(); handleVerifyRequiredPasskey() } : (e) => { e.preventDefault(); handlePasswordLogin() }} style={{ textAlign: 'left' }}>
        <div className="auth-input-group">
          <div className="auth-input-with-icon">
            <Mail size={16} className="auth-field-icon" aria-hidden="true" />
            <input
              id="identifier"
              type="text"
              className="auth-input auth-input-pill"
              placeholder="Work email or username"
              aria-label="Work email or username"
              value={identifier}
              onChange={e => setIdentifier(e.target.value.toLowerCase())}
              required
              disabled={step > 1}
              autoComplete="username"
            />
          </div>
        </div>

        <div className="auth-input-group">
          <div className="auth-input-with-icon">
            <Lock size={16} className="auth-field-icon" aria-hidden="true" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="auth-input auth-input-pill"
              placeholder="Password"
              aria-label="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              maxLength={72}
              disabled={step > 1}
              autoComplete="current-password"
              style={{ paddingRight: '42px' }}
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowPassword(prev => !prev)
              }}
              onMouseDown={(e) => e.preventDefault()}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
              disabled={step > 1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
            <Link to="/forgot-password" className="auth-forgot-link" style={{ fontSize: '12px' }}>
              Forgot your password?
            </Link>
          </div>
        </div>

        {step === 1 ? (
          <div style={{ marginTop: '14px' }}>
            <button
              type="button"
              className="auth-submit-btn auth-submit-pill"
              onClick={handlePasswordLogin}
              disabled={loading || !identifier || !password}
            >
              {loading ? 'Validating Password...' : 'Continue'}
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginTop: '14px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'rgba(26, 107, 255, 0.1)',
                color: '#1a6bff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '10px'
              }}
            >
              <Fingerprint size={24} />
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginBottom: '4px' }}>
              Passkey Verification Required
            </div>
            <p style={{ margin: '0 0 14px', fontSize: '12.5px', lineHeight: 1.5, color: 'var(--text-secondary, #64748b)' }}>
              Your account is protected by a passkey. Verify with Windows Hello, Touch ID, Face ID, or your device PIN to continue.
            </p>
            <button
              type="submit"
              className="auth-submit-btn auth-submit-pill"
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: 0 }}
            >
              <Fingerprint size={16} aria-hidden="true" />
              <span>{loading ? 'Waiting for passkey...' : 'Verify with Passkey'}</span>
            </button>

            <button
              type="button"
              className="auth-secondary-btn"
              onClick={async () => {
                setPendingAccessToken(null)
                setStep(1)
                setMessage('Please sign in with your account credentials.')
                await logout()
              }}
              disabled={loading}
            >
              ← Edit Credentials / Switch Account
            </button>
          </div>
        )}

        <Turnstile ref={turnstileRef} action="login" onSuccess={setTurnstileToken} />
      </form>
    </>
  )
}

function SignupForm({ activePlanId, activeCycle, onSwitchToLogin }) {
  const {
    checkUsername,
    sendSignupOtp,
    verifyOtp,
    finalizeSignup,
    authError,
    clearAuthError,
    getFriendlyError
  } = useAuth()

  const searchParams = new URLSearchParams(window.location.search)

  const PLAN_CONFIRMATION_META = {
    starter: {
      name: 'Starter Plan',
      badge: 'Free Forever',
      period: '₹0 / month · forever',
      features: '2 Agile Workflows (Ad-hoc, Kanban) • Up to 3 Squad Members • 1 Workspace',
      badgeColor: '#10b981',
      badgeBg: 'rgba(16, 185, 129, 0.1)'
    },
    team: {
      name: 'Team Plan',
      badge: activeCycle === 'annual' ? 'Annual Subscription (Save 20%)' : 'Monthly Subscription',
      period: activeCycle === 'annual' ? '₹160 / month billed annually • ₹0 during launch' : '₹200 / month • ₹0 during launch',
      features: '6 Agile Workflows (Scrum, Kanban, XP, Lean, Scrumban) • Up to 7 Members • 5 Workspaces',
      badgeColor: '#4f46e5',
      badgeBg: 'rgba(79, 70, 229, 0.1)'
    },
    pro: {
      name: 'Pro Plan',
      badge: activeCycle === 'annual' ? 'Annual Subscription (Save 20%)' : 'Monthly Subscription',
      period: activeCycle === 'annual' ? '₹400 / month billed annually • ₹0 during launch' : '₹500 / month • ₹0 during launch',
      features: 'All 8 Agile Workflows (Spotify & SAFe Enterprise) • Unlimited Members • 10 Workspaces',
      badgeColor: '#7c3aed',
      badgeBg: 'rgba(124, 58, 237, 0.1)'
    }
  }

  const [step, setStep] = useState(1) // 1: Info, 2: OTP Sent, 3: Verified
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [existingEmailAccount, setExistingEmailAccount] = useState(false)
  const [checkingAccount, setCheckingAccount] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockoutTimer, setLockoutTimer] = useState(0)
  const [showOtp, setShowOtp] = useState(false)
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)
  const [displayError, setDisplayError] = useState(null)
  const [turnstileToken, setTurnstileToken] = useState(null)
  const turnstileRef = useRef(null)

  const handleCheckEmail = async (overrideEmail) => {
    const targetEmail = (overrideEmail || email || '').trim().toLowerCase()
    if (!targetEmail || !targetEmail.includes('@') || targetEmail.length < 5) return
    try {
      setCheckingAccount(true)
      const res = await fetch('/api/public?action=check-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail })
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.emailExists) {
          setExistingEmailAccount(true)
          setMessage('An account with this email already exists. Please sign in instead.')
        } else {
          setExistingEmailAccount(false)
          setMessage(prev => prev.includes('already exists') ? '' : prev)
        }
      }
    } catch (_) {
    } finally {
      setCheckingAccount(false)
    }
  }

  useEffect(() => {
    const queryEmail = searchParams.get('email')
    if (queryEmail && !email) {
      const clean = queryEmail.trim().toLowerCase()
      setEmail(clean)
      const base = clean.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '')
      if (base && !username) setUsername(base)
      handleCheckEmail(clean)
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
            setDisplayError(
              displayError.replace(
                `after ${seconds} second${seconds === 1 ? '' : 's'}`,
                `after ${newSeconds} second${newSeconds === 1 ? '' : 's'}`
              )
            )
          }
        }, 1000)
        return () => clearTimeout(timer)
      }
    }
  }, [displayError, clearAuthError])

  useEffect(() => {
    let timer
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
      validateRequestHeaders()
      checkIpBlocked()
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

      try {
        const checkRes = await fetch('/api/public?action=check-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), username: username.trim().toLowerCase() })
        })
        if (checkRes.ok) {
          const checkData = await checkRes.json()
          if (checkData?.emailExists) {
            setExistingEmailAccount(true)
            setMessage('An account with this email already exists. Please sign in instead.')
            setLoading(false)
            return
          }
          if (checkData?.usernameAvailable === false) {
            setMessage('This username is already taken. Please choose another username.')
            setLoading(false)
            return
          }
        }
      } catch (checkErr) {
        console.warn('Account check pre-flight notice:', checkErr)
      }

      const isAvailable = await checkUsername(username)
      if (!isAvailable) {
        setMessage('This username is already taken. Please choose another username.')
        setLoading(false)
        return
      }

      await sendSignupOtp(email)
      triggerSpamNotice()

      setMessage('A 6-digit verification code has been sent to your email address.')
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
      if (otp.length !== 6) {
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
      trackEvent('sign_up', { method: 'email_otp' })
      const planName = PLAN_CONFIRMATION_META[activePlanId]?.name || 'Plan'
      if (isPasskeySupported()) {
        setMessage(`Account created! ${planName} confirmed. Optionally add a passkey for faster sign-in.`)
        setStep(4)
      } else {
        setMessage(`Account created successfully! ${planName} confirmed. Redirecting to workspace...`)
        setTimeout(() => {
          safeRedirect('/workspace')
        }, 500)
      }
    } catch (err) {
      console.error(err)
      const errStr = err?.message || ''
      if (errStr.includes('already taken') || errStr.includes('username')) {
        setStep(1)
        setMessage('This username is already taken. Please choose another username.')
      } else {
        setMessage(getFriendlyError(err))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAddPasskey = async () => {
    setLoading(true)
    setMessage('')
    clearAuthError()
    try {
      await registerPasskey()
      trackEvent('passkey_registered', { source: 'signup_optional_step' })
      setMessage('✓ Passkey added successfully! Redirecting to workspace...')
      setTimeout(() => {
        safeRedirect('/workspace')
      }, 600)
    } catch (err) {
      setMessage(err?.message || 'Could not add passkey. You can skip and set it up later.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {activePlanId && PLAN_CONFIRMATION_META[activePlanId] && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(37, 99, 235, 0.08) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '12px',
            padding: '10px 14px',
            marginBottom: '14px',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}
        >
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '8px',
              background: '#10b981',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: '1px'
            }}
          >
            <CheckCircle2 size={15} strokeWidth={2.5} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary, #09090b)', letterSpacing: '-0.01em' }}>
                {PLAN_CONFIRMATION_META[activePlanId].name}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '100px',
                  background: PLAN_CONFIRMATION_META[activePlanId].badgeBg,
                  color: PLAN_CONFIRMATION_META[activePlanId].badgeColor
                }}
              >
                {PLAN_CONFIRMATION_META[activePlanId].badge}
              </span>
            </div>
            <div style={{ fontSize: '11.5px', color: '#059669', fontWeight: 700 }}>
              {PLAN_CONFIRMATION_META[activePlanId].period}
            </div>
          </div>
        </div>
      )}

      {lockoutTimer > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <InlineError error={`Account is temporarily locked due to multiple failed attempts. Please try again in ${Math.floor(lockoutTimer / 60)}m ${lockoutTimer % 60}s.`} />
        </div>
      ) : (message || displayError) ? (
        (() => {
          const activeMsg = message || displayError
          const isSuccess =
            (activeMsg.toLowerCase().includes('success') ||
              activeMsg.toLowerCase().includes('verified') ||
              activeMsg.toLowerCase().includes('6-digit')) &&
            !activeMsg.toLowerCase().includes('invalid') &&
            !activeMsg.toLowerCase().includes('error') &&
            !activeMsg.toLowerCase().includes('failed') &&
            !activeMsg.toLowerCase().includes('taken')

          return isSuccess ? (
            <div style={{ marginBottom: 14 }}>
              <InlineSuccess message={activeMsg} />
            </div>
          ) : (
            <div style={{ marginBottom: 14 }}>
              <InlineError error={activeMsg.replace(/^Error:\s*/i, '')} />
              {activeMsg.toLowerCase().includes('already exists') && (
                <div style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => onSwitchToLogin(email)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#2563eb',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    Sign in to your account &rarr;
                  </button>
                </div>
              )}
            </div>
          )
        })()
      ) : null}

      <form onSubmit={handleCompleteSignup} style={{ textAlign: 'left' }}>
        {step === 1 && (
          <>
            <div className="auth-input-group">
              <div className="auth-input-with-icon">
                <User size={16} className="auth-field-icon" aria-hidden="true" />
                <input
                  id="username"
                  type="text"
                  className="auth-input auth-input-pill"
                  placeholder="Username (e.g. acmeadmin)"
                  aria-label="Username"
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                  required
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="auth-input-group">
              <div className="auth-input-with-icon">
                <Mail size={16} className="auth-field-icon" aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  className="auth-input auth-input-pill"
                  placeholder="you@company.com"
                  aria-label="Work email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value)
                    if (existingEmailAccount) setExistingEmailAccount(false)
                  }}
                  onBlur={() => handleCheckEmail()}
                  required
                />
              </div>
            </div>

            {existingEmailAccount ? (
              <div style={{ marginTop: '14px', padding: '14px', background: 'rgba(37, 99, 235, 0.05)', borderRadius: '12px', border: '1px solid rgba(37, 99, 235, 0.35)', textAlign: 'center' }}>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Account Already Exists
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary, #64748b)', marginBottom: '12px' }}>
                  An account with <strong>{email}</strong> already exists.
                </div>
                <button
                  type="button"
                  onClick={() => onSwitchToLogin(email)}
                  className="auth-submit-btn auth-submit-pill"
                  style={{ marginTop: 0 }}
                >
                  Sign In With This Email &rarr;
                </button>
              </div>
            ) : (
              <div style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="auth-submit-btn auth-submit-pill"
                  onClick={handleSendOtp}
                  disabled={loading || checkingAccount || !username || !email || lockoutTimer > 0}
                >
                  {loading
                    ? 'Sending Code...'
                    : checkingAccount
                      ? 'Checking Account...'
                      : lockoutTimer > 0
                        ? `Try again in ${Math.floor(lockoutTimer / 60)}m ${lockoutTimer % 60}s`
                        : 'Verify Email with OTP'}
                </button>
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div className="auth-account-pill">
              <div className="auth-account-pill-info">
                <span className="auth-account-pill-text">@{username} • {email}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMessage('')
                  setStep(1)
                }}
                className="auth-inline-change-link"
              >
                Change
              </button>
            </div>

            <div className="auth-input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label htmlFor="otp" style={{ marginBottom: 0 }}>Verification Code</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowOtp(!showOtp)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '11px', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {showOtp ? <><EyeOff size={13} /> Hide</> : <><Eye size={13} /> Show</>}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading || cooldown > 0}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: cooldown > 0 ? '#94a3b8' : '#2563eb',
                      fontSize: '12px',
                      cursor: cooldown > 0 ? 'not-allowed' : 'pointer',
                      padding: 0,
                      fontWeight: 600
                    }}
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                  </button>
                </div>
              </div>

              <OtpInput
                value={otp}
                onChange={setOtp}
                length={6}
                showOtp={showOtp}
              />
            </div>

            <div style={{ marginTop: '16px' }}>
              <button
                type="button"
                className="auth-submit-btn auth-submit-pill"
                onClick={handleVerifyOtp}
                disabled={loading || otp.length !== 6}
              >
                {loading ? 'Verifying...' : 'Confirm Verification Code'}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="auth-account-pill">
              <div className="auth-account-pill-info">
                <span style={{ color: '#10b981', fontWeight: 700 }}>✓</span>
                <span className="auth-account-pill-text">@{username} • {email}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMessage('')
                  setStep(1)
                }}
                className="auth-inline-change-link"
              >
                Change
              </button>
            </div>

            <div className="auth-input-group">
              <label htmlFor="signup-password">Secure Password</label>
              <div className="auth-input-with-icon" style={{ position: 'relative' }}>
                <Lock size={16} className="auth-field-icon" aria-hidden="true" />
                <input
                  id="signup-password"
                  type={showSignupPassword ? 'text' : 'password'}
                  className="auth-input auth-input-pill"
                  placeholder="Min 8 chars (A-Z, a-z, 0-9, special)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                  required
                  maxLength={72}
                  autoComplete="new-password"
                  style={{ paddingRight: '42px' }}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowSignupPassword(prev => !prev)
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                  title={showSignupPassword ? 'Hide password' : 'Show password'}
                >
                  {showSignupPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {(isPasswordFocused || password.length > 0) && (() => {
                const reqs = validatePassword(password).requirements
                const items = [
                  { ok: reqs.minLength, label: '8+ chars' },
                  { ok: reqs.hasUpper, label: 'Uppercase (A-Z)' },
                  { ok: reqs.hasLower, label: 'Lowercase (a-z)' },
                  { ok: reqs.hasNumber, label: 'Number (0-9)' },
                  { ok: reqs.hasSpecial, label: 'Special (!@#$%^&*)' },
                ]
                return (
                  <div className="auth-pwd-checklist">
                    {items.map((item) => (
                      <div key={item.label} className={`auth-pwd-item ${item.ok ? 'is-met' : ''}`}>
                        <span className="auth-pwd-dot">{item.ok ? '✓' : '○'}</span>
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>

            <div style={{ marginTop: '16px' }}>
              <button
                type="submit"
                className="auth-submit-btn auth-submit-pill"
                disabled={loading || !validatePassword(password).valid}
              >
                {loading ? 'Creating Account...' : 'Complete Account Registration'}
              </button>
            </div>
          </>
        )}

        {step === 4 && (
          <div style={{ textAlign: 'center', padding: '6px 0' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                background: 'rgba(26, 107, 255, 0.1)',
                color: '#1a6bff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px'
              }}
            >
              <Fingerprint size={26} />
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
              Add a passkey (Optional)
            </h3>
            <p style={{ margin: '0 0 18px', fontSize: '12.5px', lineHeight: 1.5, color: 'var(--text-secondary, #64748b)' }}>
              Sign in faster next time using Windows Hello, Touch ID, Face ID, or your device PIN.
            </p>
            <button
              type="button"
              className="auth-submit-btn auth-submit-pill"
              onClick={handleAddPasskey}
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: 0 }}
            >
              <Fingerprint size={16} aria-hidden="true" />
              <span>{loading ? 'Setting up passkey...' : 'Add Passkey'}</span>
            </button>
            <button
              type="button"
              className="auth-secondary-btn"
              onClick={() => safeRedirect('/workspace')}
              disabled={loading}
              style={{ marginTop: '10px' }}
            >
              Skip for now &rarr;
            </button>
          </div>
        )}

        <Turnstile ref={turnstileRef} action="signup" onSuccess={setTurnstileToken} />
      </form>
    </>
  )
}

export default function AuthPortal({ initialMode = 'login', accessDenied, denialReason }) {
  const location = useLocation()
  const [mode, setMode] = useState(
    initialMode || (location.pathname === '/signup' ? 'signup' : 'login')
  )
  const [prefillEmail, setPrefillEmail] = useState('')

  // Sync mode if route changes externally
  useEffect(() => {
    if (location.pathname === '/signup') setMode('signup')
    else if (location.pathname === '/login') setMode('login')
  }, [location.pathname])

  const searchParams = new URLSearchParams(window.location.search)
  const rawToken = searchParams.get('p') || searchParams.get('plan')
  const decryptedPlan = rawToken ? decryptPlanParam(rawToken) : null
  const isInvalidPlan = Boolean(rawToken && !decryptedPlan)

  const activePlanId = useMemo(() => {
    if (decryptedPlan) return decryptedPlan
    try {
      const stored = localStorage.getItem('sprintos_selected_plan')
      if (stored && ['starter', 'free', 'team', 'pro', 'scale'].includes(stored.toLowerCase())) {
        return stored.toLowerCase() === 'free' ? 'starter' : (stored.toLowerCase() === 'scale' ? 'pro' : stored.toLowerCase())
      }
    } catch (_) {}
    return null
  }, [decryptedPlan])

  const activeCycle = useMemo(() => {
    const fromQuery = searchParams.get('cycle')
    if (fromQuery && ['monthly', 'annual'].includes(fromQuery.toLowerCase())) return fromQuery.toLowerCase()
    try {
      const stored = localStorage.getItem('sprintos_selected_cycle')
      if (stored && ['monthly', 'annual'].includes(stored.toLowerCase())) return stored.toLowerCase()
    } catch (_) {}
    return 'monthly'
  }, [])

  useEffect(() => {
    const cycleParam = searchParams.get('cycle') || 'monthly'
    if (decryptedPlan) {
      localStorage.setItem('sprintos_selected_plan', decryptedPlan)
      localStorage.setItem('sprintos_selected_cycle', cycleParam)
    } else if (!rawToken) {
      localStorage.removeItem('sprintos_selected_plan')
      localStorage.removeItem('sprintos_selected_cycle')
    }
  }, [decryptedPlan, rawToken])

  if (mode === 'signup' && isInvalidPlan) {
    return <NotFound />
  }

  // Instant zero-reload mode switch
  const switchMode = (nextMode, emailToPrefill = '') => {
    if (emailToPrefill) setPrefillEmail(emailToPrefill)
    setMode(nextMode)
    const nextPath = nextMode === 'signup' ? '/signup' : '/login'
    const search = window.location.search || ''
    if (window.location.pathname !== nextPath) {
      window.history.replaceState(null, '', `${nextPath}${search}`)
    }
  }

  return (
    <div className="auth-layout auth-split-layout">
      <SEOHead
        title={mode === 'login' ? 'Sign In | Paper5' : 'Create Account | Paper5'}
        description={mode === 'login' ? 'Sign in to your Paper5 team workspace.' : 'Create a free Paper5 workspace account for your team.'}
        noIndex={true}
      />

      <a
        href={getMainUrl('/')}
        className="auth-back-to-website"
        onClick={(e) => {
          e.preventDefault()
          window.location.href = getMainUrl('/')
        }}
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to website
      </a>

      <div className="auth-top-actions">
        <ThemeToggle />
      </div>

      <div className="auth-split-card">
        {/* Left Illustration Panel */}
        <div className="auth-visual-panel">
          <div className="auth-visual-center">
            <AuthIllustration />
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="auth-form-panel">
          <div className="auth-panel-body">
            <h1 className="auth-split-title">
              {mode === 'login' ? 'Sign in' : 'Sign up'}
            </h1>

            {/* Two-button instant mode switcher (replaces Google / Apple ID buttons) */}
            <div className="auth-mode-label">Choose how to continue</div>
            <div className="auth-mode-buttons" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                className={`auth-mode-btn ${mode === 'login' ? 'active' : ''}`}
                onClick={() => switchMode('login')}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signup'}
                className={`auth-mode-btn ${mode === 'signup' ? 'active' : ''}`}
                onClick={() => switchMode('signup')}
              >
                Sign up
              </button>
            </div>

            <div className="auth-mode-sublabel">
              {mode === 'login' ? 'Or continue with email address' : 'Create your workspace with work email'}
            </div>

            {mode === 'login' ? (
              <LoginForm
                accessDenied={accessDenied}
                denialReason={denialReason}
                prefillEmail={prefillEmail}
                onSwitchToSignup={() => switchMode('signup')}
              />
            ) : (
              <SignupForm
                activePlanId={activePlanId}
                activeCycle={activeCycle}
                onSwitchToLogin={(emailToPrefill) => switchMode('login', emailToPrefill)}
              />
            )}

            <div className="auth-turnstile-note">
              Protected by Cloudflare Turnstile Anti-Bot Challenge Tokens
            </div>
          </div>
        </div>
      </div>

      <div className="auth-bottom-terms">
        By clicking continue, you agree to our <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>.
      </div>
    </div>
  )
}
