import { useAuth } from './lib/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

export default function App() {
  const { user, loading, accessDenied, denialReason } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-tertiary)', fontFamily: 'var(--mono)', fontSize: 13,
      }}>
        loading…
      </div>
    )
  }

  return user ? <Dashboard /> : <Login accessDenied={accessDenied} denialReason={denialReason} />
}
