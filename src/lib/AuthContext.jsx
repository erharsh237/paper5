import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from './firebase'
import { isEmailAllowed } from './allowlist'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null)
        setAccessDenied(false)
        setLoading(false)
        return
      }

      try {
        const allowed = await isEmailAllowed(u.email)
        if (!allowed) {
          setAccessDenied(true)
          setUser(null)
          await signOut(auth)
        } else {
          setAccessDenied(false)
          setUser(u)
        }
      } catch (err) {
        // If the allowlist check itself fails (e.g. rules reject the read),
        // fail closed — treat as denied rather than granting access.
        console.error('Allowlist check failed:', err)
        setAccessDenied(true)
        setUser(null)
        await signOut(auth)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const login = () => signInWithPopup(auth, googleProvider)
  const logout = () => signOut(auth)

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, accessDenied }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
