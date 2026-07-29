import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { subscribeProfile, saveProfile, saveAim, getAimLockStatus, uploadProfilePic, uploadResume, removeResume } from '../lib/profile'
import { subscribeRoles } from '../lib/roles'
import { resetTourSeen } from '../lib/onboarding'
import { getAllowedUser } from '../lib/allowlist'
import CalendarWidget from '../components/CalendarWidget'
import NotificationBell from '../components/NotificationBell'
import NavTabs from '../components/NavTabs'
import Breadcrumbs from '../components/Breadcrumbs'
import './Dashboard.css'
import './Profile.css'

const TEAM_ID = 'default-team'
const MAX_PIC_MB = 5
const MAX_RESUME_MB = 10

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
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [aim, setAim] = useState('')
  const [adminRole, setAdminRole] = useState('')
  
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [picUploading, setPicUploading] = useState(false)
  const [resumeUploading, setResumeUploading] = useState(false)
  const [error, setError] = useState('')
  
  const [currentStep, setCurrentStep] = useState(0)
  const TOTAL_STEPS = 4

  useEffect(() => {
    if (!user?.email) return
    
    getAllowedUser(user.email).then(data => {
      if (data?.Note) setAdminRole(data.Note)
    }).catch(console.error)

    return subscribeProfile(user.email, (p) => {
      setProfile(p)
      if (p) {
        setName(p.name || user.displayName || '')
        setPhone(p.phone || '')
        setBio(p.bio || '')
        setAim(p.aim || '')
      } else {
        setName(user.displayName || '')
      }
    })
  }, [user?.email, user?.displayName])

  const aimLock = getAimLockStatus(profile)

  async function handleSaveAll() {
    if (!name.trim() || !phone.trim() || !bio.trim() || !aim.trim() || !profile?.resumeURL) {
      setError('Please fill in all details (Name, Phone, Bio, Aim, and upload Resume) before saving.');
      return;
    }
    
    setError('')
    setSaving(true)
    try {
      await saveProfile(user.email, {
        name: name.trim(),
        phone: phone.trim(),
        roleId: profile?.roleId || '',
        roleName: adminRole || profile?.roleName || '',
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

  function nextStep() {
    if (currentStep < TOTAL_STEPS - 1) setCurrentStep(c => c + 1)
  }

  function prevStep() {
    if (currentStep > 0) setCurrentStep(c => c - 1)
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Breadcrumbs trail={[{ label: 'Profile Wizard' }]} />
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
                {adminRole || profile?.roleName ? (
                  <div className="role-badge">{adminRole || profile?.roleName}</div>
                ) : (
                  <div className="role-badge empty">Role pending assignment</div>
                )}
              </div>
            </div>
          </div>

          <div className="profile-card profile-card--main">
            <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-hair)', marginBottom: '16px' }}>
              <label className="btn-ghost btn-sm profile-upload-btn" style={{ padding: '4px 12px', fontSize: '12px' }}>
                {picUploading ? 'Uploading…' : 'Change photo'}
                <input type="file" accept="image/*" hidden onChange={handlePicChange} disabled={picUploading} />
              </label>
              <span className="profile-hint" style={{ marginLeft: '12px' }}>JPG/PNG, up to {MAX_PIC_MB}MB</span>
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
                    <h2 className="profile-section-title">Step 2: Securiq Aim</h2>
                    <div className="premium-field">
                      <label htmlFor="p-aim" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>What do you want to achieve from Securiq?</span>
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
                          {resumeUploading ? 'Uploading…' : profile?.resumeURL ? 'Replace' : 'Upload Resume'}
                          <input type="file" accept=".pdf,.doc,.docx" hidden onChange={handleResumeChange} disabled={resumeUploading} />
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

          <div className="profile-card profile-card--main" style={{ marginTop: '24px', border: '1px solid var(--accent-critical)' }}>
            <h2 className="profile-section-title" style={{ color: 'var(--accent-critical)' }}>Danger Zone</h2>
            <p className="profile-hint" style={{ marginBottom: '16px' }}>
              Deleting your account will remove your access to the tracker immediately. Your existing deadlines and sprints will remain (so team history isn't broken), but your personal profile data will be erased. This action cannot be undone.
            </p>
            <button type="button" className="btn-ghost btn-sm" style={{ color: 'var(--accent-critical)', borderColor: 'var(--accent-critical)' }} onClick={async () => {
              if (confirm('Are you absolutely sure you want to delete your account? You will lose access immediately.')) {
                try {
                  const { doc, deleteDoc, getFirestore } = await import('firebase/firestore')
                  const db = getFirestore()
                  // Delete personal profile doc
                  await deleteDoc(doc(db, 'profiles', user.uid))
                  // Delete allowlist doc (triggers session revocation via AuthContext)
                  await deleteDoc(doc(db, 'allowedUsers', user.email.toLowerCase()))
                  // Note: auth account deletion requires re-authentication, so we just remove their access here.
                  logout()
                } catch (err) {
                  console.error('Failed to delete account:', err)
                  setError('Could not delete account: ' + err.message)
                }
              }
            }}>
              Delete Account & Data
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
