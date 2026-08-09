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
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    if (!user?.uid) return
    const unsub = subscribeUserWorkspaces(user.uid, (list) => {
      setWorkspaces(list)
      setLoading(false)
    })
    return unsub
  }, [user?.uid])

  const userPlan = userData?.billing_plan_id || 'free'

  const handleTeamSizeChange = (newSize) => {
    setTeamSize(newSize)
    const rec = getRecommendedWorkflow(newSize)
    if (rec && isWorkflowUnlocked(rec.id, userPlan)) {
      setSelectedWorkflow(rec.id)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreateError('')
    setIsCreating(true)
    try {
      const newId = await createWorkspace(user.uid, user.email, newName.trim(), teamSize, selectedWorkflow)
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
      // Non-admins always auto-redirect to their first assigned workspace
      return <Navigate to={`/${workspaces[0].workspaceId}`} replace />
    } else if (workspaces.length === 1) {
      // Admins with exactly 1 workspace auto-redirect
      return <Navigate to={`/${workspaces[0].workspaceId}`} replace />
    }
  }

  if (isPickerForced && workspaces.length === 1) {
    return (
      <div className="workspace-picker-page">
         <div className="wp-container" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <h1 style={{ color: 'var(--accent-critical)', marginBottom: '12px' }}>Access Denied</h1>
            <p style={{ color: '#666', fontSize: '15px' }}>You need to be a member of more than one workspace to access this page.</p>
            <button onClick={() => navigate(-1)} className="wp-submit-btn" style={{ marginTop: '24px', maxWidth: '200px', margin: '24px auto 0' }}>Go Back</button>
         </div>
      </div>
    )
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
            Paper5 | SprintOS {newName.trim() ? `| ${newName.trim()}` : ''}
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

        {(workspaces.length === 0 || isAdmin) && (
          <div className="wp-create-section" style={{ borderTop: workspaces.length === 0 ? 'none' : undefined, paddingTop: workspaces.length === 0 ? 0 : undefined }}>
            <h3 className="wp-create-title">
              {workspaces.length === 0 ? 'Create your first workspace' : 'Create new workspace'}
            </h3>
            
            {canCreate ? (
              <form onSubmit={handleCreate}>
                <label htmlFor="workspace-name" className="sr-only" style={{ display: 'none' }}>Workspace Name</label>
                <input
                  id="workspace-name"
                  type="text"
                  className="wp-input"
                  placeholder="Workspace Name (e.g. Acme Corp)"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                  style={{ marginBottom: '12px' }}
                />

                <div style={{ marginBottom: '12px', textAlign: 'left' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary, #6b7280)', marginBottom: '4px', display: 'block', fontWeight: 600 }}>
                    Team Size (Admin Config):
                  </label>
                  <select
                    className="wp-input"
                    value={teamSize}
                    onChange={(e) => handleTeamSizeChange(e.target.value)}
                    style={{ margin: 0, padding: '10px 12px' }}
                  >
                    {TEAM_SIZE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '16px', textAlign: 'left' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary, #6b7280)', marginBottom: '4px', display: 'block', fontWeight: 600 }}>
                    Aligned Agile Workflow:
                  </label>
                  <select
                    className="wp-input"
                    value={selectedWorkflow}
                    onChange={(e) => setSelectedWorkflow(e.target.value)}
                    style={{ margin: 0, padding: '10px 12px' }}
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

                {createError && <div style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '12px' }}>{createError}</div>}
                
                <button type="submit" className="wp-submit-btn" disabled={isCreating || !newName.trim()}>
                  {isCreating ? 'Creating Workspace...' : 'Create Workspace'}
                </button>
              </form>
            ) : (
              <div style={{ padding: '20px', background: '#f9fafb', borderRadius: '12px', border: '1px solid #eaeaea', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px', lineHeight: 1.5 }}>
                  You have reached the maximum number of workspaces ({maxWorkspaces}) for your {userPlan} plan.
                </p>
                <button className="wp-submit-btn" onClick={() => window.open('/#pricing', '_blank')} style={{ marginTop: 0 }}>
                  Upgrade Plan
                </button>
              </div>
            )}
          </div>
        )}

        <div className="wp-footer">
          <button className="wp-footer-btn" onClick={logout}>Sign out securely</button>
        </div>
      </div>
    </div>
  )
}
