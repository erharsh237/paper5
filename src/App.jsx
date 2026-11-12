import { ThemeProvider } from './lib/ThemeContext'
import { useLenis } from './hooks/useLenis'
import ScrollToTop from './components/ScrollToTop'
import FloatingNotice from './components/FloatingNotice'
import { Suspense, lazy, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import { WorkspaceProvider, useWorkspace } from './lib/WorkspaceContext'
import LockedOverlay from './components/LockedOverlay'
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
const Landing = safeLazy(() => import('./pages/Landing'))
const Login = safeLazy(() => import('./pages/Login'))
const Signup = safeLazy(() => import('./pages/Signup'))
const VerifyEmail = safeLazy(() => import('./pages/VerifyEmail'))
const WorkspacePicker = safeLazy(() => import('./pages/WorkspacePicker'))
const JoinWorkspace = safeLazy(() => import('./pages/JoinWorkspace'))
const AuthAction = safeLazy(() => import('./pages/AuthAction'))
const ForcePasswordReset = safeLazy(() => import('./pages/ForcePasswordReset'))

const WorkflowPage = safeLazy(() => import('./pages/WorkflowPage'))
const MyDashboard = safeLazy(() => import('./pages/MyDashboard'))
const Dashboard = safeLazy(() => import('./pages/Dashboard'))
const Meeting = safeLazy(() => import('./pages/Meeting'))
const Analytics = safeLazy(() => import('./pages/Analytics'))
const Integrations = safeLazy(() => import('./pages/Integrations'))
const Profile = safeLazy(() => import('./pages/Profile'))
const Settings = safeLazy(() => import('./pages/Settings'))
const Legal = safeLazy(() => import('./pages/Legal'))
const Privacy = safeLazy(() => import('./pages/Privacy'))
const Contact = safeLazy(() => import('./pages/Contact'))
const ThankYou = safeLazy(() => import('./pages/ThankYou'))
const ForgotPassword = safeLazy(() => import('./pages/ForgotPassword'))

// Marketing Pages
const Features = safeLazy(() => import('./pages/Features'))
const AboutUs = safeLazy(() => import('./pages/AboutUs'))
const ProductIntegrations = safeLazy(() => import('./pages/ProductIntegrationsPage'))
const DocsPage = safeLazy(() => import('./pages/DocsPage'))
const Changelog = safeLazy(() => import('./pages/MarketingPages').then(m => ({ default: m.Changelog })))
const Security = safeLazy(() => import('./pages/MarketingPages').then(m => ({ default: m.Security })))
import NotFound from './pages/NotFound'
import ErrorPage from './pages/ErrorPage'
const LegalConsentModal = safeLazy(() => import('./components/LegalConsentModal'))
const OnboardingWizardModal = safeLazy(() => import('./components/OnboardingWizardModal'))
const PrivacyNotice = lazy(() =>
  import('./components/PrivacyNotice').catch(() => ({ default: () => null }))
)
const VercelAnalytics = lazy(() =>
  import('@vercel/analytics/react')
    .then((m) => ({ default: m.Analytics }))
    .catch(() => ({ default: () => null }))
)

import { getDomainConfig, getAppUrl, getMainUrl } from './lib/domain'
import { safeRedirect } from './lib/safeRedirect'
import InitialPreloader from './components/InitialPreloader'
import SEOHead from './components/SEOHead'
import { hasAnalyticsConsent, subscribeConsent } from './lib/privacyPrefs'
import { initGA4, trackPageView } from './lib/metrics'
import { useLivePresenceTracker } from './hooks/useLivePresence'
import { Cardio } from 'ldrs/react'
import 'ldrs/react/Cardio.css'

function WorkspaceSubpageLoader() {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      color: '#64748b',
      fontFamily: 'sans-serif',
      fontSize: '13px',
      fontWeight: 600
    }}>
      <div style={{
        width: '24px',
        height: '24px',
        border: '2.5px solid #e2e8f0',
        borderTopColor: '#4f46e5',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite'
      }} />
      <span>Loading...</span>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function PageLoading() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '14px',
      background: '#ffffff',
      color: '#000000',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#000000', display: 'inline-block' }} />
        <span style={{ fontFamily: 'var(--mono, "JetBrains Mono", monospace)', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.02em', color: '#000000' }}>
          Paper5
        </span>
      </div>

      <Cardio
        size="48"
        stroke="3.5"
        speed="2"
        color="#d1d5db"
      />

      <span style={{ fontFamily: 'var(--mono, "JetBrains Mono", monospace)', fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: '2px' }}>
        LOADING WORKSPACE...
      </span>
    </div>
  )
}

