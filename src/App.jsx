import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import { WorkspaceProvider, useWorkspace } from './lib/WorkspaceContext'
import LockedOverlay from './components/LockedOverlay'
import Login from './pages/Login'
import Signup from './pages/Signup'
import VerifyEmail from './pages/VerifyEmail'
import WorkspacePicker from './pages/WorkspacePicker'
import JoinWorkspace from './pages/JoinWorkspace'
import Landing from './pages/Landing'
import AuthAction from './pages/AuthAction'
import ForcePasswordReset from './pages/ForcePasswordReset'
// Auto-reloads page if a Vercel deploy replaced older JS bundle filenames
function safeLazy(componentImport) {
  return lazy(async () => {
    try {
      const component = await componentImport()
      sessionStorage.removeItem('chunk_reload_attempt')
      return component
    } catch (error) {
      const msg = error?.message || (typeof error === 'string' ? error : '')
      if (msg.includes('dynamically imported module') || msg.includes('Failed to fetch') || msg.includes('Loading chunk')) {
        const hasReloaded = sessionStorage.getItem('chunk_reload_attempt')
        if (!hasReloaded) {
          sessionStorage.setItem('chunk_reload_attempt', 'true')
          window.location.reload()
          return new Promise(() => {})
        }
      }
      throw error
    }
  })
}

// Route-based code splitting: each page ships as its own chunk, loaded only when visited.
const WorkflowPage = safeLazy(() => import('./pages/WorkflowPage'))
const MyDashboard = safeLazy(() => import('./pages/MyDashboard'))
const Dashboard = safeLazy(() => import('./pages/Dashboard'))
const Meeting = safeLazy(() => import('./pages/Meeting'))
const Analytics = safeLazy(() => import('./pages/Analytics'))
const Integrations = safeLazy(() => import('./pages/Integrations'))
const Profile = safeLazy(() => import('./pages/Profile'))
const Settings = safeLazy(() => import('./pages/Settings'))
const Legal = safeLazy(() => import('./pages/Legal'))
const ForgotPassword = safeLazy(() => import('./pages/ForgotPassword'))
import NotFound from './pages/NotFound'
import ErrorPage from './pages/ErrorPage'
import LegalConsentModal from './components/LegalConsentModal'
import OnboardingWizardModal from './components/OnboardingWizardModal'
import { Analytics as VercelAnalytics } from '@vercel/analytics/react'

// Marketing Pages
const Features = safeLazy(() => import('./pages/Features'))
const AboutUs = safeLazy(() => import('./pages/AboutUs'))
const ProductIntegrations = safeLazy(() => import('./pages/ProductIntegrationsPage'))
const DocsPage = safeLazy(() => import('./pages/DocsPage'))
import { 
  Changelog, Security 
} from './pages/MarketingPages'

import { getDomainConfig, getAppUrl, getMainUrl } from './lib/domain'
import InitialPreloader from './components/InitialPreloader'
import { Cardio } from 'ldrs/react'
import 'ldrs/react/Cardio.css'

