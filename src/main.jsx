import React from 'react'
import ReactDOM from 'react-dom/client'
import ReactDOMServer from 'react-dom/server'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import App from './App.jsx'
import { title, description, ogImage, canonicalUrl } from './seo.js'
import { AuthProvider } from './lib/AuthContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import ConnectionStatus from './components/ConnectionStatus.jsx'
import { safeRedirect } from './lib/safeRedirect.js'
import { isSafeUrl } from './utils/security.js'
import * as Sentry from '@sentry/react'
import './index.css'
import './pages/Auth.css'

// Server-side rendering export
export function render(url = '/') {
  const html = ReactDOMServer.renderToString(
    <React.StrictMode>
      <ErrorBoundary>
        <MemoryRouter initialEntries={[url]}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </ErrorBoundary>
    </React.StrictMode>
  )

  const fullHtml = `<!doctype html>
<html lang="en">
<head>
  <title>${title}</title>
  <link rel="canonical" href="${canonicalUrl}">
  <meta name="description" content="${description}">
  <meta property="og:image" content="${ogImage}">
</head>
<body>
  <div id="root">${html}</div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>`

  return { html, fullHtml, title, description, ogImage }
}

// Router Security Guard: Enforce same-origin and reject absolute external URLs
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    window.location.reload()
  })

  const originalPushState = window.history.pushState.bind(window.history)
  const originalReplaceState = window.history.replaceState.bind(window.history)

  const validateRouterTarget = (target) => {
    if (typeof target === 'string') {
      if (target.startsWith('javascript:')) {
        console.warn('Unsafe URL blocked:', target)
        throw new Error(`Security Violation: Router rejected javascript URL: ${target}`)
      }
      if (target.startsWith('http://') || target.startsWith('https://')) {
        if (!isSafeUrl(target)) {
          console.warn('Unsafe URL blocked:', target)
          throw new Error(`Security Violation: Router rejected absolute external URL: ${target}`)
        }
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

  const rootElement = document.getElementById('root')
  if (rootElement) {
    // Clear any initial pre-render/loading content to ensure reliable client-side mount on TV & all browsers
    rootElement.innerHTML = ''

    ReactDOM.createRoot(rootElement).render(
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
  }
}
