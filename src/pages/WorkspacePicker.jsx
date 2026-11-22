import { useState, useEffect, useMemo } from 'react'
import { Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { createWorkspace, ensureUserRecordExists, setActiveWorkspace } from '../lib/workspaces'
import { TEAM_SIZE_OPTIONS, WORKFLOWS, getRecommendedWorkflow, isWorkflowUnlocked } from '../lib/workflows'
import { supabase } from '../lib/supabase'
import PricingModal from '../components/PricingModal'
import { getPlanLimits, formatPlanBadge, selectPlanServerSide } from '../lib/plans'
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
    let rawUserPlan = (userData?.billing_plan_id || user?.user_metadata?.plan || '').toLowerCase().trim()
    if (!rawUserPlan || rawUserPlan === 'unselected' || rawUserPlan === 'none' || rawUserPlan === 'member') {
      try {
        const stored = localStorage.getItem('sprintos_selected_plan')
        if (stored) {
          const clean = stored.toLowerCase().trim()
          rawUserPlan = (clean === 'free') ? 'starter' : (clean === 'scale' ? 'pro' : clean)
        }
      } catch (_) {}
    }
    if (['pro', 'scale', 'enterprise'].includes(rawUserPlan)) return 'pro'
    if (rawUserPlan === 'team') return 'team'
    if (rawUserPlan === 'starter' || rawUserPlan === 'free') return 'starter'

    // Check if user is owner/admin of any workspace that is on Pro, Team, or Starter
    for (const ws of workspaces) {
      if (ws.role === 'owner' || ws.role === 'admin') {
        const wsPlan = (ws.plan || '').toLowerCase().trim()
        if (['pro', 'scale', 'enterprise'].includes(wsPlan)) return 'pro'
        if (wsPlan === 'team') return 'team'
        if (wsPlan === 'starter' || wsPlan === 'free') return 'starter'
      }
    }

    return 'starter'
  }, [userData?.billing_plan_id, user?.user_metadata?.plan, workspaces])

  const planLimits = getPlanLimits(userPlan)
  const maxWorkspaces = planLimits.maxWorkspaces || 10
  const isRevokedMember = userData?.billing_plan_id === 'member'

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

      // 2. Query workspace_members directly with joined workspace name, tier, and is_active status
      let mapped = []
      let memberList = null
      let memberErr = null

      const resExplicit = await supabase
        .from('workspace_members')
        .select(`
          role,
          workspace_id,
          workspaces!workspace_members_workspace_id_fkey ( id, name, billing_plan_id, is_active, settings )
        `)
        .eq('user_id', userId)

      if (!resExplicit.error && resExplicit.data) {
        memberList = resExplicit.data
      } else {
        const resFallback = await supabase
          .from('workspace_members')
          .select(`
            role,
            workspace_id,
            workspaces ( id, name, billing_plan_id, is_active, settings )
          `)
          .eq('user_id', userId)
        memberList = resFallback.data
        memberErr = resFallback.error
      }

      if (memberErr) {
        console.warn('workspace_members query notice in WorkspacePicker:', memberErr)
      }

      if (Array.isArray(memberList) && memberList.length > 0) {
        mapped = memberList.map(r => {
          const rawPlan = (r.workspaces?.billing_plan_id || r.workspaces?.settings?.plan || '').toLowerCase().trim()
          const isOwner = r.role === 'owner' || r.role === 'admin'
          const ownerTier = isOwner && (userPlan === 'pro' || userPlan === 'team') ? userPlan : null
          const plan = ownerTier || ((rawPlan === 'team') ? 'team' : (rawPlan === 'starter' || rawPlan === 'free') ? 'starter' : (rawPlan === 'pro' || rawPlan === 'scale') ? 'pro' : (userPlan || 'starter'))
          return {
            workspaceId: r.workspace_id,
            id: r.workspace_id,
            role: r.role || 'member',
            name: r.workspaces?.name || 'My Workspace',
            plan,
            isActive: r.workspaces?.is_active ?? true
          }
        })
      }

      // Robust fallback: Query workspaces created by this user directly via created_by
      try {
        const { data: ownedWs, error: ownedWsErr } = await supabase
          .from('workspaces')
          .select('id, name, billing_plan_id, is_active, settings')
          .eq('created_by', userId)
        
        if (ownedWsErr) {
          console.warn('Direct workspaces query notice:', ownedWsErr)
        } else if (Array.isArray(ownedWs) && ownedWs.length > 0) {
          const existingIds = new Set(mapped.map(m => m.workspaceId))
          ownedWs.forEach(ow => {
            if (!existingIds.has(ow.id)) {
              const rawPlan = (ow.billing_plan_id || ow.settings?.plan || '').toLowerCase().trim()
              const ownerTier = (userPlan === 'pro' || userPlan === 'team') ? userPlan : null
              const plan = ownerTier || ((rawPlan === 'team') ? 'team' : (rawPlan === 'starter' || rawPlan === 'free') ? 'starter' : (rawPlan === 'pro' || rawPlan === 'scale') ? 'pro' : (userPlan || 'starter'))
              mapped.push({
                workspaceId: ow.id,
                id: ow.id,
                role: 'owner',
                name: ow.name || 'My Workspace',
                plan,
                isActive: ow.is_active ?? true
              })
              existingIds.add(ow.id)
            }
          })
        }
      } catch (directErr) {
        console.warn('Direct workspaces query notice:', directErr)
      }

      if (isMounted) {
        // Clean stale current_workspace_id if it's no longer in the active mapped workspaces
        try {
          const activeIds = new Set(mapped.map(m => m.workspaceId))
          const stored = localStorage.getItem('current_workspace_id')
          if (stored && !activeIds.has(stored)) {
            localStorage.removeItem('current_workspace_id')
            sessionStorage.removeItem('current_workspace_id')
          }
        } catch (_) {}

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

  const isAdmin = useMemo(() => workspaces.some(w => w.role === 'owner' || w.role === 'admin'), [workspaces])
  const ownedCount = useMemo(() => workspaces.filter(w => w.role === 'owner' || w.role === 'admin').length, [workspaces])
  const canCreateDirectly = ownedCount < maxWorkspaces

  const handleOpenCreateWorkspace = () => {
    if (ownedCount >= maxWorkspaces) {
      setShowPricingModal(true)
      return
    }
    setModalStep(1)
    const initialWf = isWorkflowUnlocked('kanban', userPlan) ? 'kanban' : 'adhoc'
    setSelectedWorkflow(initialWf)
    setShowCreateModal(true)
  }

  // Auto-open workspace creation modal if the user has 0 workspaces so they can start immediately
  useEffect(() => {
    if (!loading && workspaces.length === 0 && !isRevokedMember && !showCreateModal && !isCreating) {
      handleOpenCreateWorkspace()
    }
  }, [loading, workspaces.length, isRevokedMember, showCreateModal, isCreating])

  const handleNextStep = (e) => {
    if (e) e.preventDefault()
    if (!newName.trim()) return
    if (!isWorkflowUnlocked(selectedWorkflow, userPlan)) {
      setCreateError(`The selected workflow is not available on your plan. Starter includes Ad-hoc and Kanban workflows. Please select an unlocked workflow or upgrade your plan.`)
      return
    }
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
      const userCycle = userData?.billing_interval || 'monthly'
      const newId = await createWorkspace(userId, user.email, newName.trim(), teamSize, selectedWorkflow, saveData, userPlan, userCycle)
      navigate(`/${newId}`)
    } catch (err) {
      console.error('Failed to create workspace:', err)
      setCreateError(err?.message || 'Initialization failed: Unable to provision a new workspace. Please verify your connection.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleSelectPlan = async (planId, cycle = 'monthly') => {
    try {
      // Hardened Phase 1: Call trusted server-side plan selection endpoint
      await selectPlanServerSide(planId, cycle)
      if (userData) {
        userData.billing_plan_id = planId
        userData.billingPlanId = planId
        userData.billing_interval = cycle
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

  const handleActivateWorkspace = async (e, wsId) => {
    e.stopPropagation()
    try {
      await setActiveWorkspace(wsId)
      setWorkspaces(prev => prev.map(w => ({
        ...w,
        isActive: (w.id === wsId || w.workspaceId === wsId)
      })))
    } catch (err) {
      console.error('Failed to activate workspace:', err)
      alert(err.message || 'Unable to activate workspace. Please ensure you are an owner.')
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

  const isPickerForced = location.search.includes('picker=true') || window.location.search.includes('picker=true') || location.search.includes('create=true')
  
  // Routing logic: only auto-redirect if NOT forced by picker=true or create=true
  if (!isPickerForced && workspaces.length > 0) {
    if (!isAdmin) {
      return <Navigate to={`/${workspaces[0].workspaceId}`} replace />
    } else if (workspaces.length === 1) {
      return <Navigate to={`/${workspaces[0].workspaceId}`} replace />
    }
  }

  const isLockoutView = workspaces.length === 0 && isRevokedMember

  return (
    <div className="workspace-picker-page">
      <div className="wp-bg-elements" aria-hidden="true">
        <div className="wp-orb wp-orb-1" />
        <div className="wp-orb wp-orb-2" />
        <div className="wp-orb wp-orb-3" />
        <div className="wp-grid" />
      </div>
      
      {workspaceSeo}
      <div className="wp-container" style={isLockoutView ? { maxWidth: '540px', margin: '0 auto', padding: '60px 24px', textAlign: 'center' } : {}}>

        {!isLockoutView && (
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
        )}

        {isLockoutView ? (
          <div style={{
            background: 'var(--surface-card, #ffffff)',
            border: '1px solid var(--border, rgba(0,0,0,0.08))',
            borderRadius: '24px',
            padding: '48px 24px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.05)',
            textAlign: 'center'
          }}>
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
              Your account is not currently a member of any active workspace. You can start your own team workspace with Paper5.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-primary"
                style={{ width: '100%', maxWidth: '280px', padding: '12px 20px', fontSize: '14px', fontWeight: 700, borderRadius: '8px' }}
                onClick={handleOpenCreateWorkspace}
              >
                + Create Your Workspace
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
        ) : (
          <div className="wp-grid-list">
            {workspaces.length === 0 && (
            <div style={{
              gridColumn: '1 / -1',
              padding: '36px 24px',
              textAlign: 'center',
              background: '#ffffff',
              border: '1px dashed #d4d4d8',
              borderRadius: '16px',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🚀</div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px 0', color: '#09090b' }}>
                Create Your First Workspace
              </h3>
              <p style={{ fontSize: '13.5px', color: '#71717a', margin: '0 0 20px 0', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                You are on the <strong>{formatPlanBadge(userPlan)}</strong> plan. Configure your workspace preferences to get started.
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={handleOpenCreateWorkspace}
                style={{ padding: '12px 28px', fontSize: '14px', fontWeight: 700, borderRadius: '8px' }}
              >
                + Create Workspace
              </button>
            </div>
          )}

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span className="wp-role-badge">{ws.role || 'member'}</span>
                      <span className="wp-plan-badge">{formatPlanBadge(ws.plan || userPlan)}</span>
                      {ws.isActive === false && (
                        <span className="wp-plan-badge" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
                          INACTIVE (READ ONLY)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="wp-card-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className={isCurrent ? 'wp-enter-text--disabled' : ''}>
                    {isCurrent ? 'Current Workspace' : 'Enter Workspace \u2192'}
                  </span>
                  {ws.isActive === false && (ws.role === 'owner' || ws.role === 'admin') && (
                    <button
                      type="button"
                      onClick={(e) => handleActivateWorkspace(e, ws.workspaceId)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        borderRadius: '6px',
                        background: '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      Make Active
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {workspaces.length > 0 && (
            <button 
              type="button"
              className="wp-create-btn"
              onClick={handleOpenCreateWorkspace}
            >
              + Create New Workspace
            </button>
          )}
        </div>
        )}

        {!isLockoutView && (
          <div className="wp-footer">
            <button type="button" className="wp-logout-btn" onClick={logout}>
              Sign out securely
            </button>
          </div>
        )}

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
                  
                  <div style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12.5px'
                  }}>
                    <span style={{ color: '#047857', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> Active Plan: <strong>{userPlan === 'pro' ? 'Pro Plan' : (userPlan === 'team' ? 'Team Plan' : 'Starter Plan')}</strong>
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#065f46', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '100px' }}>
                      {userPlan === 'pro' ? 'All 8 Workflows' : (userPlan === 'team' ? '6 Workflows' : '2 Workflows (Ad-hoc, Kanban)')}
                    </span>
                  </div>
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
                        const newSize = e.target.value
                        setTeamSize(newSize)
                        const recWf = getRecommendedWorkflow(newSize)
                        const targetWf = isWorkflowUnlocked(recWf, userPlan) ? recWf : (isWorkflowUnlocked('kanban', userPlan) ? 'kanban' : 'adhoc')
                        setSelectedWorkflow(targetWf)
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
                              if (isUnlocked) {
                                setSelectedWorkflow(wf.id)
                              } else {
                                setShowCreateModal(false)
                                setShowPricingModal(true)
                              }
                            }}
                          >
                            <div className="wf-card-header">
                              <span className="wf-name">{wf.name}</span>
                              {!isUnlocked && (
                                <span className="wf-lock-badge">
                                  🔒 {wf.plans.includes('team') ? 'Team' : 'Pro'}
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
