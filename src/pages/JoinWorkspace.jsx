import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
// removed firebase imports
import './Auth.css'

export default function JoinWorkspace() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const workspaceId = searchParams.get('workspace')
  const inviteId = searchParams.get('inviteId')
  const rawToken = searchParams.get('token')

  useEffect(() => {
    if (!workspaceId || !inviteId || !rawToken) {
      setError('Authentication failed: The invite link is invalid or missing required parameters.')
      setLoading(false)
      return
    }

    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      return
    }


    const redeem = async () => {
      try {
        const { supabase } = await import('../lib/supabase')
        const { data, error } = await supabase.functions.invoke('redeem-invite', {
          body: { workspaceId, inviteId, rawToken: rawToken }
        })
        if (error) throw error
        if (data?.error) throw new Error(data.error)

        navigate(`/${workspaceId}`)
      } catch (err) {
        console.error('Invite redemption failed:', err)
        setError('Workspace access denied. The invitation link may have expired or been revoked.')
      } finally {
        setLoading(false)
      }
    }

    redeem()
  }, [workspaceId, inviteId, rawToken, navigate])

  return (
    <div className="auth-layout">
      <div className="auth-showcase-bg" aria-hidden="true" />
      <div className="auth-form-side">
        <div className="auth-form-container glass-panel" style={{ textAlign: 'center' }}>
          <div className="auth-logo" style={{ justifyContent: 'center', marginBottom: 24, color: 'var(--text-primary)' }}>
            <span className="auth-logo-dot" />
            SprintOS
          </div>
        
        {loading ? (
          <>
            <h1 style={{ marginBottom: '12px' }}>Joining workspace...</h1>
            <p className="auth-subtitle">Please wait while we verify your invitation.</p>
          </>
        ) : error ? (
          <>
            <h1 style={{ marginBottom: '12px', color: 'var(--accent-critical)' }}>Failed to join</h1>
            <p className="auth-subtitle" style={{ marginBottom: '24px' }}>{error}</p>
            <button className="btn-primary" style={{ justifyContent: 'center', width: '100%' }} onClick={() => navigate('/')}>
              Go to my workspaces
            </button>
            <button className="btn-ghost" style={{ marginTop: '16px', color: 'var(--text-tertiary)' }} onClick={logout}>
              Sign out
            </button>
          </>
        ) : null}
        </div>
      </div>
    </div>
  )
}
