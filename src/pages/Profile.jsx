import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { subscribeProfile, saveProfile, saveAim, getAimLockStatus, uploadPhoto, uploadResume, deleteResume } from '../lib/profile'
import { resetTourSeen } from '../lib/onboarding'

import NavTabs from '../components/NavTabs'
import Breadcrumbs from '../components/Breadcrumbs'
import UserMenu from '../components/UserMenu'
import CalendarWidget from '../components/CalendarWidget'
import { useWorkspace } from '../lib/WorkspaceContext'
import './Dashboard.css'
import './Profile.css'

const TOTAL_STEPS = 4
const MAX_PIC_MB = 5

function getUserColor(identifier) {
  if (!identifier) return '#5e5ce6';
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 55%, 45%)`;
}

export default function Profile() {
  const { user, logout, userData } = useAuth()
  const workspaceContext = useWorkspace()
  const workspace = workspaceContext?.workspace
  const workspaceId = workspaceContext?.workspaceId || 'global'
  const workspaceRole = workspaceContext?.workspaceRole
  const isOwner = workspaceContext?.isOwner
  const isAdmin = workspaceContext?.isAdmin

  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [aim, setAim] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState('')
  const [picUploading, setPicUploading] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [deletingAccount, setDeletingAccount] = useState(false)

  const prevStep = () => setCurrentStep(s => Math.max(0, s - 1))
  const nextStep = () => setCurrentStep(s => Math.min(TOTAL_STEPS - 1, s + 1))

  useEffect(() => {
    const uid = user?.id || user?.email
    if (!uid) return
    return subscribeProfile(workspaceId, uid, (data) => {
      setProfile(data)
      if (data) {
        setName(data.name || '')
        setPhone(data.phone || '')
        setBio(data.bio || '')
        setAim(data.aim || '')
      }
    })
  }, [user, workspaceId])

  const aimLock = getAimLockStatus(profile)

  async function handleSaveAll() {
    if (!name.trim() || !phone.trim() || !bio.trim() || !aim.trim()) {
      setError('Please fill in Name, Phone, Bio, and Aim before saving.');
      return;
    }
    
    setError('')
    setSaving(true)
    try {
      await saveProfile(user.email, {
        name: name.trim(),
        phone: phone.trim(),
        roleId: profile?.roleId || '',
        roleName: profile?.roleName || '',
        bio: bio.trim(),
      })

      if (!aimLock.locked && aim.trim() !== (profile?.aim || '')) {
        await saveAim(user.email, aim.trim())
      }
      
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 3000)
    } catch (err) {
      console.error(err)
      setError('Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePicChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_PIC_MB * 1024 * 1024) {
      setError(`Image file must be under ${MAX_PIC_MB}MB.`)
      return
    }
    setError('')
    setPicUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const dataUrl = reader.result
        const uid = user?.id || user?.email
        await uploadPhoto(workspaceId, uid, dataUrl)
        setProfile(prev => ({ ...prev, photoURL: dataUrl }))
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 3000)
        setPicUploading(false)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error(err)
      setError('Could not upload photo. Please try again.')
      setPicUploading(false)
    }
    e.target.value = ''
  }

  async function handleResumeChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setError('Resume file must be under 10MB.')
      return
    }
    setError('')
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const resumeUrl = reader.result
        const uid = user?.id || user?.email
        await uploadResume(workspaceId, uid, resumeUrl, file.name)
        setProfile(prev => ({ ...prev, resumeURL: resumeUrl, resumeName: file.name }))
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 3000)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error(err)
      setError('Could not upload resume. Please try again.')
    }
    e.target.value = ''
  }

  async function handleRemoveResume() {
    setError('')
    try {
      const uid = user?.id || user?.email
      await deleteResume(workspaceId, uid)
      setProfile(prev => ({ ...prev, resumeURL: null, resumeName: null }))
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 3000)
    } catch (err) {
      console.error(err)
      setError('Could not remove resume.')
    }
  }

  async function handleRetakeTour() {
    try {
      const uid = user?.id || user?.uid
      await resetTourSeen(uid)
      navigate(`/${workspaceId}?tour=true`)
    } catch (err) {
      console.error(err)
      setError('Could not restart the tour. Try again.')
    }
  }



  return (
    <div className="dash-root">
      <nav className="dash-sticky-nav">
        <div className="dash-container dash-nav-inner">
          <Link to={`/${workspaceId}`} className="dash-nav-brand">
            <span className="dash-logo-name">SprintOS</span>
            <span className="dash-env-tag">{(workspace?.name || 'TEST').toUpperCase()}</span>
          </Link>

          <NavTabs />

          <div className="dash-nav-actions">
            <UserMenu />
          </div>
        </div>
      </nav>

      <main className="dash-container" style={{ paddingBottom: '48px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '16px' }}>
          <button type="button" className="btn-ghost btn-sm" onClick={handleRetakeTour}>
            Retake site tour
          </button>
        </div>

        <div className="profile-container">
          
          <div className="profile-cover" style={{ background: getUserColor(user?.email) }}>
            <div className="profile-header-content">
              <div className="profile-pic-wrap">
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="Profile" className="profile-pic" decoding="async" />
                ) : (
                  <div className="profile-pic profile-pic--placeholder mono">
                    {(name || user?.email || '?')[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              
              <div className="profile-name-area">
                <h1 className="profile-name">{name || user?.email}</h1>
                <div className="role-badge">
                  {profile?.roleName || (
                    isOwner ? 'Workspace Owner' :
                    isAdmin ? 'Workspace Admin' :
                    workspaceRole ? `Workspace ${workspaceRole.charAt(0).toUpperCase() + workspaceRole.slice(1)}` :
                    'Workspace Admin'
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="profile-card profile-card--main">
            <div className="profile-photo-actions-bar">
              <label className="profile-change-photo-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <span>{picUploading ? 'Uploading…' : 'Change photo'}</span>
                <input type="file" accept="image/*" hidden onChange={handlePicChange} disabled={picUploading} />
              </label>
              <span className="profile-photo-spec">JPG, PNG or WebP · Up to {MAX_PIC_MB}MB</span>
            </div>

            {/* SLIDER SYSTEM */}
            <div style={{ display: 'block', marginTop: '24px', position: 'relative' }}>
              <button type="button" className="btn-ghost btn-sm slider-nav-btn" onClick={prevStep} style={{ visibility: currentStep === 0 ? 'hidden' : 'visible', position: 'absolute', top: '50%', left: '-48px', transform: 'translateY(-50%)', zIndex: 10, padding: '8px', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: getUserColor(user?.email), color: '#ffffff', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              </button>

              <div className="profile-slider-viewport" style={{ flex: 1, minWidth: 0, marginTop: 0 }}>
                <div className="profile-slider-track" style={{ transform: `translateX(-${currentStep * 100}%)` }}>
                  
                  {/* Slide 1: Personal Info */}
                  <div className="profile-slide" style={{ height: currentStep === 0 ? 'auto' : 0, overflow: 'hidden', opacity: currentStep === 0 ? 1 : 0, transition: 'opacity 0.3s' }}>
                    <h2 className="profile-section-title">Step 1: Personal Information</h2>
                    <div className="field-row" style={{ marginBottom: '16px' }}>
                      <div className="premium-field" style={{ flex: 1 }}>
                        <label htmlFor="p-name">Full Name</label>
                        <input id="p-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
                      </div>
                      <div className="premium-field" style={{ flex: 1 }}>
                        <label htmlFor="p-phone">Phone Number</label>
                        <input id="p-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" />
                      </div>
                    </div>

                    <div className="premium-field">
                      <label htmlFor="p-bio">About Me</label>
                      <textarea id="p-bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Background, what you're focused on right now…" />
                    </div>
                  </div>

                  {/* Slide 2: Aim */}
                  <div className="profile-slide" style={{ height: currentStep === 1 ? 'auto' : 0, overflow: 'hidden', opacity: currentStep === 1 ? 1 : 0, transition: 'opacity 0.3s' }}>
                    <h2 className="profile-section-title">Step 2: Your {workspace?.name || 'Workspace'} Aim</h2>
                    <div className="premium-field">
                      <label htmlFor="p-aim" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>What do you want to achieve on {workspace?.name || 'this workspace'}?</span>
                        {aimLock.locked && (
                          <span className="profile-aim-lock-note">Locked until {aimLock.unlockDate.toLocaleDateString()}</span>
                        )}
                      </label>
                      <textarea
                        id="p-aim" rows={3} value={aim}
                        onChange={(e) => setAim(e.target.value)}
                        disabled={aimLock.locked}
                        placeholder="Once saved, this is locked for 45 days — write what you're actually aiming for."
                      />
                    </div>
                  </div>

                  {/* Slide 3: Documents */}
                  <div className="profile-slide" style={{ height: currentStep === 2 ? 'auto' : 0, overflow: 'hidden', opacity: currentStep === 2 ? 1 : 0, transition: 'opacity 0.3s' }}>
                    <h2 className="profile-section-title">Step 3: Documents</h2>
                    <div className="profile-resume-row">
                      <div className="profile-resume-info">
                        <span className="mono" style={{ fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>RESUME</span>
                        {profile?.resumeURL ? (
                          <a href={profile.resumeURL} target="_blank" rel="noopener noreferrer" className="profile-resume-link">
                            📄 {profile.resumeName || 'View uploaded resume'}
                          </a>
                        ) : (
                          <span className="profile-hint">No resume uploaded yet.</span>
                        )}
                      </div>
                      <div className="profile-resume-actions">
                        <label className="btn-ghost btn-sm profile-upload-btn">
                          {profile?.resumeURL ? 'Replace' : 'Upload Resume'}
                          <input type="file" accept=".pdf,.doc,.docx" hidden onChange={handleResumeChange} />
                        </label>
                        {profile?.resumeURL && (
                          <button type="button" className="dcard-delete btn-sm" onClick={handleRemoveResume}>Remove</button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Slide 4: Calendar & Submit */}
                  <div className="profile-slide" style={{ height: currentStep === 3 ? 'auto' : 0, overflow: 'hidden', opacity: currentStep === 3 ? 1 : 0, transition: 'opacity 0.3s' }}>
                    <h2 className="profile-section-title">Step 4: Integrations & Finalize</h2>
                    <div style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}>
                      <CalendarWidget user={user} />
                    </div>
                    
                    {error && <div className="form-error" style={{ marginTop: '16px', textAlign: 'center' }}>{error}</div>}
                    
                    <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                      {savedFlash && <span className="form-status form-status--ok">All changes saved securely!</span>}
                      <button type="button" className="btn-primary" style={{ width: '100%', maxWidth: '300px', fontSize: '15px', padding: '12px' }} onClick={handleSaveAll} disabled={saving}>
                        {saving ? 'Saving...' : 'Save All Changes'}
                      </button>
                    </div>
                  </div>

                </div>
              </div>

              <button type="button" className="btn-ghost btn-sm slider-nav-btn" onClick={nextStep} style={{ visibility: currentStep === TOTAL_STEPS - 1 ? 'hidden' : 'visible', position: 'absolute', top: '50%', right: '-48px', transform: 'translateY(-50%)', zIndex: 10, padding: '8px', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: getUserColor(user?.email), color: '#ffffff', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>

            <div className="slider-dots" style={{ justifyContent: 'center', marginTop: '20px' }}>
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div key={i} className={`slider-dot ${i === currentStep ? 'active' : ''}`} />
              ))}
            </div>
            
          </div>

          <div className="dash-surface-card" style={{ marginTop: '28px', padding: '24px 28px', border: '1px solid #FECACA', background: '#FEF2F2' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#DC2626', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Danger Zone</h2>
            <p style={{ fontSize: '13px', color: '#7F1D1D', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              Deleting your account will remove your access immediately. Your personal profile data and memberships will be erased. This action cannot be undone.
            </p>
            <button
              type="button"
              disabled={deletingAccount}
              style={{
                background: '#DC2626',
                color: '#FFFFFF',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: deletingAccount ? 'not-allowed' : 'pointer',
                opacity: deletingAccount ? 0.7 : 1,
                transition: 'all 0.15s ease'
              }}
              onClick={async () => {
                if (window.confirm('Are you absolutely sure you want to delete your account? You will lose access immediately.')) {
                  setDeletingAccount(true)
                  setError('')
                  try {
                    const uid = user?.id || user?.uid
                    const resp = await fetch('/api/delete-user', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: uid, email: user?.email })
                    })
                    const json = await resp.json()
                    if (!resp.ok) throw new Error(json.error || 'Failed to delete user')
                    
                    await logout()
                    navigate('/login')
                  } catch (err) {
                    console.error('Failed to delete account:', err)
                    setError('Could not delete account: ' + err.message)
                    setDeletingAccount(false)
                  }
                }
              }}
            >
              {deletingAccount ? 'Deleting Account…' : 'Delete Account & Data'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
