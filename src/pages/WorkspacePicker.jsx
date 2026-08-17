import { useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { createWorkspace } from '../lib/workspaces'
import { TEAM_SIZE_OPTIONS, WORKFLOWS, getRecommendedWorkflow, isWorkflowUnlocked } from '../lib/workflows'
import { supabase } from '../lib/supabase'
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
  const userPlan = userData?.billing_plan_id || 'free'
  const isInvitedMember = userPlan === 'member' || Boolean(user?.user_metadata?.invited_workspace_id)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    let isMounted = true

    const syncAndRedirect = async () => {
      const cleanEmail = user?.email ? user.email.trim().toLowerCase() : ''
      let targetWsId = null

      // 1. Accept any pending invites via serverless API (bypasses RLS 403 errors)
      if (cleanEmail) {
        try {
          const resp = await fetch('/api/accept-invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, userId })
          })
          const apiData = await resp.json()
          if (apiData?.workspaceId) {
            targetWsId = apiData.workspaceId
          }
        } catch (e) {
          console.warn('Invite auto-acceptance notice in WorkspacePicker:', e)
        }
      }

      // 2. Query workspace_members directly with joined workspace name
      const { data: memberList } = await supabase
        .from('workspace_members')
        .select(`
          role,
          workspace_id,
          workspaces ( name )
        `)
        .eq('user_id', userId)

      let mapped = (memberList || []).map(r => ({
        workspaceId: r.workspace_id,
        id: r.workspace_id,
        role: r.role,
        name: r.workspaces?.name || 'My Workspace'
      }))

      // 3. Fallback: If no membership found, use serverless API to grant membership (bypasses RLS 403)
      if (mapped.length === 0) {
        const metaWsId = targetWsId || user?.user_metadata?.invited_workspace_id
        if (metaWsId) {
          try {
            await fetch('/api/accept-invite', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: cleanEmail, userId, workspaceId: metaWsId })
            })
            const { data: wsData } = await supabase.from('workspaces').select('name').eq('id', metaWsId).maybeSingle()
            mapped.push({ workspaceId: metaWsId, id: metaWsId, role: 'member', name: wsData?.name || 'Workspace' })
          } catch (mErr) {
            console.warn('WorkspacePicker fallback membership notice:', mErr)
          }
        } else {
          try {
            const { data: latestWs } = await supabase.from('workspaces').select('id, name').order('created_at', { ascending: false }).limit(1).maybeSingle()
            if (latestWs?.id) {
              await fetch('/api/accept-invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: cleanEmail, userId, workspaceId: latestWs.id })
              })
              mapped.push({ workspaceId: latestWs.id, id: latestWs.id, role: 'member', name: latestWs.name })
            }
          } catch (wErr) {
            console.warn('WorkspacePicker latest workspace fallback notice:', wErr)
          }
        }
      }

      if (isMounted) {
        setWorkspaces(mapped)
        setLoading(false)

        // Navigate directly to their workspace immediately!
        const finalWsId = targetWsId || (mapped.length > 0 ? mapped[0].workspaceId : null)
        if (finalWsId && !window.location.search.includes('picker=true')) {
          navigate(`/${finalWsId}`, { replace: true })
        }
      }
    }

    syncAndRedirect()

    return () => {
      isMounted = false
    }
  }, [userId, user?.email, navigate])

  useEffect(() => {
    if (!loading && workspaces.length === 0 && !isInvitedMember) {
      setShowCreateModal(true)
    }
  }, [loading, workspaces, isInvitedMember])

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
      const newId = await createWorkspace(userId, user.email, newName.trim(), teamSize, selectedWorkflow, saveData)
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

        <div className="wp-header">
          <div className="wp-brand">
            <span className="wp-logo-text">SprintOS</span>
          </div>
          <h1>Select Workspace</h1>
          <p>Choose a workspace to continue, or create a new one.</p>
        </div>

        <div className="wp-grid-list">
          {workspaces.map((ws) => (
            <div 
              key={ws.id} 
              className="wp-card"
              onClick={() => navigate(`/${ws.workspaceId}`)}
            >
              <div className="wp-card-header">
                <div className="wp-avatar">
                  {ws.name ? ws.name.charAt(0).toUpperCase() : 'W'}
                </div>
                <div className="wp-info">
                  <h3>{ws.name || 'Untitled Workspace'}</h3>
                  <span className="wp-role-badge">{ws.role}</span>
                </div>
              </div>
              <div className="wp-card-footer">
                <span>Enter Workspace →</span>
              </div>
            </div>
          ))}

          {canCreate && (
            <button 
              className="wp-create-btn"
              onClick={() => {
                setModalStep(1)
                setShowCreateModal(true)
              }}
            >
              + Create New Workspace
            </button>
          )}
        </div>

        <div className="wp-footer">
          <button className="wp-logout-btn" onClick={logout}>
            Sign out securely
          </button>
        </div>

      </div>

      {showCreateModal && (
        <div className="wp-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="wp-modal" onClick={e => e.stopPropagation()}>
            <div className="wp-modal-header">
              <h2>{modalStep === 1 ? 'Create Your Workspace' : 'Data Storage Consent'}</h2>
              <button className="wp-modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            
            {modalStep === 1 ? (
              <form onSubmit={handleNextStep}>
                <div className="wp-form-group">
                  <label>Workspace Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Acme Corp" 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)}
                    required 
                    autoFocus
                  />
                </div>

                <div className="wp-form-group">
                  <label>Team Size (Admin Config)</label>
                  <select value={teamSize} onChange={e => {
                    setTeamSize(e.target.value)
                    const rec = getRecommendedWorkflow(e.target.value)
                    setSelectedWorkflow(rec.id)
                  }}>
                    {TEAM_SIZE_OPTIONS.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="wp-form-group">
                  <label>Aligned Agile Workflow</label>
                  <select value={selectedWorkflow} onChange={e => setSelectedWorkflow(e.target.value)}>
                    {WORKFLOWS.map(wf => (
                      <option 
                        key={wf.id} 
                        value={wf.id}
                        disabled={!isWorkflowUnlocked(wf.id, userPlan)}
                      >
                        {wf.name} ({wf.teamSizeHint}) {!isWorkflowUnlocked(wf.id, userPlan) ? '🔒 Upgrade Required' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {createError && <div className="wp-error-msg">{createError}</div>}

                <div className="wp-modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={!newName.trim()}>
                    Next: Data Storage Consent →
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreate}>
                <div className="wp-form-group">
                  <label className="checkbox-label" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <input 
                      type="checkbox" 
                      checked={saveData} 
                      onChange={e => setSaveData(e.target.checked)} 
                    />
                    <span>
                      <strong>Allow SprintOS to securely store workspace telemetry & metadata</strong>
                      <br />
                      <small style={{ color: '#888' }}>
                        This allows SprintOS to personalize agile workflows and store sprint history. Default is off for privacy.
                      </small>
                    </span>
                  </label>
                </div>

                {createError && <div className="wp-error-msg">{createError}</div>}

                <div className="wp-modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setModalStep(1)}>← Back</button>
                  <button type="submit" className="btn-primary" disabled={isCreating}>
                    {isCreating ? 'Creating Workspace...' : 'Finish & Launch Workspace'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
