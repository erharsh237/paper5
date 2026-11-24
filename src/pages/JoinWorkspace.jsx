import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import './Auth.css'
import SEOHead from '../components/SEOHead'

export default function JoinWorkspace() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const workspaceId = searchParams.get('workspace') || searchParams.get('workspaceId')
  const inviteId = searchParams.get('inviteId')
  const rawToken = searchParams.get('token')
  const emailParam = searchParams.get('email')

  useEffect(() => {
    if (!workspaceId && !emailParam && !inviteId) {
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
        // Step 1: Accept invite via secure serverless endpoint
        const resp = await fetch('/api/accept-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            userId: user.id,
            workspaceId,
            inviteId
          })
        })
        const data = await resp.json().catch(() => ({}))
        
        if (resp.ok && data?.success) {
          const targetWs = data.workspaceId || workspaceId
          if (targetWs) {
            navigate(`/${targetWs}`)
            return
          }
        }

        // If rawToken was supplied, try fallback edge function
        if (rawToken && workspaceId && inviteId) {
          const { supabase } = await import('../lib/supabase')
          const { data: edgeData, error: edgeError } = await supabase.functions.invoke('redeem-invite', {
            body: { workspaceId, inviteId, rawToken: rawToken }
          })
          if (!edgeError && edgeData?.success) {
            navigate(`/${workspaceId}`)
            return
          }
        }

        throw new Error(data?.error || 'Workspace access denied. The invitation link may have expired or been replaced by a newer invitation.')
      } catch (err) {
        console.error('Invite redemption failed:', err)
        setError(err.message || 'Workspace access denied. The invitation link may have expired or been revoked.')
      } finally {
        setLoading(false)
      }
    }

    redeem()
  }, [workspaceId, inviteId, rawToken, emailParam, user, navigate])

  return (
    <div className="auth-layout">
      <SEOHead title="Join Workspace | Paper5" description="Accept your team invitation to join a Paper5 workspace." noIndex={true} />
      <div className="auth-showcase-bg" aria-hidden="true" />
      <div className="auth-form-side">
        <div className="auth-form-container glass-panel" style={{ textAlign: 'center' }}>
          <div className="auth-logo" style={{ justifyContent: 'center', marginBottom: 24, color: 'var(--text-primary)' }}>
            <span className="auth-logo-dot" />
            Paper5
          </div>
        
        {loading ? (
          <>
            <h1 style={{ marginBottom: '12px' }}>Joining workspace...</h1>
            <p className="auth-subtitle" style={{ marginBottom: '20px' }}>Please wait while we verify your invitation.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '280px', margin: '0 auto' }}>
              <div className="p5-skeleton-block" style={{ height: '14px', width: '100%', borderRadius: '8px' }} aria-hidden="true" />
              <div className="p5-skeleton-block" style={{ height: '14px', width: '76%', margin: '0 auto', borderRadius: '8px' }} aria-hidden="true" />
            </div>
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
