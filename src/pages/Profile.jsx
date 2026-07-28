import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { subscribeProfile, saveProfile, saveAim, getAimLockStatus, uploadProfilePic, uploadResume, removeResume } from '../lib/profile'
import { subscribeRoles, addRole } from '../lib/roles'
import { resetTourSeen } from '../lib/onboarding'
import NotificationBell from '../components/NotificationBell'
import NavTabs from '../components/NavTabs'
import Breadcrumbs from '../components/Breadcrumbs'
import './Dashboard.css'
import './Profile.css'

const TEAM_ID = 'default-team'
const MAX_PIC_MB = 5
const MAX_RESUME_MB = 10

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [roles, setRoles] = useState([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [roleId, setRoleId] = useState('')
  const [bio, setBio] = useState('')
  const [addingRole, setAddingRole] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [aim, setAim] = useState('')
  const [savingAim, setSavingAim] = useState(false)
  const [aimSavedFlash, setAimSavedFlash] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [picUploading, setPicUploading] = useState(false)
  const [resumeUploading, setResumeUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    return subscribeRoles(setRoles)
  }, [])

  useEffect(() => {
    if (!user?.email) return
    return subscribeProfile(user.email, (p) => {
      setProfile(p)
      if (p) {
        setName(p.name || user.displayName || '')
        setPhone(p.phone || '')
        setRoleId(p.roleId || '')
        setBio(p.bio || '')
        setAim(p.aim || '')
      } else {
        setName(user.displayName || '')
      }
    })
  }, [user?.email, user?.displayName])

  const aimLock = getAimLockStatus(profile)

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const selectedRole = roles.find(r => r.id === roleId)
      await saveProfile(user.email, {
        name: name.trim(),
        phone: phone.trim(),
        roleId: selectedRole?.id || '',
        roleName: selectedRole?.name || '',
        bio: bio.trim(),
      })
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch (err) {
      console.error(err)
      setError('Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddRole() {
    const trimmed = newRoleName.trim()
    if (!trimmed) return
    try {
      const id = await addRole(trimmed)
      setRoleId(id)
      setNewRoleName('')
      setAddingRole(false)
    } catch (err) {
      console.error(err)
      setError('Could not add role. Try again.')
    }
  }

  async function handleSaveAim(e) {
    e.preventDefault()
    if (aimLock.locked) return
    setError('')
    setSavingAim(true)
    try {
      await saveAim(user.email, aim.trim())
      setAimSavedFlash(true)
      setTimeout(() => setAimSavedFlash(false), 2000)
    } catch (err) {
      console.error(err)
      setError(
        err?.code === 'permission-denied'
          ? "Your aim is locked until the 45-day window is up."
          : 'Could not save. Try again.'
      )
    } finally {
      setSavingAim(false)
    }
  }

  async function handlePicChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Profile photo must be an image.')
    if (file.size > MAX_PIC_MB * 1024 * 1024) return setError(`Photo must be under ${MAX_PIC_MB}MB.`)
    setError('')
    setPicUploading(true)
    try {
      await uploadProfilePic(user.email, file)
    } catch (err) {
      console.error(err)
      setError('Photo upload failed. Try again.')
    } finally {
      setPicUploading(false)
      e.target.value = ''
    }
  }

  async function handleResumeChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const okType = file.type === 'application/pdf' || /\.(pdf|docx?)$/i.test(file.name)
    if (!okType) return setError('Resume must be a PDF or Word doc.')
    if (file.size > MAX_RESUME_MB * 1024 * 1024) return setError(`Resume must be under ${MAX_RESUME_MB}MB.`)
    setError('')
    setResumeUploading(true)
    try {
      await uploadResume(user.email, file)
    } catch (err) {
      console.error(err)
      setError('Resume upload failed. Try again.')
    } finally {
      setResumeUploading(false)
      e.target.value = ''
    }
  }

  async function handleRemoveResume() {
    if (!confirm('Remove your uploaded resume?')) return
    try {
      await removeResume(user.email, profile?.resumePath)
    } catch (err) {
      console.error(err)
      setError('Could not remove resume. Try again.')
    }
  }

  async function handleRetakeTour() {
    try {
      await resetTourSeen(user.email)
      navigate('/')
    } catch (err) {
      console.error(err)
      setError('Could not restart the tour. Try again.')
    }
  }

  return (
    <div className="dash">
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-brand">
            <span className="dash-brand-dot" />
            <span className="mono">SECURIQ <span className="dash-brand-sub">| My profile</span></span>
          </div>
          <div className="dash-header-actions">
            <NavTabs />
            <NotificationBell teamId={TEAM_ID} currentUser={user} />
            <span className="dash-user">{user?.displayName || user?.email}</span>
            <button className="btn-ghost btn-sm" onClick={logout}>Sign out</button>
          </div>
        </div>
      </header>

      <main className="dash-body">
        <Breadcrumbs trail={[{ label: 'Profile' }]} />

        <section className="sprint-overview profile-panel">
          <div className="profile-pic-row">
            <div className="profile-pic-wrap">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="Profile" className="profile-pic" decoding="async" />
              ) : (
                <div className="profile-pic profile-pic--placeholder mono">
                  {(name || user?.email || '?')[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <label className="btn-ghost btn-sm profile-upload-btn">
                {picUploading ? 'Uploading…' : 'Change photo'}
                <input type="file" accept="image/*" hidden onChange={handlePicChange} disabled={picUploading} />
              </label>
              <p className="profile-hint">JPG/PNG, up to {MAX_PIC_MB}MB</p>
            </div>
          </div>

          <form className="modal-form" onSubmit={handleSave} style={{ padding: 0 }}>
            <div className="field-row">
              <div className="field">
                <label htmlFor="p-name">Full name</label>
                <input id="p-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="p-phone">Phone number</label>
                <input id="p-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" />
              </div>
            </div>

            <div className="field">
              <label htmlFor="p-role">Role</label>
              {addingRole ? (
                <div className="field-row">
                  <input
                    type="text" value={newRoleName} autoFocus
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="e.g. Backend / Security research"
                  />
                  <button type="button" className="btn-ghost btn-sm" onClick={handleAddRole}>Add</button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => { setAddingRole(false); setNewRoleName('') }}>Cancel</button>
                </div>
              ) : (
                <div className="field-row">
                  <select id="p-role" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                    <option value="">Select a role…</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setAddingRole(true)}>+ New role</button>
                </div>
              )}
            </div>

            <div className="field">
              <label htmlFor="p-bio">About</label>
              <textarea id="p-bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Background, what you're focused on right now…" />
            </div>

            {error && <div className="form-error">{error}</div>}

            <div className="modal-actions" style={{ padding: 0 }}>
              <button type="submit" className="btn-primary btn-sm" disabled={saving}>
                {saving ? 'Saving…' : 'Save profile'}
              </button>
              {savedFlash && <span className="form-status form-status--ok">Saved.</span>}
            </div>
          </form>

          <form className="modal-form profile-aim-section" onSubmit={handleSaveAim} style={{ padding: 0 }}>
            <div className="field">
              <label htmlFor="p-aim">
                What do you want to achieve from Securiq?
                {aimLock.locked && (
                  <span className="profile-aim-lock-note"> — locked until {aimLock.unlockDate.toLocaleDateString()}</span>
                )}
              </label>
              <textarea
                id="p-aim" rows={3} value={aim}
                onChange={(e) => setAim(e.target.value)}
                disabled={aimLock.locked}
                placeholder="Once saved, this is locked for 45 days — write what you're actually aiming for."
              />
            </div>
            <div className="modal-actions" style={{ padding: 0 }}>
              <button type="submit" className="btn-primary btn-sm" disabled={savingAim || aimLock.locked}>
                {aimLock.locked ? 'Locked' : savingAim ? 'Saving…' : profile?.aimSavedAt ? 'Update aim' : 'Save aim'}
              </button>
              {aimSavedFlash && <span className="form-status form-status--ok">Saved — locked for 45 days.</span>}
            </div>
          </form>

          <div className="profile-resume-row">
            <div>
              <div className="mono profile-section-label">RESUME</div>
              {profile?.resumeURL ? (
                <a href={profile.resumeURL} target="_blank" rel="noopener noreferrer" className="profile-resume-link">
                  {profile.resumeName || 'View uploaded resume'}
                </a>
              ) : (
                <p className="profile-hint">No resume uploaded yet.</p>
              )}
            </div>
            <div className="profile-resume-actions">
              <label className="btn-ghost btn-sm profile-upload-btn">
                {resumeUploading ? 'Uploading…' : profile?.resumeURL ? 'Replace' : 'Upload resume'}
                <input type="file" accept=".pdf,.doc,.docx" hidden onChange={handleResumeChange} disabled={resumeUploading} />
              </label>
              {profile?.resumeURL && (
                <button type="button" className="dcard-delete btn-sm" onClick={handleRemoveResume}>Remove</button>
              )}
            </div>
          </div>

          <div className="profile-tour-row">
            <button type="button" className="btn-ghost btn-sm" onClick={handleRetakeTour}>
              Retake site tour
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
