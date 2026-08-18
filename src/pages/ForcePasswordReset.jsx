import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { validatePassword } from '../lib/validation'
import './Auth.css'

export default function ForcePasswordReset() {
  const { logout, setUser, setUserData } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [requiresStrict, setRequiresStrict] = useState(false)

  const pwdValidation = useMemo(() => validatePassword(password), [password])
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword

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

    if (!pwdValidation.valid) {
      setError(`Password requirements not met: ${pwdValidation.errors.join(', ')}`)
      return
    }

    if (requiresStrict) {
      const strictRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,72}$/;
      if (!strictRegex.test(password)) {
        setError('Security requirement: Your workspace enforces strict passwords (12-72 characters, uppercase, lowercase, number, symbol).')
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
        let baseUsername = cleanEmail ? cleanEmail.split('@')[0].replace(/[^a-z0-9_]/g, '') : 'user'
        if (!baseUsername || baseUsername.length < 3) baseUsername = 'user_' + Math.floor(1000 + Math.random() * 9000)

        // Ensure guaranteed username uniqueness across all users
        let uniqueUsername = baseUsername
        let counter = 1
        while (true) {
          try {
            const { data: existing } = await supabase
              .from('users')
              .select('id')
              .ilike('username', uniqueUsername)
              .neq('id', data.user.id)
              .maybeSingle()
            if (!existing) break
            uniqueUsername = `${baseUsername}_${counter}`
            counter++
          } catch (_) {
            break
          }
        }

        // 1. Update user metadata with unique username and clear must_change_password
        await supabase.auth.updateUser({
          data: {
            username: uniqueUsername,
            must_change_password: false
          }
        })

        // 2. Update users table record with unique username and clear requires_password_reset
        await supabase.from('users').upsert({
          id: data.user.id,
          email: cleanEmail,
          username: uniqueUsername,
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

        // 4. Update in-memory Auth context state dynamically so UI switches instantly without manual refresh
        if (typeof setUser === 'function') {
          setUser(prev => ({
            ...(prev || {}),
            user_metadata: {
              ...(prev?.user_metadata || {}),
              must_change_password: false,
              username: uniqueUsername
            }
          }))
        }
        if (typeof setUserData === 'function') {
          setUserData(prev => ({
            ...(prev || {}),
            username: uniqueUsername,
            requires_password_reset: false,
            requiresPasswordReset: false
          }))
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
      background: 'var(--bg-layer-1, #f9fafb)',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-layer-2, #ffffff)',
        padding: '36px 32px',
        borderRadius: '16px',
        border: '1px solid var(--border, #e5e7eb)',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        maxWidth: '440px',
        width: '100%'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', color: 'var(--text-primary, #111)' }}>
          <div style={{ width: '24px', height: '24px', background: 'var(--text-primary, #111)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fff' }} />
          </div>
          <span style={{ fontWeight: 600, fontSize: '16px' }}>SprintOS</span>
        </div>

        <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary, #111)' }}>Welcome to SprintOS!</h2>
        <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: 'var(--text-secondary, #6b7280)', lineHeight: '1.5' }}>
          You've been invited to join a workspace. To secure your account, please set your password before continuing.
          {requiresStrict && (
            <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-critical, #ef4444)', borderRadius: '8px', fontSize: '13px' }}>
              <strong>Strict Password Policy Enforced:</strong> Requires 12-72 characters, uppercase, lowercase, number, and symbol.
            </div>
          )}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #374151)', marginBottom: '6px' }}>New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setIsPasswordFocused(true)}
                placeholder="Min 8 chars (A-Z, a-z, 0-9, special)"
                required
                minLength={8}
                maxLength={72}
                style={{ 
                  width: '100%',
                  padding: '10px 40px 10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border, #d1d5db)',
                  background: 'var(--bg-layer, #fff)',
                  color: 'var(--text-primary, #111)',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary, #666)',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center'
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>

            {/* Password Requirements Checklist */}
            {(isPasswordFocused || password.length > 0) && (
              <div style={{
                marginTop: '10px',
                padding: '12px 14px',
                background: 'rgba(0, 0, 0, 0.02)',
                border: '1px solid var(--border-subtle, #e5e7eb)',
                borderRadius: '8px',
                fontSize: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary, #4b5563)', marginBottom: '2px' }}>
                  Password Requirements:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: pwdValidation.requirements.minLength ? '#10b981' : '#6b7280' }}>
                    <span style={{ fontWeight: 700 }}>{pwdValidation.requirements.minLength ? '✓' : '○'}</span>
                    <span>Min 8 characters</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: pwdValidation.requirements.hasUpper ? '#10b981' : '#6b7280' }}>
                    <span style={{ fontWeight: 700 }}>{pwdValidation.requirements.hasUpper ? '✓' : '○'}</span>
                    <span>Uppercase (A-Z)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: pwdValidation.requirements.hasLower ? '#10b981' : '#6b7280' }}>
                    <span style={{ fontWeight: 700 }}>{pwdValidation.requirements.hasLower ? '✓' : '○'}</span>
                    <span>Lowercase (a-z)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: pwdValidation.requirements.hasNumber ? '#10b981' : '#6b7280' }}>
                    <span style={{ fontWeight: 700 }}>{pwdValidation.requirements.hasNumber ? '✓' : '○'}</span>
                    <span>Number (0-9)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: pwdValidation.requirements.hasSpecial ? '#10b981' : '#6b7280' }}>
                    <span style={{ fontWeight: 700 }}>{pwdValidation.requirements.hasSpecial ? '✓' : '○'}</span>
                    <span>Special character</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #374151)', marginBottom: '6px' }}>Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                required
                minLength={8}
                maxLength={72}
                style={{ 
                  width: '100%',
                  padding: '10px 40px 10px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${passwordsMismatch ? '#ef4444' : passwordsMatch ? '#10b981' : 'var(--border, #d1d5db)'}`,
                  background: 'var(--bg-layer, #fff)',
                  color: 'var(--text-primary, #111)',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary, #666)',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center'
                }}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>

            {/* Password match indicator */}
            {confirmPassword.length > 0 && (
              <div style={{ marginTop: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: passwordsMatch ? '#10b981' : '#ef4444' }}>
                <span>{passwordsMatch ? '✓' : '✕'}</span>
                <span>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
              </div>
            )}
          </div>

          {error && (
            <div style={{
              padding: '10px 12px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              color: 'var(--accent-critical, #ef4444)',
              fontSize: '13px'
            }}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading || !pwdValidation.valid || !passwordsMatch} 
            style={{ 
              padding: '12px', 
              marginTop: '8px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              justifyContent: 'center',
              opacity: (loading || !pwdValidation.valid || !passwordsMatch) ? 0.6 : 1,
              cursor: (loading || !pwdValidation.valid || !passwordsMatch) ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Saving...' : 'Set Password'}
          </button>
          
          <button 
            type="button" 
            className="btn-ghost" 
            onClick={logout} 
            disabled={loading} 
            style={{ padding: '10px', justifyContent: 'center', fontSize: '13px', color: 'var(--text-secondary, #6b7280)' }}
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  )
}
