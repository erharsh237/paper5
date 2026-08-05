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
