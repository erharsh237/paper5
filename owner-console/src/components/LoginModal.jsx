import React, { useState } from 'react'
import { Mail, Lock, AlertCircle, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { checkHasPasskey, loginWithPasskey } from '../lib/passkeys'

export function LoginModal({ onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [passkeyStep, setPasskeyStep] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')

  async function handlePasskeyVerify(targetEmail = pendingEmail) {
    setLoading(true)
    setError(null)
    try {
      const authedUser = await loginWithPasskey(targetEmail)
      onLoginSuccess(authedUser)
    } catch (err) {
      setError(err?.message || 'Passkey verification failed.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const cleanEmail = email.trim().toLowerCase()
    if (cleanEmail !== 'admin_harshpal@paper5.co') {
      setError('Access denied: Unauthorized administrator account.')
      setLoading(false)
      return
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password.trim()
      })

      if (authError) throw authError

      if (data?.session) {
        const hasPasskey = await checkHasPasskey(cleanEmail)
        if (hasPasskey) {
          await supabase.auth.signOut().catch(() => {})
          setPendingEmail(cleanEmail)
          setPasskeyStep(true)
          setLoading(false)
          await handlePasskeyVerify(cleanEmail)
          return
        }
        onLoginSuccess(data.session.user)
      }
    } catch (err) {
      console.error('Login error:', err)
      let msg = err?.message
      if (!msg || msg === '{}' || msg.trim().startsWith('{')) {
        if (err?.status === 500) {
          msg = 'Database schema error (500): auth.users contains NULL token fields. Please run the SQL fix in Supabase SQL editor.'
        } else {
          msg = 'Authentication failed. Please verify credentials or check connection.'
        }
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#F0F2F5] flex items-center justify-center p-4">
      <div className="w-full max-w-sm p-7 rounded-3xl bg-white border border-black/[0.06] shadow-xl space-y-6">
        <div className="text-center">
          <div className="w-9 h-9 rounded-full border-2 border-slate-900 mx-auto flex items-center justify-center mb-3">
            <div className="w-3 h-3 rounded-full bg-slate-900" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Paper5 Admin</h2>
          <p className="text-xs text-slate-500 mt-1">Sign in to platform control plane</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {passkeyStep ? (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 leading-relaxed">
              Passkey verification is required for <strong className="text-slate-900">{pendingEmail}</strong> before accessing the admin console.
            </div>
            <button
              type="button"
              onClick={() => handlePasskeyVerify()}
              disabled={loading}
              className="btn-primary w-full justify-center !py-2.5 text-xs font-semibold !rounded-xl flex items-center gap-2"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{loading ? 'Verifying Passkey...' : 'Verify with Passkey'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPasskeyStep(false)
                setPendingEmail('')
                setError(null)
              }}
              className="w-full py-2 text-slate-500 hover:text-slate-800 text-xs font-medium"
            >
              Back to sign in
            </button>
          </div>
        ) : (
        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label className="text-slate-600 block mb-1 font-medium">Admin Email</label>
            <div className="relative flex items-center">
              <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="console-input w-full"
                style={{ paddingLeft: '2.25rem' }}
                placeholder="admin@paper5.co"
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-600 font-medium">Password</label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-slate-400 hover:text-slate-700"
                tabIndex={-1}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="relative flex items-center">
              <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="console-input w-full font-mono"
                style={{ paddingLeft: '2.25rem' }}
                placeholder="Enter your password"
                autoComplete="new-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center !py-2.5 text-xs font-semibold !rounded-xl"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
        )}
      </div>
    </div>
  )
}
