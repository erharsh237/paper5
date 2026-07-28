import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // In production, wire this up to an error-tracking service if you add one.
    console.error('Unhandled UI error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12,
          fontFamily: 'Inter, sans-serif', color: 'var(--text-primary, #161b22)',
          padding: 24, textAlign: 'center', background: 'var(--bg-void, #f6f7f9)',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Something went wrong.</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary, #57606f)', maxWidth: 380 }}>
            Refresh the page. If this keeps happening, check the browser console for details.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: '9px 18px', borderRadius: 6, border: 'none',
              background: 'var(--accent-signal, #0f9d63)', color: '#fff', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