function PageLoading() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      background: 'var(--bg-layer-1, #09090b)',
      color: 'var(--text-primary, #ffffff)',
    }}>
      <div style={{
        width: '42px',
        height: '42px',
        border: '3px solid rgba(16, 185, 129, 0.2)',
        borderTop: '3px solid #10b981',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <span style={{ fontSize: '13px', color: '#a1a1aa', fontWeight: 500, letterSpacing: '0.05em' }}>Loading SprintOS…</span>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

function CrossDomainRedirect({ toApp = false, path = '' }) {
  const target = toApp 
    ? getAppUrl(path || window.location.pathname + window.location.search) 
    : getMainUrl(path || window.location.pathname + window.location.search)
  
  if (target.startsWith('http')) {
    window.location.href = target
    return <PageLoading />
  }
  return <Navigate to={target} replace />
}

function WorkspaceGuard({ children }) {
  const { isLocked, is2FABlocked, loadingWorkspace, workspace, workspaceRole, workspaceError } = useWorkspace()
  if (loadingWorkspace) return <PageLoading />
  
  if (workspaceError || !workspace || !workspaceRole) {
    return <Navigate to="/workspace" replace />
  }

  if (is2FABlocked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-layer-1)' }}>
        <div style={{ padding: '32px', background: 'var(--bg-layer-2)', border: '1px solid var(--border)', borderRadius: '12px', maxWidth: '400px', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--accent-signal)' }}>🛡️</span> 2FA Required
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            This workspace enforces Two-Factor Authentication. Please enable 2FA in your Account Settings to access this workspace.
          </p>
          <a href="/workspace" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>Return to Pick Workspace</a>
        </div>
      </div>
    )
  }

  if (isLocked) return <LockedOverlay />
  return children
}

export default function App() {
  const { user, userData, loading, isPending2FA } = useAuth()
  const { isAppSubdomain } = getDomainConfig()

  if (loading) {
    return <PageLoading />
  }

  // If the user just accepted an invite or logged in with temporary password, force them to set it
  if (userData?.requiresPasswordReset || user?.user_metadata?.must_change_password) {
    return <ForcePasswordReset />
  }

  // If user is logged in but not verified, force them to the verify screen for all protected routes
  const requireAuthAndVerification = (children) => {
    if (!user) return <Navigate to="/login" replace />
    if (!user.emailVerified) return <Navigate to="/verify" replace />
    return children
  }

  return (
    <InitialPreloader>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          {/* Subdomain-aware Root Path */}
          <Route path="/" element={
            isAppSubdomain 
              ? (!user ? <Navigate to="/login" replace /> : <Navigate to="/workspace" replace />)
              : <Landing />
          } />

          <Route path="/auth/action" element={<AuthAction />} />
          <Route path="/reset-password" element={<AuthAction />} />
          <Route path="/workspace" element={
            !user ? <Navigate to="/login" replace /> :
            !user.emailVerified ? <Navigate to="/verify" replace /> :
            !(userData?.username || user?.user_metadata?.username || user?.email) ? <Navigate to="/signup" replace /> :
            <WorkspacePicker />
          } />
          <Route path="/login" element={user && user.emailVerified && (userData?.username || user?.user_metadata?.username || user?.email) && !isPending2FA ? <Navigate to="/workspace" replace /> : <Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify" element={
            (user && user.emailVerified) ? <Navigate to="/workspace" replace /> : 
            <VerifyEmail />
          } />
          
          <Route path="/join" element={
            !user ? <Navigate to={`/signup${window.location.search}`} replace /> :
            !user.emailVerified ? <Navigate to={`/verify${window.location.search}`} replace /> :
            !(userData?.username || user?.user_metadata?.username) ? <Navigate to={`/signup${window.location.search}`} replace /> :
            <JoinWorkspace />
          } />
          
          <Route path="/legal" element={<Navigate to="/legal/terms" replace />} />
          <Route path="/legal/:docId" element={<Legal />} />
          <Route path="/error" element={<ErrorPage />} />

          {/* Marketing Pages - Redirect to paper5.com if visited on app.paper5.com */}
          <Route path="/features" element={isAppSubdomain ? <CrossDomainRedirect toApp={false} /> : <Features />} />
          <Route path="/about" element={isAppSubdomain ? <CrossDomainRedirect toApp={false} /> : <AboutUs />} />
          <Route path="/product-integrations" element={isAppSubdomain ? <CrossDomainRedirect toApp={false} /> : <ProductIntegrations />} />
          <Route path="/changelog" element={isAppSubdomain ? <CrossDomainRedirect toApp={false} /> : <Changelog />} />
          <Route path="/docs" element={isAppSubdomain ? <CrossDomainRedirect toApp={false} /> : <DocsPage />} />
          <Route path="/docs/api" element={isAppSubdomain ? <CrossDomainRedirect toApp={false} /> : <DocsPage />} />
          <Route path="/security" element={isAppSubdomain ? <CrossDomainRedirect toApp={false} /> : <Security />} />

          {/* Workspace paths */}
          <Route path="/:workspaceId/*" element={
            requireAuthAndVerification(
              <WorkspaceProvider>
                <WorkspaceGuard>
                  <Routes>
                    <Route path="" element={<MyDashboard />} />
                    <Route path="workflow" element={<WorkflowPage />} />
                    <Route path="team" element={<Dashboard />} />
                    <Route path="meeting" element={<Meeting />} />
                    <Route path="analytics" element={<Analytics />} />
                    <Route path="integrations" element={<Integrations />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="profile" element={<Profile />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </WorkspaceGuard>
              </WorkspaceProvider>
            )
          } />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      {user && user.emailVerified && (
        <>
          <LegalConsentModal />
          <OnboardingWizardModal />
        </>
      )}
      <VercelAnalytics />
    </InitialPreloader>
  )
}
