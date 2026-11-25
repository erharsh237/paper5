import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useWorkspace } from '../lib/WorkspaceContext'
import { supabase } from '../lib/supabase'
import { validateUsername, validatePassword } from '../lib/validation'
import { listPasskeys, registerPasskey, removePasskey } from '../lib/passkeys'
import './Profile.css'

export default function Profile() {
  const { user, userData, checkUsername } = useAuth()
  const { workspace, workspaceId, workspaceRole } = useWorkspace()
  const workspaceHome = workspaceId ? `/${workspaceId}` : '/workspaces'

  const [fullNameInput, setFullNameInput] = useState('')
  const [usernameInput, setUsernameInput] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' })

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' })

  const [passkeys, setPasskeys] = useState([])
  const [loadingPasskeys, setLoadingPasskeys] = useState(true)
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [passkeyMsg, setPasskeyMsg] = useState({ type: '', text: '' })

  useEffect(() => {
    const currentFullName = user?.user_metadata?.full_name || user?.user_metadata?.name || userData?.name || ''
    if (currentFullName && !fullNameInput) {
      setFullNameInput(currentFullName)
    }
    const currentUname = userData?.username || user?.user_metadata?.username || ''
    if (currentUname && !usernameInput) {
      setUsernameInput(currentUname)
    }
  }, [user?.user_metadata?.full_name, user?.user_metadata?.name, userData?.name, userData?.username, user?.user_metadata?.username])

  useEffect(() => {
    let mounted = true
    if (!user) return
    setLoadingPasskeys(true)
    listPasskeys()
      .then((list) => {
        if (mounted) setPasskeys(list)
      })
      .catch(() => {
        if (mounted) setPasskeys([])
      })
      .finally(() => {
        if (mounted) setLoadingPasskeys(false)
      })
    return () => {
      mounted = false
    }
  }, [user?.id])

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setProfileMsg({ type: '', text: '' })
    const cleanFullName = (fullNameInput || '').trim()
    const cleanUsername = (usernameInput || '').trim().toLowerCase()
    const check = validateUsername(cleanUsername)
    if (!check.valid) {
      setProfileMsg({ type: 'error', text: check.error })
      return
    }
    setSavingProfile(true)
    try {
      const uid = user?.id || user?.uid
      const isAvail = await checkUsername(cleanUsername, uid)
      if (!isAvail) {
        setProfileMsg({ type: 'error', text: 'This username is already taken.' })
        return
      }
      const { error: authErr } = await supabase.auth.updateUser({
        data: {
          full_name: cleanFullName,
          name: cleanFullName,
          username: cleanUsername,
        },
      })
      if (authErr) throw authErr
      await supabase.from('users').update({ username: cleanUsername }).eq('id', uid)
      setFullNameInput(cleanFullName)
      setUsernameInput(cleanUsername)
      setProfileMsg({ type: 'success', text: 'Profile details updated.' })
    } catch (err) {
      setProfileMsg({ type: 'error', text: err?.message || 'Failed to update profile.' })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordMsg({ type: '', text: '' })
    const pwdCheck = validatePassword(newPassword)
    if (!pwdCheck.valid) {
      setPasswordMsg({
        type: 'error',
        text: `Password requirements not met: ${pwdCheck.errors.join(', ')}`,
      })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    setSavingPassword(true)
    try {
      const { error: pwdErr } = await supabase.auth.updateUser({ password: newPassword })
      if (pwdErr) throw pwdErr
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMsg({ type: 'success', text: 'Password updated successfully.' })
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err?.message || 'Failed to update password.' })
    } finally {
      setSavingPassword(false)
    }
  }

  const handleSetupPasskey = async () => {
    setPasskeyBusy(true)
    setPasskeyMsg({ type: '', text: '' })
    try {
      await registerPasskey()
      const updated = await listPasskeys()
      setPasskeys(updated)
      setPasskeyMsg({
        type: 'success',
        text: 'Passkey added! You will be prompted for it when signing in.',
      })
    } catch (err) {
      setPasskeyMsg({ type: 'error', text: err?.message || 'Could not add passkey.' })
    } finally {
      setPasskeyBusy(false)
    }
  }

  const handleRemovePasskey = async (credentialId) => {
    setPasskeyBusy(true)
    setPasskeyMsg({ type: '', text: '' })
    try {
      const remaining = await removePasskey(credentialId)
      setPasskeys(remaining)
      setPasskeyMsg({ type: 'success', text: 'Passkey removed from your account.' })
    } catch (err) {
      setPasskeyMsg({ type: 'error', text: err?.message || 'Could not remove passkey.' })
    } finally {
      setPasskeyBusy(false)
    }
  }

  const activeFullName = (user?.user_metadata?.full_name || user?.user_metadata?.name || userData?.name || '').trim()
  const activeUsername = userData?.username || user?.user_metadata?.username || ''
  const displayName = activeFullName || (activeUsername ? `@${activeUsername}` : user?.email?.split('@')[0] || 'Account')
  const initials = (activeFullName || activeUsername || user?.email || 'U').slice(0, 2).toUpperCase()

  return (
    <div className="dash-root">
      <main className="dash-container">
        <div className="ps-shell">
          <div className="ps-topbar">
            <div className="ps-page-header">
              <h1 className="ps-page-title">Profile Settings</h1>
              <p className="ps-page-subtitle">
                Manage your username, password, passkeys, and account preferences.
              </p>
            </div>
            <Link to={workspaceHome} className="ps-back-link">
              Back to Workspace
            </Link>
          </div>

          {/* Account Summary */}
          <section className="ps-identity-card" aria-label="Account summary">
            <div className="ps-identity-left">
              <div className="ps-avatar" aria-hidden="true">
                {initials}
              </div>
              <div className="ps-identity-meta">
                <h2 className="ps-identity-name">{displayName}</h2>
                <p className="ps-identity-email">{user?.email || 'Signed in user'}</p>
              </div>
            </div>

            <div className="ps-identity-summary">
              {workspace?.name && (
                <span className="ps-summary-item">
                  Workspace: <strong>{workspace.name}</strong>
                </span>
              )}
              <span className="ps-summary-item">
                Role: <strong>{workspaceRole || 'Member'}</strong>
              </span>
              {!loadingPasskeys && (
                <span className="ps-summary-item">
                  Passkey: <strong>{passkeys.length > 0 ? 'Enabled' : 'Not set'}</strong>
                </span>
              )}
            </div>
          </section>

          {/* 2-Column Settings Grid */}
          <div className="ps-grid">
            {/* Left Column */}
            <div className="ps-col">
              <section className="ps-card">
                <div className="ps-card-head">
                  <h3 className="ps-card-title">Personal Details</h3>
                  <p className="ps-card-desc">
                    Update your full name and handle for your workspace greeting and mentions.
                  </p>
                </div>

                <form onSubmit={handleSaveProfile} className="ps-form">
                  <div className="ps-field">
                    <label htmlFor="ps-fullname" className="ps-label">
                      Full Name
                    </label>
                    <input
                      id="ps-fullname"
                      type="text"
                      className="ps-input"
                      value={fullNameInput}
                      onChange={(e) => setFullNameInput(e.target.value)}
                      placeholder="Enter your full name"
                      autoComplete="name"
                    />
                  </div>

                  <div className="ps-field">
                    <label className="ps-label">Email address</label>
                    <input
                      type="email"
                      className="ps-input ps-input--readonly"
                      value={user?.email || ''}
                      readOnly
                    />
                  </div>

                  <div className="ps-field">
                    <label htmlFor="ps-username" className="ps-label">
                      Username
                    </label>
                    <div className="ps-input-wrap">
                      <span className="ps-input-prefix">@</span>
                      <input
                        id="ps-username"
                        type="text"
                        className="ps-input ps-input--prefix"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        placeholder="your_username"
                        autoComplete="username"
                      />
                    </div>
                    <p className="ps-hint">3–20 characters: lowercase letters, numbers, or underscores.</p>
                  </div>

                  {profileMsg.text && (
                    <div className={`ps-feedback ps-feedback--${profileMsg.type === 'error' ? 'error' : 'success'}`}>
                      {profileMsg.text}
                    </div>
                  )}

                  <div className="ps-actions">
                    <button type="submit" disabled={savingProfile} className="ps-btn ps-btn--primary">
                      {savingProfile ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </section>

              <section className="ps-card">
                <div className="ps-card-head">
                  <h3 className="ps-card-title">Other Account Settings</h3>
                  <p className="ps-card-desc">
                    Workspace navigation and account options.
                  </p>
                </div>

                <div className="ps-pref-row">
                  <div>
                    <div className="ps-pref-title">Switch or Create Workspace</div>
                    <div className="ps-pref-sub">Open another workspace or start a new team space.</div>
                  </div>
                  <Link to="/workspaces" className="ps-btn ps-btn--secondary">
                    Workspaces
                  </Link>
                </div>
              </section>
            </div>

            {/* Right Column */}
            <div className="ps-col">
              <section className="ps-card">
                <div className="ps-card-head">
                  <h3 className="ps-card-title">Passkeys</h3>
                  <p className="ps-card-desc">
                    Sign in with Windows Hello, Touch ID, Face ID, or a security key. When set up, sign-in requires passkey verification.
                  </p>
                </div>

                {loadingPasskeys ? (
                  <div className="ps-passkey-empty">
                    <span className="ps-passkey-empty-text">Checking registered passkeys...</span>
                  </div>
                ) : passkeys.length === 0 ? (
                  <div className="ps-passkey-empty">
                    <div className="ps-passkey-empty-text">
                      No passkey configured yet.
                    </div>
                    <button
                      type="button"
                      onClick={handleSetupPasskey}
                      disabled={passkeyBusy}
                      className="ps-btn ps-btn--primary"
                    >
                      {passkeyBusy ? 'Waiting...' : 'Set Up Passkey'}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="ps-passkey-list">
                      {passkeys.map((pk, idx) => (
                        <div key={pk.id || idx} className="ps-passkey-row">
                          <div>
                            <div className="ps-passkey-name">Passkey #{idx + 1}</div>
                            <div className="ps-passkey-sub">
                              {pk.createdAt
                                ? `Added ${new Date(pk.createdAt).toLocaleDateString()}`
                                : 'Active device passkey'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePasskey(pk.id)}
                            disabled={passkeyBusy}
                            className="ps-btn ps-btn--danger"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="ps-actions">
                      <button
                        type="button"
                        onClick={handleSetupPasskey}
                        disabled={passkeyBusy}
                        className="ps-btn ps-btn--secondary"
                      >
                        {passkeyBusy ? 'Waiting...' : 'Add Another Passkey'}
                      </button>
                    </div>
                  </>
                )}

                {passkeyMsg.text && (
                  <div className={`ps-feedback ps-feedback--${passkeyMsg.type === 'error' ? 'error' : 'success'}`}>
                    {passkeyMsg.text}
                  </div>
                )}
              </section>

              <section className="ps-card">
                <div className="ps-card-head">
                  <h3 className="ps-card-title">Change Password</h3>
                  <p className="ps-card-desc">
                    Use at least 8 characters with uppercase, lowercase, and a number.
                  </p>
                </div>

                <form onSubmit={handleChangePassword} className="ps-form">
                  <div className="ps-field">
                    <label htmlFor="ps-new-password" className="ps-label">
                      New Password
                    </label>
                    <div className="ps-input-wrap">
                      <input
                        id="ps-new-password"
                        type={showNewPwd ? 'text' : 'password'}
                        className="ps-input ps-input--eye"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPwd((v) => !v)}
                        className="ps-eye-btn"
                        aria-label={showNewPwd ? 'Hide password' : 'Show password'}
                      >
                        {showNewPwd ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="ps-field">
                    <label htmlFor="ps-confirm-password" className="ps-label">
                      Confirm New Password
                    </label>
                    <input
                      id="ps-confirm-password"
                      type={showNewPwd ? 'text' : 'password'}
                      className="ps-input"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      autoComplete="new-password"
                    />
                  </div>

                  {passwordMsg.text && (
                    <div className={`ps-feedback ps-feedback--${passwordMsg.type === 'error' ? 'error' : 'success'}`}>
                      {passwordMsg.text}
                    </div>
                  )}

                  <div className="ps-actions">
                    <button type="submit" disabled={savingPassword} className="ps-btn ps-btn--primary">
                      {savingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