function CrossDomainRedirect({ toApp = false, path = '' }) {
  const target = toApp 
    ? getAppUrl(path || window.location.pathname + window.location.search) 
    : getMainUrl(path || window.location.pathname + window.location.search)
  
  if (target.startsWith('https://')) {
    window.location.replace(target)
    return <PageLoading />
  }
  if (target.startsWith('http://') && (target.includes('localhost') || target.includes('127.0.0.1'))) {
    window.location.replace(target)
    return <PageLoading />
  }
  return <Navigate to={target} replace />
}

function WorkspaceGuard({ children }) {
  const { isLocked, isCapacityFrozen, capacityDetails, is2FABlocked, loadingWorkspace, workspace, workspaceRole, workspaceError, isAdmin, isOwner } = useWorkspace()
  const location = useLocation()

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

  // Strict Workspace Capacity Freeze Enforcement
  if (isCapacityFrozen) {
    const isSettingsPage = location.pathname.endsWith('/settings') || location.pathname.includes('/settings')
    
    // Admins and owners are locked out of all activity pages (Dashboard, Workflow, Meeting, etc.) and directed to Settings to remove excess users or upgrade
    if (isAdmin || isOwner) {
      if (!isSettingsPage) {
        return <Navigate to={`/${workspace.id}/settings`} replace />
      }
      return children
    }
    
    // Regular members are completely blocked from workspace activities
    return (
      <div style={{
        minHeight: '100vh',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center'
      }}>
        <div style={{
          maxWidth: '480px',
          background: '#ffffff',
          padding: '36px 32px',
          borderRadius: '16px',
          border: '1px solid #fee2e2',
          boxShadow: '0 20px 40px rgba(239, 68, 68, 0.08)'
        }}>
          <div style={{
            width: '54px',
            height: '54px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            fontSize: '24px'
          }}>
            🚨
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 12px', color: '#111827' }}>
            WORKSPACE ACCESS FROZEN
          </h2>
          <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.6', margin: '0 0 24px' }}>
            This workspace has exceeded its <strong>{capacityDetails?.planId || 'STARTER'} Plan</strong> capacity ({capacityDetails?.totalSeatsUsed || 0} / {capacityDetails?.maxAllowedMembers || 3} members).
            <br /><br />
            Workspace activities are strictly frozen. The Workspace Admin must delete/remove excess members or upgrade the plan to restore workspace access.
          </p>
          <a href="/workspace" className="btn-primary" style={{ display: 'inline-flex', padding: '10px 20px', textDecoration: 'none', justifyContent: 'center' }}>
            Return to My Workspaces
          </a>
        </div>
      </div>
    )
  }

  if (isLocked) return <LockedOverlay />
  return (
    <>
      <SEOHead title="Workspace | Paper5" description="Private team workspace on Paper5." noIndex />
      {children}
    </>
  )
}

