import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { ensureUserRecordExists } from './workspaces'
import { triggerSpamNotice } from '../components/FloatingNotice'

/**
 * Thin client for the /api/auth/session Vercel serverless function.
 * Keeps httpOnly cookies in sync with the in-memory Supabase session.
 */
const sessionCookieApi = {
  /** Restore a persisted session from httpOnly cookies on page load. */
  async get() {
    try {
      if (typeof document !== 'undefined') {
        const cookieStr = document.cookie || ''
        const hasSessionCookie = cookieStr.includes('sb_has_session=1') || 
                                 cookieStr.includes('sb_expires_at=') ||
                                 cookieStr.includes('sb_2fa_pending=')
        if (!hasSessionCookie) {
          // Instant 0ms return for anonymous/first-time visitors without network round trips
          return null
        }
      }
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2500)
      const res = await fetch('/api/auth/session', { 
        credentials: 'same-origin',
        signal: controller.signal 
      })
      clearTimeout(timeoutId)
      if (res.status === 204) return null // no session cookie
      if (!res.ok) return null
      return await res.json() // { access_token, refresh_token, expires_at } or { isPending2FA: true, email }
    } catch {
      return null // network error or timeout — treat as no session
    }
  },
  /** Flag 2FA pending state on httpOnly server cookies and clear access tokens. */
  async setPending2FA(email) {
    try {
      await fetch('/api/auth/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pending_2fa: true, email }),
      })
    } catch (_) {}
  },
  /** Persist a new/refreshed session to httpOnly cookies. */
  async set(session) {
    if (!session?.access_token || !session?.refresh_token) return
    try {
      if (typeof document !== 'undefined') {
        document.cookie = 'sb_has_session=1; Path=/; SameSite=Lax; Secure'
      }
      await fetch('/api/auth/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token:  session.access_token,
          refresh_token: session.refresh_token,
          expires_at:    session.expires_at,
        }),
      })
    } catch {
      // Non-fatal: session still works in memory; cookie just won't persist after refresh
      console.warn('[SessionCookieApi] Failed to sync session to cookie.')
    }
  },
  /** Clear session cookies on sign-out. */
  async clear() {
    try {
      if (typeof document !== 'undefined') {
        document.cookie = 'sb_has_session=; Path=/; SameSite=Lax; Max-Age=0'
      }
      await fetch('/api/auth/session', { method: 'DELETE', credentials: 'same-origin' })
    } catch {
      console.warn('[SessionCookieApi] Failed to clear session cookie.')
    }
  },
}

export const CURRENT_LEGAL_VERSION = '1.0'

