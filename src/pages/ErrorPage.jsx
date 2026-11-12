import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import SEOHead from '../components/SEOHead'
import { safeRedirect } from '../lib/safeRedirect'
import { getDomainConfig, getMainUrl } from '../lib/domain'
import './ErrorPage.css'

export default function ErrorPage({ error, errorInfo, resetError }) {
  const [showDetails, setShowDetails] = useState(false)
  const [copied, setCopied] = useState(false)
  const { isAppSubdomain } = getDomainConfig()

  // Generate deterministic-looking error reference for tracking
  const [errorRef] = useState(() => `ERR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`)

  const copyErrorDetails = () => {
    const details = `Error Reference: ${errorRef}\nMessage: ${error?.message || error?.toString() || 'Internal Server Error'}\nTimestamp: ${new Date().toISOString()}\nStack:\n${errorInfo?.componentStack || error?.stack || 'No stack trace available'}`
    navigator.clipboard.writeText(details)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReturnHome = () => {
    if (resetError) resetError()
    if (isAppSubdomain) {
      safeRedirect(getMainUrl('/'))
    } else {
      safeRedirect('/')
    }
  }

  const handleReload = () => {
    if (resetError) resetError()
    try {
      sessionStorage.clear()
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name))
        })
      }
    } catch (_) {}
    window.location.reload()
  }

  const hasDiagnostics = Boolean(error || errorInfo)

  return (
    <div className="server-500-page">
      <SEOHead
        title="500 — Server Error | Paper5"
        description="Our servers ran into an unexpected issue. Don't worry, your workspace data is safe."
        noIndex
      />

      <div className="server-500-container">
        {/* Top Header Split: "Server" on the left, "error?" on the right */}
        <div className="server-500-topbar">
          <span className="server-500-heading-left">Server</span>
          <span className="server-500-heading-right">error?</span>
        </div>

        {/* Centerpiece 5 [0-polygon] 0 row */}
        <div className="server-500-stage">
          <div className="server-digit server-digit-left">5</div>

          <div className="server-center-icon-wrap" role="img" aria-label="Geometric 500 status block">
            {/* Geometric pixel block representing the '0' */}
            <svg
              className="server-center-svg"
              viewBox="0 0 200 220"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {/* Stepped blocky polygon outer shell */}
              <path
                d="M75 10 H145 V50 H175 V130 H155 V150 H175 V180 H145 V200 H75 V180 H45 V150 H20 V90 H45 V50 H75 V10 Z"
                className="server-poly-outer"
              />
              {/* Stepped inner cutout */}
              <path
                d="M75 42 H135 V85 H145 V145 H125 V168 H75 V145 H52 V85 H75 V42 Z"
                className="server-poly-inner"
              />
              {/* Amber status beacon dot */}
              <circle
                cx="136"
                cy="110"
                r="18"
                className="server-focal-dot"
              />
            </svg>
          </div>

          <div className="server-digit server-digit-right">0</div>
        </div>

        {/* Bottom Framing Brackets & Action Area */}
        <div className="server-500-bottom">
          <span className="server-bracket server-bracket-left">[</span>

          <div className="server-action-center">
            <p className="server-desc">
              Our servers ran into an unexpected issue. Don't worry &mdash; your workspace data is safe.
            </p>

            <div className="server-btn-row">
              <button onClick={handleReload} className="server-cta-btn" type="button">
                <span className="server-cta-plus">&#8635;</span>
                <span>RELOAD PAGE</span>
              </button>

              {isAppSubdomain ? (
                <a href={getMainUrl('/')} onClick={handleReturnHome} className="server-cta-btn-ghost">
                  <span>GO BACK HOME</span>
                </a>
              ) : (
                <Link to="/" onClick={handleReturnHome} className="server-cta-btn-ghost">
                  <span>GO BACK HOME</span>
                </Link>
              )}
            </div>

            {/* Subtle diagnostic drawer */}
            <div className="server-diagnostics-wrap">
              <div className="server-meta-line">
                Error Code: 500 &middot; Ref: {errorRef}
              </div>

              {hasDiagnostics && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowDetails(!showDetails)}
                    className="server-diag-toggle"
                  >
                    {showDetails ? '▲ Hide Diagnostics' : '▼ View Diagnostics'}
                  </button>

                  {showDetails && (
                    <div className="server-diag-panel">
                      <div className="server-diag-panel-header">
                        <span className="server-diag-error-text">
                          {error?.name || 'Exception'}: {error?.message || error?.toString()}
                        </span>
                        <button
                          type="button"
                          onClick={copyErrorDetails}
                          className="server-diag-copy-btn"
                        >
                          {copied ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>

                      {(errorInfo?.componentStack || error?.stack) && (
                        <pre className="server-diag-stack">
                          {errorInfo?.componentStack || error?.stack}
                        </pre>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <span className="server-bracket server-bracket-right">]</span>
        </div>
      </div>
    </div>
  )
}
