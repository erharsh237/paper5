import { useState, useEffect, useMemo } from 'react'
import { Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { createWorkspace, ensureUserRecordExists } from '../lib/workspaces'
import { TEAM_SIZE_OPTIONS, WORKFLOWS, getRecommendedWorkflow, isWorkflowUnlocked } from '../lib/workflows'
import { supabase } from '../lib/supabase'
import PricingModal from '../components/PricingModal'
import { getPlanLimits, formatPlanBadge } from '../lib/plans'
import ThemeToggle from '../components/ThemeToggle'
import SEOHead from '../components/SEOHead'
import './WorkspacePicker.css'
import { WorkspacePickerGridSkeleton } from '../components/PageSkeleton'

export default function WorkspacePicker() {
  const { user, userData, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [workspaces, setWorkspaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [teamSize, setTeamSize] = useState('2-5')
  const [selectedWorkflow, setSelectedWorkflow] = useState('kanban')
  const [showCreateModal, setShowCreateModal] = useState(() => (
    location.search.includes('create=true') || window.location.search.includes('create=true')
  ))
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [modalStep, setModalStep] = useState(1) // 1: Details, 2: Data Consent
  const [saveData, setSaveData] = useState(false) // default off
  const [createError, setCreateError] = useState('')

  const userId = user?.id || user?.uid

  const currentWsId = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const fromParam = params.get('current')
    if (fromParam && fromParam.trim()) return fromParam.trim()

    const fromLocal = localStorage.getItem('current_workspace_id')
    if (fromLocal && fromLocal.trim()) return fromLocal.trim()

    const fromSession = sessionStorage.getItem('current_workspace_id')
    if (fromSession && fromSession.trim()) return fromSession.trim()

    if (typeof document !== 'undefined' && document.referrer) {
      try {
        const refUrl = new URL(document.referrer)
        const match = refUrl.pathname.match(/\/([0-9a-fA-F-]{36})/)
        if (match && match[1]) return match[1].trim()
      } catch (_) {}
    }

    return null
  }, [location.search])

  // Derive effective tier across user record and owned workspaces
  const userPlan = useMemo(() => {
    const rawUserPlan = (userData?.billing_plan_id || '').toLowerCase().trim()
    if (['pro', 'scale', 'enterprise'].includes(rawUserPlan)) return 'pro'
    if (rawUserPlan === 'team') return 'team'

    // Check if user is owner/admin of any workspace that is on Pro or Team
    for (const ws of workspaces) {
      if (ws.role === 'owner' || ws.role === 'admin') {
        const wsPlan = (ws.plan || '').toLowerCase().trim()
        if (['pro', 'scale', 'enterprise'].includes(wsPlan)) return 'pro'
        if (wsPlan === 'team') return 'team'
      }
    }

    // Default to 'pro' during launch special
    return 'pro'
  }, [userData?.billing_plan_id, workspaces])

  const planLimits = getPlanLimits(userPlan)
  const maxWorkspaces = planLimits.maxWorkspaces || 10
  const hasActivePaidPlan = ['starter', 'team', 'scale', 'pro'].includes(userPlan?.toLowerCase()) || (userData?.billing_status === 'active' && userPlan !== 'free' && userPlan !== 'member')

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

      // 1.5 Auto-upgrade user and owned workspaces to Pro in Supabase
      if (userId) {
        try {
          supabase.from('users').update({ billing_plan_id: 'pro', billing_status: 'active' }).eq('id', userId).then()
          supabase.from('workspaces').update({ billing_plan_id: 'pro' }).eq('created_by', userId).in('billing_plan_id', ['starter', 'free', 'member', null]).then()
        } catch (_) {}
      }

      // 2. Query workspace_members directly with joined workspace name and tier
      let mapped = []
      const { data: memberList, error: memberErr } = await supabase
        .from('workspace_members')
        .select(`
          role,
          workspace_id,
          workspaces ( id, name, billing_plan_id, settings )
        `)
        .eq('user_id', userId)

      if (memberErr) {
        console.warn('workspace_members query notice in WorkspacePicker:', memberErr)
      }

      if (Array.isArray(memberList) && memberList.length > 0) {
        mapped = memberList.map(r => {
          const rawPlan = (r.workspaces?.billing_plan_id || r.workspaces?.settings?.plan || '').toLowerCase().trim()
          const plan = rawPlan === 'team' ? 'team' : 'pro'
          return {
            workspaceId: r.workspace_id,
            id: r.workspace_id,
            role: r.role || 'member',
            name: r.workspaces?.name || 'My Workspace',
            plan
          }
        })
      }

      // Robust fallback: Query workspaces created by this user directly via created_by
      try {
        const { data: ownedWs, error: ownedWsErr } = await supabase
          .from('workspaces')
          .select('id, name, billing_plan_id, settings')
          .eq('created_by', userId)
        
        if (ownedWsErr) {
          console.warn('Direct workspaces query notice:', ownedWsErr)
        } else if (Array.isArray(ownedWs) && ownedWs.length > 0) {
          const existingIds = new Set(mapped.map(m => m.workspaceId))
          ownedWs.forEach(ow => {
            if (!existingIds.has(ow.id)) {
              const rawPlan = (ow.billing_plan_id || ow.settings?.plan || '').toLowerCase().trim()
              const plan = rawPlan === 'team' ? 'team' : 'pro'
              mapped.push({
                workspaceId: ow.id,
                id: ow.id,
                role: 'owner',
                name: ow.name || 'My Workspace',
                plan
              })
              existingIds.add(ow.id)
            }
          })
        }
      } catch (directErr) {
        console.warn('Direct workspaces query notice:', directErr)
      }

      if (isMounted) {
        setWorkspaces(mapped)
        setLoading(false)

        // Navigate directly to their workspace ONLY if this is a default entry and picker is NOT requested
        const isPickerRequested = location.search.includes('picker=true') || window.location.search.includes('picker=true') || location.search.includes('create=true')
        const finalWsId = targetWsId || (mapped.length > 0 ? mapped[0].workspaceId : null)
        if (finalWsId && !isPickerRequested) {
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
    if (ownedCount >= maxWorkspaces) {
      setShowCreateModal(false)
      setShowPricingModal(true)
      return
    }
    setCreateError('')
    setIsCreating(true)
    try {
      const newId = await createWorkspace(userId, user.email, newName.trim(), teamSize, selectedWorkflow, saveData, userPlan)
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
      await ensureUserRecordExists(userId, user?.email, { billing_plan_id: planId, billing_status: 'active' })
      await supabase.from('users').update({ billing_plan_id: planId, billing_status: 'active' }).eq('id', userId)
      if (userData) {
        userData.billing_plan_id = planId
        userData.billingPlanId = planId
      }
      setShowPricingModal(false)
      setModalStep(1)
      setShowCreateModal(true)
    } catch (err) {
      console.error('Plan selection notice:', err)
      setShowPricingModal(false)
      setModalStep(1)
      setShowCreateModal(true)
    }
  }

  const workspaceSeo = (
    <SEOHead
      title="Select Workspace | Paper5"
      description="Choose or create a Paper5 workspace for your team."
      noIndex={true}
    />
  )

  if (loading) {
    return (
      <div className="workspace-picker-page">
        <div className="wp-bg-elements" aria-hidden="true">
          <div className="wp-orb wp-orb-1" />
          <div className="wp-orb wp-orb-2" />
          <div className="wp-orb wp-orb-3" />
          <div className="wp-grid" />
        </div>
        {workspaceSeo}
        <div className="wp-container" style={{ textAlign: 'center' }}>
          <WorkspacePickerGridSkeleton />
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
        
        {workspaceSeo}
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
            Your account is not currently a member of any active workspace. To access Paper5, you must either be invited by a workspace administrator or subscribe to a plan.
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
  const canCreateDirectly = ownedCount < maxWorkspaces

  const handleOpenCreateWorkspace = () => {
    if (ownedCount >= maxWorkspaces) {
      setShowPricingModal(true)
      return
    }
    setModalStep(1)
    setShowCreateModal(true)
  }

  const isPickerForced = location.search.includes('picker=true') || window.location.search.includes('picker=true') || location.search.includes('create=true')
  
  // Routing logic: only auto-redirect if NOT forced by picker=true or create=true
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
      
      {workspaceSeo}
      <div className="wp-container">

        <div className="wp-header">
          <div className="wp-brand">
            <span className="wp-logo-text">Paper5</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <ThemeToggle />
          </div>
          <h1>Select Workspace</h1>
          <p>Choose a workspace to continue, or create a new one.</p>
        </div>

        <div className="wp-grid-list">
          {workspaces.map((ws) => {
            const isCurrent = Boolean(
              currentWsId && (
                ws.workspaceId === currentWsId || 
                ws.id === currentWsId ||
                String(ws.workspaceId).toLowerCase() === String(currentWsId).toLowerCase() ||
                String(ws.id).toLowerCase() === String(currentWsId).toLowerCase()
              )
            )

            return (
              <div 
                key={ws.id || ws.workspaceId} 
                className={`wp-card ${isCurrent ? 'wp-card--current' : ''}`}
                onClick={() => {
                  if (!isCurrent) {
                    try {
                      localStorage.setItem('current_workspace_id', ws.workspaceId)
                      sessionStorage.setItem('current_workspace_id', ws.workspaceId)
                    } catch (_) {}
                    navigate(`/${ws.workspaceId}`)
                  }
                }}
              >
                <div className="wp-card-header">
                  <div className="wp-avatar">
                    {ws.name ? ws.name.charAt(0).toUpperCase() : 'W'}
                  </div>
                  <div className="wp-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3>{ws.name || 'Untitled Workspace'}</h3>
                      {isCurrent && (
                        <span className="wp-current-badge">CURRENT</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="wp-role-badge">{ws.role || 'member'}</span>
                      <span className="wp-plan-badge">{formatPlanBadge(ws.plan || userPlan)}</span>
                    </div>
                  </div>
                </div>
                <div className="wp-card-footer">
                  <span className={isCurrent ? 'wp-enter-text--disabled' : ''}>
                    {isCurrent ? 'Current Workspace' : 'Enter Workspace \u2192'}
                  </span>
                </div>
              </div>
            )
          })}

          <button 
            type="button"
            className="wp-create-btn"
            onClick={handleOpenCreateWorkspace}
          >
            + Create New Workspace
          </button>
        </div>

        <div className="wp-footer">
          <button type="button" className="wp-logout-btn" onClick={logout}>
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
              <form onSubmit={handleNextStep} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                <div className="wp-modal-header">
                  <h2>Create Workspace</h2>
                  <p>Configure your workspace name and preferences</p>
                </div>

                <div className="wp-modal-body-scroll">
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

                  <div className="wp-form-group" style={{ marginBottom: 0 }}>
                    <label>Workflow Mode</label>
                    <div className="workflow-options-grid">
                      {WORKFLOWS.map((wf) => {
                        const isUnlocked = isWorkflowUnlocked(wf.id, userPlan)
                        const isSelected = selectedWorkflow === wf.id

                        return (
                          <div
                            key={wf.id}
                            className={`workflow-card-option ${isSelected ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}`}
                            onClick={() => {
                              if (isUnlocked) setSelectedWorkflow(wf.id)
                            }}
                          >
                            <div className="wf-card-header">
                              <span className="wf-name">{wf.name}</span>
                              {!isUnlocked && (
                                <span className="wf-lock-badge">
                                  🔒 {wf.plans.includes('team') ? 'Team' : 'Scale'}
                                </span>
                              )}
                            </div>
                            <p className="wf-desc">{wf.description}</p>
                          </div>
                        )
                      })}
                    </div>
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
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                <div className="wp-modal-header">
                  <h2>Data Storage Consent</h2>
                  <p>Choose whether Paper5 may store workspace state</p>
                </div>

                <div className="wp-modal-body-scroll">
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
                        <strong>Allow Paper5 to persist workspace data</strong>
                        <small>
                          Enables saving tasks, deadlines, meeting notes, and team configuration across sessions.
                        </small>
                      </span>
                    </label>
                  </div>
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
