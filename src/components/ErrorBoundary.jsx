import { Component } from 'react'
import ErrorPage from '../pages/ErrorPage'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info)
    const msg = error?.message || ''
    if (
      msg.includes("reading 'default'") ||
      msg.includes('dynamically imported module') ||
      msg.includes('Failed to fetch') ||
      msg.includes('Loading chunk')
    ) {
      try {
        const lastReload = sessionStorage.getItem('p5_chunk_reload')
        const now = Date.now()
        if (!lastReload || now - parseInt(lastReload, 10) > 30000) {
          sessionStorage.setItem('p5_chunk_reload', String(now))
          window.location.reload()
          return
        }
      } catch (_) {}
    }
    this.setState({ errorInfo: info })
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorPage 
          error={this.state.error} 
          errorInfo={this.state.errorInfo} 
          resetError={() => this.setState({ hasError: false, error: null, errorInfo: null })}
        />
      )
    }
    return this.props.children
  }
}
