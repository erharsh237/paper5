import { useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { createWorkspace } from '../lib/workspaces'
import { TEAM_SIZE_OPTIONS, WORKFLOWS, getRecommendedWorkflow, isWorkflowUnlocked } from '../lib/workflows'
import { supabase } from '../lib/supabase'
import PricingModal from '../components/PricingModal'
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
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [modalStep, setModalStep] = useState(1) // 1: Details, 2: Data Consent
  const [saveData, setSaveData] = useState(false) // default off
  const [createError, setCreateError] = useState('')

  const userId = user?.id || user?.uid
  const userPlan = userData?.billing_plan_id || 'free'
  const hasActivePaidPlan = ['starter', 'team', 'scale'].includes(userPlan) || (userData?.billing_status === 'active' && userPlan !== 'free' && userPlan !== 'member')

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    let isMounted = true

    const syncAndRedirect = async () => {
      const cleanEmail = user?.email ? user.email.trim().toLowerCase() : ''
      let targetWsId = null

      // 1. Accept any real pending invites via serverless API
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

      if (isMounted) {
        setWorkspaces(mapped)
        setLoading(false)

        // Navigate directly to their workspace if member of one
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

  const handleSelectPlan = async (planId) => {
    try {
      await supabase.from('users').update({ billing_plan_id: planId, billing_status: 'active' }).eq('id', userId)
      setShowPricingModal(false)
      setShowCreateModal(true)
    } catch (err) {
      console.error('Plan selection notice:', err)
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

  // If user has 0 workspaces and no paid plan: Show Access Restricted / Upgrade Screen
  if (workspaces.length === 0 && !hasActivePaidPlan) {
    return (
      <div className="workspace-picker-page">
        <div className="wp-bg-elements" aria-hidden="true">
          <div className="wp-orb wp-orb-1" />
          <div className="wp-orb wp-orb-2" />
          <div className="wp-orb wp-orb-3" />
          <div className="wp-grid" />
        </div>
        
        <div className="wp-container" style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center', padding: '60px 24px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            margin: '0 auto 20px'
          }}>
            🔒
          </div>
          
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary, #111827)', marginBottom: '12px', letterSpacing: '-0.02em' }}>
            No Active Workspace
          </h2>
          
          <p style={{ fontSize: '14px', color: 'var(--text-secondary, #6B7280)', lineHeight: 1.6, marginBottom: '28px' }}>
            Your account is not currently a member of any active workspace. To access SprintOS, you must either be invited by a workspace administrator or subscribe to a plan.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-primary"
              style={{ width: '100%', maxWidth: '280px', padding: '12px 20px', fontSize: '14px', fontWeight: 700, borderRadius: '8px' }}
              onClick={() => setShowPricingModal(true)}
            >
              View Plans & Upgrade
            </button>
            
            <button
              type="button"
              className="btn-ghost"
              style={{ color: 'var(--text-secondary, #6B7280)', fontSize: '13px', padding: '8px 16px', cursor: 'pointer' }}
              onClick={() => logout().then(() => navigate('/login'))}
            >
              Sign out securely
            </button>
          </div>
        </div>

        <PricingModal
          isOpen={showPricingModal}
          onClose={() => setShowPricingModal(false)}
          currentPlan={userPlan}
          onSelectPlan={handleSelectPlan}
        />
      </div>
    )
  }

  const isAdmin = workspaces.some(w => w.role === 'owner' || w.role === 'admin')
  const ownedCount = workspaces.filter(w => w.role === 'owner' || w.role === 'admin').length
  
  let maxWorkspaces = 1
  if (userPlan === 'team') maxWorkspaces = 5
  if (userPlan === 'scale') maxWorkspaces = 10
  
  const canCreate = ownedCount < maxWorkspaces || hasActivePaidPlan
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
        <div className="wp-modal-overlay" onClick={() => !isCreating && setShowCreateModal(false)}>
          <div className="wp-modal-card" onClick={e => e.stopPropagation()}>
            <button className="wp-modal-close" onClick={() => !isCreating && setShowCreateModal(false)} aria-label="Close">
              ✕
            </button>

            {modalStep === 1 ? (
              <form onSubmit={handleNextStep}>
                <div className="wp-modal-header">
                  <h2>Create Workspace</h2>
                  <p>Configure your workspace name and preferences</p>
                </div>

                {createError && <div className="wp-error-banner">{createError}</div>}

                <div className="wp-form-group">
                  <label htmlFor="ws-name">Workspace Name</label>
                  <input
                    id="ws-name"
                    type="text"
                    className="wp-input"
                    placeholder="e.g. Acme Engineering"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    required
                    autoFocus
                    disabled={isCreating}
                  />
                </div>

                <div className="wp-form-group">
                  <label htmlFor="ws-teamsize">Team Size</label>
                  <select
                    id="ws-teamsize"
                    className="wp-select"
                    value={teamSize}
                    onChange={e => {
                      setTeamSize(e.target.value)
                      setSelectedWorkflow(getRecommendedWorkflow(e.target.value))
                    }}
                    disabled={isCreating}
                  >
                    {TEAM_SIZE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="wp-form-group">
                  <label>Workflow Mode</label>
                  <div className="workflow-options-grid">
                    {Object.entries(WORKFLOWS).map(([key, wf]) => {
                      const isUnlocked = isWorkflowUnlocked(key, userPlan)
                      const isSelected = selectedWorkflow === key

                      return (
                        <div
                          key={key}
                          className={`workflow-card-option ${isSelected ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}`}
                          onClick={() => {
                            if (isUnlocked) setSelectedWorkflow(key)
                          }}
                        >
                          <div className="wf-card-header">
                            <span className="wf-name">{wf.name}</span>
                            {!isUnlocked && (
                              <span className="wf-lock-badge">
                                🔒 {wf.requiredPlan ? wf.requiredPlan.charAt(0).toUpperCase() + wf.requiredPlan.slice(1) : 'Pro'}
                              </span>
                            )}
                          </div>
                          <p className="wf-desc">{wf.description}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="wp-modal-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setShowCreateModal(false)}
                    disabled={isCreating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={!newName.trim() || isCreating}
                  >
                    Continue →
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreate}>
                <div className="wp-modal-header">
                  <h2>Data Storage Consent</h2>
                  <p>Choose whether SprintOS may store workspace state</p>
                </div>

                {createError && <div className="wp-error-banner">{createError}</div>}

                <div className="wp-consent-box">
                  <label className="wp-consent-label">
                    <input
                      type="checkbox"
                      checked={saveData}
                      onChange={e => setSaveData(e.target.checked)}
                      disabled={isCreating}
                    />
                    <span>
                      <strong>Allow SprintOS to persist workspace data</strong>
                      <small>
                        Enables saving tasks, deadlines, meeting notes, and team configuration across sessions.
                      </small>
                    </span>
                  </label>
                </div>

                <div className="wp-modal-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setModalStep(1)}
                    disabled={isCreating}
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isCreating}
                  >
                    {isCreating ? 'Provisioning…' : 'Create Workspace'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        currentPlan={userPlan}
        onSelectPlan={handleSelectPlan}
      />
    </div>
  )
}
