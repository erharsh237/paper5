import React, { useState } from 'react'
import logo from '../assets/logo.png'
import './NotFound.css'

export default function ErrorPage({ error, errorInfo, resetError }) {
  const [showDetails, setShowDetails] = useState(false)
  const [copied, setCopied] = useState(false)

  const errorRef = `ERR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

  const copyErrorDetails = () => {
    const details = `Error Reference: ${errorRef}\nMessage: ${error?.message || error?.toString()}\nTimestamp: ${new Date().toISOString()}\nStack:\n${errorInfo?.componentStack || error?.stack || 'No stack trace available'}`
    navigator.clipboard.writeText(details)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReturnHome = () => {
    if (resetError) resetError()
    window.location.href = '/'
  }

  const handleReload = () => {
    if (resetError) resetError()
    sessionStorage.clear()
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name))
      })
    }
    window.location.reload()
  }

  return (
    <div className="nf-wrap" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="nf-card glass-panel" style={{ maxWidth: '640px', width: '100%', textAlign: 'center', padding: '40px 32px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '20px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-primary)', marginBottom: '20px' }}>
          Paper5 <span style={{ opacity: 0.5, fontWeight: 400 }}>| SprintOS</span>
        </div>

        <div className="nf-badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-critical, #ef4444)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <span className="nf-dot" style={{ background: 'var(--accent-critical, #ef4444)' }} />
          System Anomaly · Ref: {errorRef}
        </div>

        <h1 className="nf-title" style={{ fontSize: '26px', marginTop: '16px', marginBottom: '12px' }}>
          Something unexpected happened.
        </h1>
        <p className="nf-sub" style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
          SprintOS encountered an unhandled exception. Don't worry — your data is safely saved in your workspace.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '24px' }}>
          <button onClick={handleReturnHome} className="btn-primary" style={{ padding: '10px 20px', fontSize: '14px' }}>
            Return to Workspace →
          </button>
          <button onClick={handleReload} className="btn-ghost" style={{ padding: '10px 20px', fontSize: '14px' }}>
            Reload Page
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))', paddingTop: '20px', marginTop: '12px' }}>
          <button 
            onClick={() => setShowDetails(!showDetails)} 
            className="btn-ghost btn-sm"
            style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}
          >
            {showDetails ? '▲ Hide Developer Diagnostics' : '▼ View Developer Diagnostics'}
          </button>

          {showDetails && (
            <div style={{ marginTop: '16px', textAlign: 'left', background: 'var(--bg-layer-2, #0d1117)', border: '1px solid var(--border, #30363d)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="mono" style={{ fontSize: '12px', color: 'var(--accent-critical, #ef4444)' }}>
                  {error?.name || 'Error'}: {error?.message || error?.toString()}
                </span>
                <button onClick={copyErrorDetails} className="btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: '11px' }}>
                  {copied ? '✓ Copied' : 'Copy Diagnostics'}
                </button>
              </div>

              {(errorInfo?.componentStack || error?.stack) && (
                <pre style={{ margin: 0, padding: '12px', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-secondary)', overflowX: 'auto', maxHeight: '200px', fontFamily: 'var(--mono, monospace)', whiteSpace: 'pre-wrap' }}>
                  {errorInfo?.componentStack || error?.stack}
                </pre>
              )}
            </div>
          )}
        </div>

        <div className="nf-footnote mono" style={{ marginTop: '24px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
          SprintOS by Paper5 · Exception Handled Safely
        </div>
      </div>
    </div>
  )
}