export default function App() {
  useLivePresenceTracker()
  useLenis()
  const location = useLocation()
  const { user, userData, loading, isPending2FA } = useAuth()
  const [analyticsConsent, setAnalyticsConsent] = useState(() => hasAnalyticsConsent())

  useEffect(() => {
    if (analyticsConsent) {
      initGA4()
      trackPageView(location.pathname, document.title)
    }
  }, [analyticsConsent, location.pathname])

  useEffect(() => {
    return subscribeConsent((state) => {
      setAnalyticsConsent(Boolean(state?.analytics))
    })
  }, [])
  const { isAppSubdomain, hostname } = getDomainConfig()
  const isMarketingRootHost = hostname === 'paper5.co' || hostname === 'www.paper5.co'
  const allowWorkspaceRoutes = isAppSubdomain || (!isMarketingRootHost && (Boolean(user) || hostname.endsWith('.vercel.app')))

  // Legal compliance documents and public marketing routes should NEVER be blocked by Auth loading
  const isLegalRoute = (
    location.pathname === '/terms' ||
    location.pathname === '/privacy' ||
    location.pathname === '/dpa' ||
    location.pathname === '/subprocessors' ||
    location.pathname.startsWith('/legal')
  )

  const isPublicMarketingRoute = isLegalRoute || (!isAppSubdomain && (
    location.pathname === '/' ||
    location.pathname === '/pricing' ||
    location.pathname === '/features' ||
    location.pathname === '/about' ||
    location.pathname === '/contact' ||
    location.pathname === '/product-integrations' ||
    location.pathname === '/changelog' ||
    location.pathname === '/docs' ||
    location.pathname.startsWith('/docs/') ||
    location.pathname === '/security'
  ))

  if (loading && !isPublicMarketingRoute) {
    return <PageLoading />
  }

  // If the user just accepted an invite or logged in with temporary password, force them to set it
  if (userData?.requiresPasswordReset || user?.user_metadata?.must_change_password) {
    return <ForcePasswordReset />
  }

  // If user is logged in but not verified or has pending 2FA, force them to login/verify screen
  const requireAuthAndVerification = (children) => {
    if (loading) return <PageLoading />
    if (!user) return <Navigate to="/login" replace />
    if (isPending2FA) return <Navigate to="/login" replace />
    if (!user.emailVerified) return <Navigate to="/verify" replace />
    return children
  }

  return (
    <ThemeProvider>
      <InitialPreloader>
      <ScrollToTop />
      <FloatingNotice />
      <Suspense fallback={<PageLoading />}>
        <Routes>
          {/* Subdomain-aware Root Path */}
          <Route path="/" element={
            isAppSubdomain 
              ? (loading ? <PageLoading /> : (!user || isPending2FA ? <Navigate to="/login" replace /> : <Navigate to="/workspace" replace />))
              : <Landing />
          } />

          <Route path="/auth/action" element={<AuthAction />} />
          <Route path="/reset-password" element={<AuthAction />} />
          <Route path="/workspace" element={
            loading ? <PageLoading /> :
            !user || isPending2FA ? <Navigate to="/login" replace /> :
            !user.emailVerified ? <Navigate to="/verify" replace /> :
            <WorkspacePicker />
          } />
          <Route path="/login" element={user && user.emailVerified && !isPending2FA ? <Navigate to="/workspace" replace /> : <Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify" element={
            (user && user.emailVerified) ? <Navigate to="/workspace" replace /> : 
            <VerifyEmail />
          } />
          
          <Route path="/join" element={
            !user ? <Navigate to={`/signup${window.location.search}`} replace /> :
            !user.emailVerified ? <Navigate to={`/verify${window.location.search}`} replace /> :
            <JoinWorkspace />
          } />
          
          <Route path="/legal" element={<Navigate to="/legal/terms" replace />} />
          <Route path="/legal/:docId" element={<Legal />} />
          <Route path="/terms" element={<Legal defaultDocId="terms" />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/dpa" element={<Legal defaultDocId="dpa" />} />
          <Route path="/subprocessors" element={<Legal defaultDocId="subprocessors" />} />
          <Route path="/contact" element={isAppSubdomain ? <CrossDomainRedirect toApp={false} /> : <Contact />} />
          <Route path="/thank-you" element={isAppSubdomain ? <CrossDomainRedirect toApp={false} /> : <ThankYou />} />
          <Route path="/about-us" element={<Navigate to="/about" replace />} />
          <Route path="/error" element={<ErrorPage />} />

          {/* Marketing Pages - Redirect to paper5.com if visited on app.paper5.com */}
          <Route path="/pricing" element={isAppSubdomain ? <CrossDomainRedirect toApp={false} path="/#pricing" /> : <Landing />} />
          <Route path="/features" element={isAppSubdomain ? <CrossDomainRedirect toApp={false} /> : <Features />} />
          <Route path="/about" element={isAppSubdomain ? <CrossDomainRedirect toApp={false} /> : <AboutUs />} />
          <Route path="/product-integrations" element={isAppSubdomain ? <CrossDomainRedirect toApp={false} /> : <ProductIntegrations />} />
          <Route path="/changelog" element={isAppSubdomain ? <CrossDomainRedirect toApp={false} /> : <Changelog />} />
          <Route path="/docs" element={isAppSubdomain ? <CrossDomainRedirect toApp={false} /> : <DocsPage />} />
          <Route path="/docs/api" element={isAppSubdomain ? <CrossDomainRedirect toApp={false} /> : <DocsPage />} />
          <Route path="/security" element={isAppSubdomain ? <CrossDomainRedirect toApp={false} /> : <Security />} />

          {/* Workspace paths (app subdomain, preview deploys, or authenticated local dev; unknown paths on paper5.co fall through to 404) */}
          {allowWorkspaceRoutes && (
            <Route path="/:workspaceId/*" element={
              requireAuthAndVerification(
                <WorkspaceProvider>
                  <WorkspaceGuard>
                    <Suspense fallback={<WorkspaceSubpageLoader />}>
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
                    </Suspense>
                  </WorkspaceGuard>
                </WorkspaceProvider>
              )
            } />
          )}
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      {user && user.emailVerified && (
        <Suspense fallback={null}>
          <LegalConsentModal />
          <OnboardingWizardModal />
        </Suspense>
      )}
      {analyticsConsent && (
        <Suspense fallback={null}>
          <VercelAnalytics />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <PrivacyNotice />
      </Suspense>
    </InitialPreloader>
    </ThemeProvider>
  )
}
