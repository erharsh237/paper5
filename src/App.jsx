import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import { firebaseConfigError } from './lib/firebase'
import Login from './pages/Login'
import ConfigErrorPage from './pages/ConfigErrorPage'

// Route-based code splitting: each page ships as its own chunk, loaded only
// when actually visited. Analytics (recharts) is the heaviest remaining
// dependency-carrying page — previously every visitor downloaded it just
// to see their personal task list at "/".
const MyDashboard = lazy(() => import('./pages/MyDashboard'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Meeting = lazy(() => import('./pages/Meeting'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Integrations = lazy(() => import('./pages/Integrations'))
const AIAssistant = lazy(() => import('./pages/AIAssistant'))
const Profile = lazy(() => import('./pages/Profile'))
const NotFound = lazy(() => import('./pages/NotFound'))

function PageLoading() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-tertiary)', fontFamily: 'var(--mono)', fontSize: 13,
    }}>
      loading…
    </div>
  )
}

export default function App() {
  const { user, loading, accessDenied, denialReason } = useAuth()

  if (firebaseConfigError) {
    return <ConfigErrorPage message={firebaseConfigError} />
  }

  if (loading) {
    return <PageLoading />
  }

  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/" element={user ? <MyDashboard /> : <Login accessDenied={accessDenied} denialReason={denialReason} />} />
        <Route path="/team" element={user ? <Dashboard /> : <Login accessDenied={accessDenied} denialReason={denialReason} />} />
        <Route path="/meeting" element={user ? <Meeting /> : <Login accessDenied={accessDenied} denialReason={denialReason} />} />
        <Route path="/analytics" element={user ? <Analytics /> : <Login accessDenied={accessDenied} denialReason={denialReason} />} />
        <Route path="/integrations" element={user ? <Integrations /> : <Login accessDenied={accessDenied} denialReason={denialReason} />} />
        <Route path="/ai" element={user ? <AIAssistant /> : <Login accessDenied={accessDenied} denialReason={denialReason} />} />
        <Route path="/profile" element={user ? <Profile /> : <Login accessDenied={accessDenied} denialReason={denialReason} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
