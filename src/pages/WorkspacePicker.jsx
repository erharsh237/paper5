import { useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { subscribeUserWorkspaces, createWorkspace } from '../lib/workspaces'
import { TEAM_SIZE_OPTIONS, WORKFLOWS, getRecommendedWorkflow, isWorkflowUnlocked } from '../lib/workflows'
import './WorkspacePicker.css'

export default function WorkspacePicker() {
  const { user, userData, logout } = useAuth()
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [teamSize, setTeamSize] = useState('2-5')
  const [selectedWorkflow, setSelectedWorkflow] = useState('kanban')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [modalStep, setModalStep] = useState(1) // 1: Details, 2: Data Consent
  const [saveData, setSaveData] = useState(false) // default off
  const [createError, setCreateError] = useState('')

  const userId = user?.id || user?.uid

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    const unsub = subscribeUserWorkspaces(userId, (list) => {
      setWorkspaces(list || [])
      setLoading(false)
    })
    return () => {
      if (typeof unsub === 'function') unsub()
    }
  }, [userId])

  useEffect(() => {
    if (!loading && workspaces.length === 0) {
      setShowCreateModal(true)
    }
  }, [loading, workspaces])

  const handleNextStep = (e) => {
    if (e) e.preventDefault()
    if (!newName.trim()) return
    setCreateError('')
    setModalStep(2)
  }

  const handleCreate = async (e) => {
    if (e) e.preventDefault()
    if (!newName.trim()) return
    setCreateError('')
    setIsCreating(true)
    try {
      const newId = await createWorkspace(user.uid, user.email, newName.trim(), teamSize, selectedWorkflow, saveData)
      navigate(`/${newId}`)
    } catch (err) {
      console.error('Failed to create workspace:', err)
      setCreateError(err?.message || 'Initialization failed: Unable to provision a new workspace. Please verify your connection.')
    } finally {
      setIsCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="workspace-picker-page">
        <div className="wp-bg-elements" aria-hidden="true">
          <div className="wp-orb wp-orb-1" />
          <div className="wp-orb wp-orb-2" />
          <div className="wp-orb wp-orb-3" />
          <div className="wp-grid" />
        </div>
        <div className="wp-container" style={{ textAlign: 'center' }}>
          <p style={{ color: '#666', fontSize: '15px' }}>Loading workspaces...</p>
        </div>
      </div>
    )
  }

  const userPlan = userData?.billing_plan_id || 'free'
  const isAdmin = workspaces.some(w => w.role === 'owner' || w.role === 'admin')
  const ownedCount = workspaces.filter(w => w.role === 'owner' || w.role === 'admin').length
  
  let maxWorkspaces = 1
  if (userPlan === 'team') maxWorkspaces = 5
  if (userPlan === 'scale') maxWorkspaces = 10
  
  const canCreate = ownedCount < maxWorkspaces
  const isPickerForced = window.location.search.includes('picker=true')
  
  // Routing logic
  if (!isPickerForced && workspaces.length > 0) {
    if (!isAdmin) {
      return <Navigate to={`/${workspaces[0].workspaceId}`} replace />
    } else if (workspaces.length === 1) {
      return <Navigate to={`/${workspaces[0].workspaceId}`} replace />
    }
  }

  return (
    <div className="workspace-picker-page">
      <div className="wp-bg-elements" aria-hidden="true">
        <div className="wp-orb wp-orb-1" />
        <div className="wp-orb wp-orb-2" />
        <div className="wp-orb wp-orb-3" />
        <div className="wp-grid" />
      </div>
      
      <div className="wp-container">
        {workspaces.length > 0 && (
          <button 
            className="wp-back-btn"
            onClick={() => navigate(-1)} 
            title="Back to Dashboard"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        )}

        <div className="wp-header">
          <div className="wp-brand">
            SprintOS {newName.trim() ? `| ${newName.trim()}` : ''}
          </div>
          <h1 className="wp-title">Select Workspace</h1>
          <p className="wp-subtitle">
            Choose a workspace to continue, or create a new one.
          </p>
        </div>

        {workspaces.length > 0 && (
          <div className="wp-list">
            {workspaces.map(w => (
              <button
                key={w.id}
                className="wp-card-btn"
                onClick={() => navigate(`/${w.workspaceId}`)}
              >
                <span className="wp-card-name">{w.name}</span>
                <span className="wp-card-role">{w.role}</span>
              </button>
            ))}
          </div>
        )}

        {canCreate && (
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <button
              type="button"
              className="wp-submit-btn"
              onClick={() => {
                setModalStep(1)
                setShowCreateModal(true)
              }}
            >
              + Create New Workspace
            </button>
          </div>
        )}

        <div className="wp-footer">
          <button className="wp-footer-btn" onClick={logout}>Sign out securely</button>
        </div>
      </div>

      {/* POPUP MODAL WHITE BG FOR WORKSPACE CREATION & DATA CONSENT */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          overflowY: 'auto'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '560px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            border: '1px solid #e4e4e7',
            padding: '32px',
            textAlign: 'left',
            color: '#18181b',
            position: 'relative'
          }}>
            {/* Realtime Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #f4f4f5' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#09090b', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                SprintOS {newName.trim() ? `| ${newName.trim()}` : ''}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#71717a', background: '#f4f4f5', padding: '4px 10px', borderRadius: '20px' }}>
                Step {modalStep} of 2
              </div>
            </div>

            {createError && (
              <div style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px' }}>
                {createError}
              </div>
            )}

            {/* STEP 1: Workspace Details Modal */}
            {modalStep === 1 && (
              <form onSubmit={handleNextStep}>
                <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 6px 0', color: '#09090b', letterSpacing: '-0.02em' }}>
                  Create Your Workspace
                </h2>
                <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#71717a' }}>
                  Set up your workspace configuration to collaborate with your team.
                </p>

                <div style={{ marginBottom: '18px' }}>
                  <label htmlFor="modal-ws-name" style={{ fontSize: '13px', fontWeight: 700, color: '#27272a', marginBottom: '6px', display: 'block' }}>
                    Workspace Name
                  </label>
                  <input
                    id="modal-ws-name"
                    type="text"
                    className="wp-input"
                    placeholder="e.g. Acme Corp"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    required
                    style={{ margin: 0, padding: '12px 14px', fontSize: '14px', borderRadius: '8px', border: '1px solid #d4d4d8' }}
                  />
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#27272a', marginBottom: '6px', display: 'block' }}>
                    Team Size (Admin Config)
                  </label>
                  <select
                    className="wp-input"
                    value={teamSize}
                    onChange={(e) => handleTeamSizeChange(e.target.value)}
                    style={{ margin: 0, padding: '12px 14px', fontSize: '14px', borderRadius: '8px', border: '1px solid #d4d4d8' }}
                  >
                    {TEAM_SIZE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '28px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#27272a', marginBottom: '6px', display: 'block' }}>
                    Aligned Agile Workflow
                  </label>
                  <select
                    className="wp-input"
                    value={selectedWorkflow}
                    onChange={(e) => setSelectedWorkflow(e.target.value)}
                    style={{ margin: 0, padding: '12px 14px', fontSize: '14px', borderRadius: '8px', border: '1px solid #d4d4d8' }}
                  >
                    {WORKFLOWS.map(wf => {
                      const unlocked = isWorkflowUnlocked(wf.id, userPlan)
                      return (
                        <option key={wf.id} value={wf.id} disabled={!unlocked}>
                          {wf.num}. {wf.name} ({wf.teamSizeLabel}) {!unlocked ? `🔒 [${userPlan === 'team' ? 'Scale Only' : 'Team/Scale Only'}]` : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  {workspaces.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      style={{
                        padding: '12px 20px',
                        borderRadius: '8px',
                        background: '#f4f4f5',
                        color: '#27272a',
                        fontSize: '14px',
                        fontWeight: 600,
                        border: '1px solid #e4e4e7',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!newName.trim()}
                    style={{
                      flex: 1,
                      padding: '12px 20px',
                      borderRadius: '8px',
                      background: !newName.trim() ? '#9ca3af' : '#09090b',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 700,
                      border: 'none',
                      cursor: !newName.trim() ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Next: Data Storage Consent →
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Data Storing Consent Modal */}
            {modalStep === 2 && (
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 6px 0', color: '#09090b', letterSpacing: '-0.02em' }}>
                  Data Storage & Persistence Preference
                </h2>
                <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#71717a' }}>
                  Choose how workspace task data and sprint items are stored.
                </p>

                <div style={{
                  background: '#f8fafc',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '20px',
                  marginBottom: '28px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                      Cloud Data Persistence
                    </span>
                    
                    <button
                      type="button"
                      role="switch"
                      aria-checked={saveData}
                      onClick={() => setSaveData(!saveData)}
                      style={{
                        position: 'relative',
                        display: 'inline-block',
                        width: '48px',
                        height: '26px',
                        borderRadius: '34px',
                        border: 'none',
                        backgroundColor: saveData ? '#10b981' : '#cbd5e1',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease',
                        padding: 0,
                        outline: 'none'
                      }}
                    >
                      <span style={{
                        position: 'absolute',
                        height: '20px',
                        width: '20px',
                        left: saveData ? '25px' : '3px',
                        top: '3px',
                        backgroundColor: '#ffffff',
                        borderRadius: '50%',
                        transition: 'left 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }} />
                    </button>
                  </div>

                  {saveData ? (
                    <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.6 }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#10b981' }}>✓</span> Cloud Sync Enabled (Recommended)
                      </div>
                      Workspaces, sprints, and team task items are securely persisted in encrypted database storage for cross-device synchronization and team collaboration.
                    </div>
                  ) : (
                    <div style={{ fontSize: '13px', color: '#b45309', lineHeight: 1.6 }}>
                      <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Zero-Data Retention Mode Active
                      </div>
                      No workspace telemetry or task data is stored on remote servers. All sprint items exist strictly in local browser memory. Closing your browser session permanently purges transient workspace data.
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setModalStep(1)}
                    disabled={isCreating}
                    style={{
                      padding: '12px 20px',
                      borderRadius: '8px',
                      background: '#f4f4f5',
                      color: '#27272a',
                      fontSize: '14px',
                      fontWeight: 600,
                      border: '1px solid #e4e4e7',
                      cursor: isCreating ? 'not-allowed' : 'pointer'
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={isCreating}
                    style={{
                      flex: 1,
                      padding: '12px 20px',
                      borderRadius: '8px',
                      background: '#10b981',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 700,
                      border: 'none',
                      cursor: isCreating ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isCreating ? 'Creating Workspace...' : 'Complete & Launch Workspace'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
