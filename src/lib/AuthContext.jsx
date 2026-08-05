import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

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
        emailVerified: !!session.user.email_confirmed_at 
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

    // Listen for auth changes
    let currentUserId = null

    // Initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      currentUserId = session?.user?.id ?? null
      setupUser(session)
    })
    const { data: authSubscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Supabase's internal `visibilitychange` listener runs session recovery
      // every time the tab regains focus. Depending on internal state this can
      // emit either TOKEN_REFRESHED or SIGNED_IN even when it's the exact same
      // already-logged-in user. If the user id hasn't actually changed, there's
      // nothing to re-setup — skip it so we don't reset loading, refetch user
      // data, and tear down/recreate the realtime channel on every tab switch.
      const sameUser = session?.user?.id != null && session.user.id === currentUserId
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
    const msg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
    if (msg.includes('Invalid login credentials')) return 'Invalid email or password.'
    if (msg.includes('already registered')) return 'This email address is already registered.'
    if (msg === '{}') return 'SMTP Error: Please check your Supabase custom SMTP settings (Ensure Sender Email domain is verified in Resend, or if using onboarding@resend.dev, it can only send to your own registered email address).'
    return msg || 'An unknown authentication error occurred.'
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
    const { data, error } = await supabase.auth.updateUser({ password })
    if (error) {
      setAuthError(getFriendlyError(error))
      throw error
    }
    
    // Update public.users with username
    if (data?.user) {
      await supabase.from('users').update({ username }).eq('id', data.user.id)
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
    clearAuthError: () => setAuthError(null)
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