function clearAuthStorage() {
  const preserved = {}
  const keepKeys = ['p5_cookie_consent', 'p5_app_theme', 'p5_marketing_theme']
  for (const k of keepKeys) {
    try { preserved[k] = localStorage.getItem(k) } catch (_) {}
  }
  try { localStorage.clear() } catch (_) {}
  try { sessionStorage.clear() } catch (_) {}
  for (const [k, v] of Object.entries(preserved)) {
    if (v) try { localStorage.setItem(k, v) } catch (_) {}
  }
}

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)
  const [isPending2FA, setIsPending2FAState] = useState(() => {
    try {
      return !!sessionStorage.getItem('sprintos:2fa_pending_email')
    } catch (_) {
      return false
    }
  })

  const setIsPending2FA = (val, email = '') => {
    try {
      if (val) {
        if (email) sessionStorage.setItem('sprintos:2fa_pending_email', email)
        sessionCookieApi.setPending2FA(email)
        supabase.auth.signOut().catch(() => {})
      } else {
        sessionStorage.removeItem('sprintos:2fa_pending_email')
      }
    } catch (_) {}
    setIsPending2FAState(!!val)
  }

  useEffect(() => {
    let authListener = null;
    let channel = null;

    const setupUser = async (session) => {
      if (!session?.user) {
        setUser(null)
        setUserData(null)
        setLoading(false)
        return
      }
      
      const u = { 
        ...session.user, 
        uid: session.user.id,
        emailVerified: !!session.user.email_confirmed_at || !!session.user.confirmed_at || !!session.access_token 
      }
      // In Supabase, the user profile is created by the Postgres trigger
      const cleanEmail = u.email ? u.email.trim().toLowerCase() : ''
      const defaultUsername = u.user_metadata?.username || (cleanEmail ? cleanEmail.split('@')[0].replace(/[^a-z0-9_]/g, '') : `user_${u.id.slice(0, 6)}`)

      // Fast Path: Immediately unlock the app shell without waiting for background DB queries
      let cachedLegalVer = null
      let cachedLegalAt = null
      try {
        cachedLegalVer = sessionStorage.getItem(`p5_legal_v_${u.id}`)
        cachedLegalAt = sessionStorage.getItem(`p5_legal_at_${u.id}`)
      } catch (_) {}

      setUser(u)
      setUserData({
        id: u.id,
        email: cleanEmail,
        username: defaultUsername,
        billing_plan_id: u.user_metadata?.plan || 'starter',
        billingPlanId: u.user_metadata?.plan || 'starter',
        requires_password_reset: !!u.user_metadata?.must_change_password,
        requiresPasswordReset: !!u.user_metadata?.must_change_password,
        legal_accepted_version: cachedLegalVer || u.user_metadata?.legal_accepted_version,
        legalAcceptedVersion: cachedLegalVer || u.user_metadata?.legal_accepted_version,
        legal_accepted_at: cachedLegalAt || u.user_metadata?.legal_accepted_at,
        legalAcceptedAt: cachedLegalAt || u.user_metadata?.legal_accepted_at,
        _isOptimistic: true
      })
      setLoading(false)

      // Fetch authoritative user profile and entitlements asynchronously
      const fetchUserData = async () => {
        let { data, error } = await supabase.from('users').select('*').eq('id', u.id).maybeSingle()
        if (!data) {
          const cleanEmail = u.email ? u.email.trim().toLowerCase() : ''
          let defaultUsername = u.user_metadata?.username || (cleanEmail ? cleanEmail.split('@')[0].replace(/[^a-z0-9_]/g, '') : `user_${u.id.slice(0, 6)}`)
          if (!defaultUsername || defaultUsername.length < 3) {
            defaultUsername = `user_${u.id.slice(0, 6)}`
          }

          data = {
            id: u.id,
            email: cleanEmail,
            username: defaultUsername,
            billing_plan_id: 'unselected',
            billingPlanId: 'unselected',
            requires_password_reset: !!u.user_metadata?.must_change_password,
            requiresPasswordReset: !!u.user_metadata?.must_change_password
          }

          try {
            const synced = await ensureUserRecordExists(u.id, cleanEmail, {
              username: defaultUsername,
              billing_plan_id: 'unselected'
            })
            if (synced) data = { ...data, ...synced }
          } catch (_) {}
        }
        if (data) {
          data.legalAcceptedVersion = data.legal_accepted_version
          data.legalAcceptedAt = data.legal_accepted_at
          data.billingStatus = data.billing_status
          data.billingPlanId = data.billing_plan_id
          data.requiresPasswordReset = data.requires_password_reset || !!u.user_metadata?.must_change_password
          data._isOptimistic = false
          if (data.legal_accepted_version) {
            try {
              sessionStorage.setItem(`p5_legal_v_${u.id}`, data.legal_accepted_version)
              if (data.legal_accepted_at) sessionStorage.setItem(`p5_legal_at_${u.id}`, data.legal_accepted_at)
            } catch (_) {}
          }
        }
        setUserData(data)
        setLoading(false)

        // Try to auto-redeem any pending invites for this user via serverless engine
        if (data) {
          const cleanEmail = u.email ? u.email.trim().toLowerCase() : ''
          if (cleanEmail && (!data.billing_plan_id || data.billing_plan_id === 'unselected' || data.billing_plan_id === 'none')) {
            fetch('/api/accept-invite', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: cleanEmail, userId: u.id })
            }).then(r => r.json()).then(inviteRes => {
              if (inviteRes?.workspaceId) {
                setUserData(prev => ({
                  ...(prev || {}),
                  billing_plan_id: 'member',
                  billingPlanId: 'member'
                }))
              }
            }).catch(() => {})
          }

          supabase.rpc('redeem_my_invites').then(({ error }) => {
            if (error) console.error('Auto-redeem failed:', error)
          }).catch(() => {})
        }
      }
      
      fetchUserData()

      // Subscribe to realtime updates on users table
      channel = supabase.channel(`public:users:id=eq.${u.id}:auth:${Math.random().toString(36).substring(7)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${u.id}` }, (payload) => {
          if (payload.eventType === 'DELETE' || !payload.new) {
            setUser(null)
            setUserData(null)
            sessionCookieApi.clear()
            clearAuthStorage()
            supabase.auth.signOut().catch(() => {})
            return
          }
          const data = payload.new
          if (data) {
            data.legalAcceptedVersion = data.legal_accepted_version
            data.legalAcceptedAt = data.legal_accepted_at
            data.billingStatus = data.billing_status
            data.billingPlanId = data.billing_plan_id
            data.requiresPasswordReset = data.requires_password_reset
          }
          setUserData(data)
        })
        .subscribe()
    }

    let isHydrated = false
    let currentUserId = null

    // ── Hydrate session from httpOnly cookie on page load ──────────────────
    // Since we no longer use localStorage, we restore the persisted session by
    // reading tokens from the server-side httpOnly cookie and calling setSession.
    const hydrateFromCookie = async () => {
      try {
        const stored = await sessionCookieApi.get()
        if (stored?.isPending2FA) {
          setUser(null)
          setUserData(null)
          setIsPending2FA(true, stored.email || '')
          supabase.auth.signOut().catch(() => {})
          setLoading(false)
          isHydrated = true
          return
        }
        if (stored?.access_token && stored?.refresh_token) {
          const { data: { session }, error } = await supabase.auth.setSession({
            access_token:  stored.access_token,
            refresh_token: stored.refresh_token,
          })
          if (error) {
            // Stored tokens are expired/invalid — clear the stale cookie
            await sessionCookieApi.clear()
          } else if (session) {
            currentUserId = session.user.id
            await setupUser(session)
            isHydrated = true
            return
          }
        }
        // No valid stored session — fall through to getSession() for magic link / URL flows
        const { data: { session } } = await supabase.auth.getSession()
        currentUserId = session?.user?.id ?? null
        await setupUser(session)
      } catch (err) {
        console.error('Session hydration failed:', err)
        setLoading(false)
      } finally {
        isHydrated = true
      }
    }

    // Listen for auth changes
    hydrateFromCookie()
    const { data: authSubscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Ignore initial empty session event if cookie hydration is still in-flight
      if (event === 'INITIAL_SESSION' && !isHydrated) {
        return
      }

      // Supabase's internal `visibilitychange` listener runs session recovery
      // every time the tab regains focus. Depending on internal state this can
      // emit either TOKEN_REFRESHED or SIGNED_IN even when it's the exact same
      // already-logged-in user. If the user id hasn't actually changed, there's
      // nothing to re-setup — skip it so we don't reset loading, refetch user
      // data, and tear down/recreate the realtime channel on every tab switch.
      const sameUser = session?.user?.id != null && session.user.id === currentUserId

      // ── Sync session tokens to httpOnly cookie ────────────────────────────
      // We do this BEFORE the sameUser early-return so TOKEN_REFRESHED events
      // always persist the latest access token even when the user hasn't changed.
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await sessionCookieApi.set(session)
      } else if (event === 'SIGNED_OUT') {
        await sessionCookieApi.clear()
        clearAuthStorage()
      }
      // ─────────────────────────────────────────────────────────────────────

      if (sameUser && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')) {
        return
      }
      currentUserId = session?.user?.id ?? null
      setupUser(session)
    })
    authListener = authSubscription

    return () => {
      authListener?.subscription?.unsubscribe()
      channel?.unsubscribe()
    }
  }, [])

  const getFriendlyError = (err) => {
    const raw = err?.message || (typeof err === 'string' ? err : JSON.stringify(err)) || '';
    if (raw.includes('Invalid login credentials')) return 'Invalid email or password.'
    if (raw.includes('already registered')) return 'This email address is already registered.'
    if (raw.includes('User not found')) return 'No account found with this email.'
    if (raw.includes('Token has expired') || raw.includes('is invalid') || raw.includes('Invalid token') || raw.includes('otp') || raw.includes('Token')) {
      return 'Invalid verification code. Please check the 6-digit code sent to your email or request a new one.'
    }
    if (raw.includes('Header Validation Failed')) return 'Security check failed. Please refresh the page.'
    if (raw.includes('rate limit') || raw.includes('Too many requests')) return 'Too many attempts. Please wait a moment and try again.'
    if (raw.includes('SMTP') || raw.includes('onboarding@resend.dev') || raw.includes('resend') || raw.includes('500') || raw === '{}') {
      return 'Unable to send verification code right now. Please double check the email or try again shortly.'
    }
    if (raw.includes('PGRST') || raw.includes('Database') || raw.includes('FetchError') || raw.includes('Failed to fetch')) {
      return 'Connection issue. Please check your internet connection and try again.'
    }
    const clean = raw.replace(/^Error:\s*/i, '').replace(/^SMTP Error:\s*/i, '')
    return clean || 'An unexpected error occurred. Please try again.'
  }

  const checkUsername = async (username, excludeUserId = user?.id) => {
    const clean = (username || '').trim().toLowerCase()
    if (!clean || clean.length < 3) return false
    
    // 1. Try DB RPC first if available
    try {
      const { data, error } = await supabase.rpc('check_username_available', { uname: clean })
      if (!error && typeof data === 'boolean') {
        if (!data && excludeUserId) {
          // If RPC returned false, verify if it was taken by the current user themselves
          const { data: ownUser } = await supabase.from('users').select('id').eq('id', excludeUserId).ilike('username', clean).maybeSingle()
          if (ownUser) return true
        }
        return data
      }
    } catch (_) {}

    // 2. Direct lookup on users table
    try {
      let query = supabase
        .from('users')
        .select('id')
        .ilike('username', clean)

      if (excludeUserId) {
        query = query.neq('id', excludeUserId)
      }

      const { data: existingUser } = await query.maybeSingle()
      return !existingUser
    } catch (_) {
      return true
    }
  }

  const sendSignupOtp = async (email) => {
    setAuthError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true }
    })
    if (error) {
      setAuthError(getFriendlyError(error))
      throw error
    }
    triggerSpamNotice()
  }

  const verifyOtp = async (email, token) => {
    setAuthError(null)
    
    // Depending on whether the user is new or existing, Supabase sends different token types
    const typesToTry = ['email', 'recovery', 'signup', 'invite', 'magiclink']
    let lastError = null;

    for (const type of typesToTry) {
      try {
        const { data, error } = await supabase.auth.verifyOtp({ email, token, type })
        if (!error && data?.session) {
          setIsPending2FA(false)
          return data
        }
        if (error) lastError = error
      } catch (e) {
        lastError = e
      }
    }

    setAuthError(getFriendlyError(lastError))
    throw lastError
  }

  const finalizeSignup = async (password, username) => {
    setAuthError(null)
    const cleanUsername = (username || '').trim().toLowerCase()

    // Enforce uniqueness validation before completing registration, excluding current user ID
    const isAvail = await checkUsername(cleanUsername, user?.id)
    if (!isAvail) {
      const err = new Error('This username is already taken. Please choose another username.')
      setAuthError(err.message)
      throw err
    }

    const { error, data } = await supabase.auth.updateUser({
      password,
      data: { username: cleanUsername }
    })
    if (error) {
      setAuthError(getFriendlyError(error))
      throw error
    }
    
    // Update public.users with guaranteed unique username and selected plan
    if (data?.user) {
      setUser({
        ...data.user,
        uid: data.user.id,
        emailVerified: true
      })

      let selectedPlan = 'starter'
      let selectedCycle = 'monthly'
      try {
        const storedPlan = localStorage.getItem('sprintos_selected_plan')
        if (storedPlan) {
          const cleanP = storedPlan.toLowerCase().trim()
          if (['starter', 'free', 'team', 'pro', 'scale'].includes(cleanP)) {
            selectedPlan = (cleanP === 'free') ? 'starter' : (cleanP === 'scale' ? 'pro' : cleanP)
          }
        }
        const storedCycle = localStorage.getItem('sprintos_selected_cycle')
        if (storedCycle) {
          const cleanC = storedCycle.toLowerCase().trim()
          if (['monthly', 'annual'].includes(cleanC)) {
            selectedCycle = cleanC
          }
        }
      } catch (_) {}

      await supabase.from('users').upsert({ 
        id: data.user.id, 
        email: data.user.email,
        username: cleanUsername,
        billing_plan_id: 'starter',
        billing_interval: 'monthly',
        billing_status: 'active'
      }, { onConflict: 'id', ignoreDuplicates: true })

      if (selectedPlan && selectedPlan !== 'starter') {
        try {
          const { selectPlanServerSide } = await import('./plans')
          await selectPlanServerSide(selectedPlan, selectedCycle)
        } catch (_) {}
      }

      try {
        localStorage.removeItem('sprintos_selected_plan')
        localStorage.removeItem('sprintos_selected_cycle')
      } catch (_) {}

      // Refetch updated user profile into AuthContext state so route guards see username immediately
      const { data: updatedProfile } = await supabase.from('users').select('*').eq('id', data.user.id).maybeSingle()
      if (updatedProfile) {
        updatedProfile.legalAcceptedVersion = updatedProfile.legal_accepted_version
        updatedProfile.legalAcceptedAt = updatedProfile.legal_accepted_at
        updatedProfile.billingStatus = updatedProfile.billing_status || 'active'
        updatedProfile.billingPlanId = updatedProfile.billing_plan_id || selectedPlan
        updatedProfile.requiresPasswordReset = updatedProfile.requires_password_reset
        setUserData(updatedProfile)
      } else {
        setUserData({
          id: data.user.id,
          email: data.user.email,
          username,
          billing_plan_id: selectedPlan,
          billingPlanId: selectedPlan,
          billing_interval: selectedCycle,
          billing_status: 'active'
        })
      }
    }
    return data
  }

  const resolveEmailFromUsername = async (identifier) => {
    if (identifier.includes('@')) return identifier
    const { data, error } = await supabase.rpc('get_email_by_username', { uname: identifier })
    if (error || !data) throw new Error('Username not found')
    return data
  }

  const loginWithUsernameOrEmail = async (identifier, password) => {
    setAuthError(null)
    try {
      const email = await resolveEmailFromUsername(identifier)
      const cleanE = email.trim().toLowerCase()
      
      // 1. Standard sign in with Supabase Auth (hashed with bcrypt/Argon2)
      let { error, data } = await supabase.auth.signInWithPassword({ email: cleanE, password })

      // If user has a pending invite but has not registered their Auth credentials yet:
      if (error && (error.message?.includes('Invalid login credentials') || error.message?.includes('User not found'))) {
        const { data: inviteMatch } = await supabase
          .from('invites')
          .select('*')
          .ilike('email', cleanE)
          .maybeSingle()

        if (inviteMatch) {
          try {
            const signUpRes = await supabase.auth.signUp({
              email: cleanE,
              password: password,
              options: {
                data: {
                  must_change_password: true,
                  invited_workspace_id: inviteMatch.workspace_id,
                  invited_role: inviteMatch.role
                }
              }
            })
            if (!signUpRes.error && signUpRes.data?.user) {
              const loginRetry = await supabase.auth.signInWithPassword({ email: cleanE, password })
              if (!loginRetry.error && loginRetry.data) {
                setUserData(prev => ({ ...(prev || {}), requiresPasswordReset: true }))
                return { ...loginRetry.data, requiresPasswordReset: true, isInviteDirectLogin: true }
              }
            }
          } catch (_) {}
        }
      }

      if (error) {
        setAuthError(getFriendlyError(error))
        throw error
      }
      return data
    } catch (error) {
      setAuthError(getFriendlyError(error))
      throw error
    }
  }

  const sendLoginOtp = async (identifier) => {
    setAuthError(null)
    try {
      const email = await resolveEmailFromUsername(identifier)
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false }
      })
      if (error) {
        setAuthError(getFriendlyError(error))
        throw error
      }
      triggerSpamNotice()
      return email
    } catch (error) {
      setAuthError(getFriendlyError(error))
      throw error
    }
  }

  const signupWithEmail = async (email, password) => {
    setAuthError(null)
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + '/workspace'
      }
    })
    if (error) {
      setAuthError(getFriendlyError(error))
      throw error
    }
    return data
  }
  
  const acceptLegalTerms = async () => {
    if (!user) return
    const now = new Date().toISOString()
    try {
      sessionStorage.setItem(`p5_legal_v_${user.id}`, CURRENT_LEGAL_VERSION)
      sessionStorage.setItem(`p5_legal_at_${user.id}`, now)
    } catch (_) {}
    await supabase.from('users').update({ 
      legal_accepted_version: CURRENT_LEGAL_VERSION,
      legal_accepted_at: now
    }).eq('id', user.id)

    setUserData(prev => ({
      ...prev,
      legal_accepted_version: CURRENT_LEGAL_VERSION,
      legal_accepted_at: now,
      legalAcceptedVersion: CURRENT_LEGAL_VERSION,
      legalAcceptedAt: now,
      _isOptimistic: false
    }))
  }
  
  const resendVerification = async (emailToVerify) => {
    const email = emailToVerify || user?.email
    if (email) {
      return supabase.auth.resend({
        type: 'signup',
        email: email,
        options: { emailRedirectTo: window.location.origin + '/workspace' }
      })
    }
  }

  const resetPassword = async (email) => {
    const cleanEmail = (email || '').trim().toLowerCase()
    setAuthError(null)

    // 1. Verify existence and dispatch via serverless recovery function
    const resp = await fetch('/api/public?action=forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail })
    })

    const json = await resp.json().catch(() => ({}))

    if (!resp.ok || json.error) {
      const msg = json.error || 'No account found with this email address.'
      setAuthError(msg)
      return { data: null, error: new Error(msg) }
    }

    // 2. Also trigger Supabase client auth mailer in background for verified accounts
    supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/auth/action`,
    }).catch(() => {})

    return { data: json, error: null }
  }

  const logout = () => supabase.auth.signOut()

  const value = { 
    user, 
    userData,
    loading, 
    isPending2FA,
    setIsPending2FA,
    checkUsername,
    sendSignupOtp,
    verifyOtp,
    finalizeSignup,
    loginWithUsernameOrEmail,
    sendLoginOtp,
    signupWithEmail,
    acceptLegalTerms,
    resendVerification,
    resetPassword,
    logout: () => {
      setIsPending2FA(false)
      sessionCookieApi.clear()
      clearAuthStorage()
      return supabase.auth.signOut()
    }, 
    authError,
    getFriendlyError,
    clearAuthError: () => setAuthError(null)
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

