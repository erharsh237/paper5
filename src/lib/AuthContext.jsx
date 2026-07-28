import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth'
import { auth, googleProvider } from './firebase'
import { isEmailAllowed } from './allowlist'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [denialReason, setDenialReason] = useState(null) // 'not_allowed' | 'check_failed' | 'redirect_failed' | null

  // Surfaces errors from the redirect sign-in flow itself (e.g. unauthorized
  // domain, blocked by the embedding app) — onAuthStateChanged below only
  // ever sees a *successful* sign-in, so without this a failed redirect
  // would just silently drop the user back at the login screen with no
  // explanation of what went wrong.
  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      console.error('Redirect sign-in failed:', err)
      setDenialReason('redirect_failed')
      setAccessDenied(true)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null)
        setAccessDenied(false)
        setDenialReason(null)
        setLoading(false)
        return
      }

      try {
        const allowed = await Promise.race([
          isEmailAllowed(u.email),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Allowlist check timed out')), 8000)
          ),
        ])
        if (!allowed) {
          setAccessDenied(true)
          setDenialReason('not_allowed')
          setUser(null)
          await signOut(auth)
        } else {
          setAccessDenied(false)
          setDenialReason(null)
          setUser(u)
        }
      } catch (err) {
        // If the allowlist check itself fails or times out (e.g. blocked
        // request, network issue), fail closed — deny rather than hang
        // forever or silently grant access.
        console.error('Allowlist check failed:', err)
        setAccessDenied(true)
        setDenialReason('check_failed')
        setUser(null)
        try {
          await signOut(auth)
        } catch (signOutErr) {
          console.error('Sign-out after denial also failed:', signOutErr)
        }
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const login = () => signInWithRedirect(auth, googleProvider)
  const logout = () => signOut(auth)

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, accessDenied, denialReason }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
