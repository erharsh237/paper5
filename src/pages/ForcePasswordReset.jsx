import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function ForcePasswordReset() {
  const { logout } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [requiresStrict, setRequiresStrict] = useState(false)

  useEffect(() => {
    async function checkStrict() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser?.email) return;
      
      const { data: invites } = await supabase.from('workspace_invites').select('workspace_id').eq('email', currentUser.email);
      if (invites && invites.length > 0) {
        const wsIds = invites.map(i => i.workspace_id);
        const { data: workspaces } = await supabase.from('workspaces').select('settings').in('id', wsIds);
        if (workspaces && workspaces.some(ws => ws.settings?.strict_passwords)) {
          setRequiresStrict(true);
        }
      }
      
      if (currentUser.id) {
         const { data: members } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', currentUser.id);
         if (members && members.length > 0) {
            const wsIds = members.map(m => m.workspace_id);
            const { data: workspaces } = await supabase.from('workspaces').select('settings').in('id', wsIds);
            if (workspaces && workspaces.some(ws => ws.settings?.strict_passwords)) {
              setRequiresStrict(true);
            }
         }
      }
    }
    checkStrict()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length > 72) {
      setError('Security requirement: Password cannot exceed 72 characters.')
      return
    }

    if (requiresStrict) {
      const strictRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,72}$/;
      if (!strictRegex.test(password)) {
        setError('Security requirement: Your workspace enforces strict passwords (12-72 characters, uppercase, lowercase, number, symbol).')
        return
      }
    } else {
      if (password.length < 8) {
        setError('Security requirement: Password must be at least 8 characters long.')
        return
      }
    }
    if (password !== confirmPassword) {
      setError('Verification failed: Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError, data } = await supabase.auth.updateUser({
        password,
        data: { must_change_password: false }
      })
      if (updateError) throw updateError
      
      if (data?.user) {
        const cleanEmail = data.user.email ? data.user.email.trim().toLowerCase() : ''
        const defaultUsername = cleanEmail ? cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') : 'user_' + Math.floor(1000 + Math.random() * 9000)

        // 1. Update user metadata with username and clear must_change_password
        await supabase.auth.updateUser({
          data: {
            username: defaultUsername,
            must_change_password: false
          }
        })

        // 2. Update users table record with username and clear requires_password_reset
        await supabase.from('users').upsert({
          id: data.user.id,
          email: cleanEmail,
          username: defaultUsername,
          requires_password_reset: false,
          updated_at: new Date().toISOString()
        })
        
        // 3. Accept pending invites via serverless API (bypasses RLS 403 errors)
        if (cleanEmail) {
          try {
            await fetch('/api/accept-invite', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: cleanEmail, userId: data.user.id })
            })
          } catch (apiErr) {
            console.warn('ForcePasswordReset accept-invite notice:', apiErr)
          }
        }
      }
      
      // Navigate cleanly to workspace picker
      window.location.href = '/workspace'
    } catch (err) {
      setError(err.message || 'Unable to update security credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-layer-1)',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-layer-2)',
        padding: '32px',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        maxWidth: '400px',
        width: '100%'
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', color: 'var(--text-primary)' }}>Welcome to SprintOS!</h2>
        <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
          You've been invited to join a workspace. To secure your account, please set a password before continuing.
          {requiresStrict && (
            <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-critical)', borderRadius: '6px', fontSize: '13px' }}>
              <strong>Strict Password Policy Enforced:</strong> Requires 12-72 characters, uppercase, lowercase, number, and symbol.
            </div>
          )}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>New Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={72}
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-layer)', color: 'var(--text-primary)' }}
            />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              maxLength={72}
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-layer)', color: 'var(--text-primary)' }}
            />
          </div>

          {error && <div style={{ color: 'var(--accent-critical)', fontSize: '13px' }}>{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '10px', marginTop: '8px' }}>
            {loading ? 'Saving...' : 'Set Password'}
          </button>
          
          <button type="button" className="btn-ghost" onClick={logout} disabled={loading} style={{ padding: '10px', justifyContent: 'center' }}>
            Sign Out
          </button>
        </form>
      </div>
    </div>
  )
}
