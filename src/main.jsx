import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './lib/AuthContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import ConnectionStatus from './components/ConnectionStatus.jsx'
import { safeRedirect } from './lib/safeRedirect.js'
import * as Sentry from '@sentry/react'
import './index.css'
import './pages/Auth.css'

// Router Security Guard: Enforce same-origin and reject absolute external URLs
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    window.location.reload()
  })

  const originalPushState = window.history.pushState.bind(window.history)
  const originalReplaceState = window.history.replaceState.bind(window.history)

  const validateRouterTarget = (target) => {
    if (typeof target === 'string' && (target.startsWith('http://') || target.startsWith('https://'))) {
      const parsed = new URL(target, window.location.origin)
      if (parsed.origin !== window.location.origin) {
        throw new Error(`Security Violation: Router rejected absolute external URL: ${target}`)
      }
    }
  }

  window.history.pushState = function(state, unused, url) {
    if (url) validateRouterTarget(url)
    return originalPushState(state, unused, url)
  }

  window.history.replaceState = function(state, unused, url) {
    if (url) validateRouterTarget(url)
    return originalReplaceState(state, unused, url)
  }
}

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConnectionStatus />
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
