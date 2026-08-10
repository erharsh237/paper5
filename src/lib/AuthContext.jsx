import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

/**
 * Thin client for the /api/auth/session Vercel serverless function.
 * Keeps httpOnly cookies in sync with the in-memory Supabase session.
 */
const sessionCookieApi = {
  /** Restore a persisted session from httpOnly cookies on page load. */
  async get() {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'same-origin' })
      if (res.status === 204) return null // no session cookie
      if (!res.ok) return null
      return await res.json() // { access_token, refresh_token, expires_at }
    } catch {
      return null // network error — treat as no session
    }
  },
  /** Persist a new/refreshed session to httpOnly cookies. */
  async set(session) {
    if (!session?.access_token || !session?.refresh_token) return
    try {
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
      await fetch('/api/auth/session', { method: 'DELETE', credentials: 'same-origin' })
    } catch {
      console.warn('[SessionCookieApi] Failed to clear session cookie.')
    }
  },
}

export const CURRENT_LEGAL_VERSION = '1.0'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)
  const [isPending2FA, setIsPending2FA] = useState(false)

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
      setUser(u)

      // Fetch user data
      const fetchUserData = async () => {
        const { data } = await supabase.from('users').select('*').eq('id', u.id).maybeSingle()
        if (data) {
          data.legalAcceptedVersion = data.legal_accepted_version
          data.legalAcceptedAt = data.legal_accepted_at
          data.billingStatus = data.billing_status
          data.billingPlanId = data.billing_plan_id
          data.requiresPasswordReset = data.requires_password_reset
        }
        setUserData(data)
        setLoading(false)

        // Try to auto-redeem any pending invites for this user
        if (data) {
          supabase.rpc('redeem_my_invites').then(({ error }) => {
            if (error) console.error('Auto-redeem failed:', error)
          })
        }
      }
      
      fetchUserData()

      // Subscribe to realtime updates on users table
      channel = supabase.channel(`public:users:id=eq.${u.id}:auth:${Math.random().toString(36).substring(7)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${u.id}` }, (payload) => {
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

    // ── Hydrate session from httpOnly cookie on page load ──────────────────
    // Since we no longer use localStorage, we restore the persisted session by
    // reading tokens from the server-side httpOnly cookie and calling setSession.
    const hydrateFromCookie = async () => {
      const stored = await sessionCookieApi.get()
      if (stored?.access_token && stored?.refresh_token) {
        const { data: { session }, error } = await supabase.auth.setSession({
          access_token:  stored.access_token,
          refresh_token: stored.refresh_token,
        })
        if (error) {
          // Stored tokens are expired/invalid — clear the stale cookie
          await sessionCookieApi.clear()
        } else if (session) {
          // setSession triggers onAuthStateChange internally; setupUser runs from there
          return
        }
      }
      // No valid stored session — fall through to getSession() for magic link / URL flows
      supabase.auth.getSession().then(({ data: { session } }) => {
        currentUserId = session?.user?.id ?? null
        setupUser(session)
      })
    }

    // Listen for auth changes
    let currentUserId = null

    hydrateFromCookie()
    const { data: authSubscription } = supabase.auth.onAuthStateChange(async (event, session) => {
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
      return 'Invalid verification code. Please check the 8-digit code sent to your email or request a new one.'
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

  const checkUsername = async (username) => {
    const { data, error } = await supabase.rpc('check_username_available', { uname: username })
    if (error) throw error
    return data
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
  }

  const verifyOtp = async (email, token) => {
    setAuthError(null)
    
    // Depending on whether the user is new or existing, Supabase sends different token types
    // We try them in order of likelihood for our flow.
    const typesToTry = ['signup', 'magiclink', 'email']
    let lastError = null;

    for (const type of typesToTry) {
      const { data, error } = await supabase.auth.verifyOtp({ email, token, type })
      if (!error && data?.session) {
        return data
      }
      lastError = error
    }

    setAuthError(getFriendlyError(lastError))
    throw lastError
  }

  const finalizeSignup = async (password, username) => {
    setAuthError(null)
    const { error, data } = await supabase.auth.updateUser({
      password,
      data: { username }
    })
    if (error) {
      setAuthError(getFriendlyError(error))
      throw error
    }
    
    // Update public.users with username
    if (data?.user) {
      setUser({
        ...data.user,
        uid: data.user.id,
        emailVerified: true
      })

      await supabase.from('users').upsert({ 
        id: data.user.id, 
        email: data.user.email,
        username,
        billing_plan_id: 'unselected',
        updated_at: new Date().toISOString() 
      })

      // Refetch updated user profile into AuthContext state so route guards see username immediately
      const { data: updatedProfile } = await supabase.from('users').select('*').eq('id', data.user.id).maybeSingle()
      if (updatedProfile) {
        updatedProfile.legalAcceptedVersion = updatedProfile.legal_accepted_version
        updatedProfile.legalAcceptedAt = updatedProfile.legal_accepted_at
        updatedProfile.billingStatus = updatedProfile.billing_status
        updatedProfile.billingPlanId = updatedProfile.billing_plan_id
        updatedProfile.requiresPasswordReset = updatedProfile.requires_password_reset
        setUserData(updatedProfile)
      } else {
        setUserData({
          id: data.user.id,
          email: data.user.email,
          username,
          billing_plan_id: 'unselected',
          billingPlanId: 'unselected'
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
      const { error, data } = await supabase.auth.signInWithPassword({ email, password })
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
    await supabase.from('users').update({ 
      legal_accepted_version: CURRENT_LEGAL_VERSION,
      legal_accepted_at: now
    }).eq('id', user.id)

    setUserData(prev => ({
      ...prev,
      legal_accepted_version: CURRENT_LEGAL_VERSION,
      legal_accepted_at: now,
      legalAcceptedVersion: CURRENT_LEGAL_VERSION,
      legalAcceptedAt: now
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
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/action`,
    })
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

