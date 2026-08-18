import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useWorkspace } from '../lib/WorkspaceContext'
import { useDeadlines } from '../lib/useDeadlines'
import { subscribeSprints, lockSprint } from '../lib/sprints'
import { getWorkflowById } from '../lib/workflows'
import { supabase } from '../lib/supabase'

import NavTabs from '../components/NavTabs'
import UserMenu from '../components/UserMenu'
import NotificationBell from '../components/NotificationBell'
import DeadlineCard from '../components/DeadlineCard'
import NewDeadlineModal from '../components/NewDeadlineModal'
import AlertModal from '../components/ui/AlertModal'

import { ShieldCheck, Plus, Lock, Unlock, Layers, AlertTriangle, CheckCircle, Kanban, Sliders, ArrowRight } from 'lucide-react'
import './Dashboard.css'

// Roles authorized to maintain board columns and add/modify workflow items
const AUTHORIZED_ROLES = [
  'owner',
  'admin',
  'scrum_master',
  'product_owner',
  'lead_engineer',
  'project_manager'
]

export default function WorkflowPage() {
  const { workspaceId, workspace, workspaceRole } = useWorkspace()
  const { user } = useAuth()
  const navigate = useNavigate()

  const { deadlines, hasMore, loadMore, loadingMore } = useDeadlines(workspaceId, undefined)
  const [members, setMembers] = useState([])
  const [sprints, setSprints] = useState([])
  const [showNewModal, setShowNewModal] = useState(false)
  const [alertMessage, setAlertMessage] = useState(null)
  
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const isAuthorized = useMemo(() => {
    if (!workspaceRole) return false
    return AUTHORIZED_ROLES.includes(workspaceRole.toLowerCase())
  }, [workspaceRole])

  // Fetch team roster
  useEffect(() => {
    if (!workspaceId) return
    const fetchMembers = async () => {
      const { data } = await supabase.from('workspace_members').select('user_id, role, users(id, full_name, email)').eq('workspace_id', workspaceId)
      if (data) {
        setMembers(data.map(m => ({
          id: m.user_id,
          name: m.users?.full_name || m.users?.email || 'Member',
          role: m.role
        })))
      }
    }
    fetchMembers()
  }, [workspaceId])

  // Subscribe to sprints
  useEffect(() => {
    if (!workspaceId) return
    return subscribeSprints(workspaceId, undefined, setSprints)
  }, [workspaceId])

  const activeSprint = useMemo(() => sprints.find(s => !s.completed), [sprints])
  const activeWorkflow = useMemo(() => {
    const wfId = workspace?.settings?.agile_workflow || 'scrum'
    return getWorkflowById(wfId) || getWorkflowById('scrum')
  }, [workspace?.settings?.agile_workflow])

  const filtered = useMemo(() => {
    return deadlines.filter(d => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false
      if (search.trim() && !d.title.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [deadlines, statusFilter, search])

  const kanbanColumns = useMemo(() => {
    if (!activeWorkflow || !activeWorkflow.columns) return []

    const totalCols = activeWorkflow.columns.length
    const colors = ['#64748b', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#10b981']

    return activeWorkflow.columns.map((col, idx) => {
      let colItems = []
      if (idx === 0) {
        colItems = filtered.filter(d => d.status === 'not_started' || d.status === 'todo' || d.status === col.id)
      } else if (idx === totalCols - 1) {
        colItems = filtered.filter(d => d.status === 'done' || d.status === 'completed' || d.status === 'shipped' || d.status === col.id)
      } else if (col.id.includes('review') || col.id.includes('qa') || col.id.includes('testing') || col.id.includes('accept') || col.id.includes('chapter')) {
        colItems = filtered.filter(d => d.status === 'review' || d.status === col.id)
      } else {
        colItems = filtered.filter(d => d.status === 'in_progress' || d.status === col.id)
      }

      // Check WIP limit if present in title e.g. "In Progress (WIP: 3)"
      const wipMatch = col.title.match(/WIP:\s*(\d+)/i)
      const wipLimit = wipMatch ? parseInt(wipMatch[1], 10) : null
      const isExceeded = wipLimit ? colItems.length > wipLimit : false

      return {
        id: col.id,
        title: col.title,
        color: colors[idx % colors.length],
        wipLimit,
        isExceeded,
        items: colItems
      }
    })
  }, [activeWorkflow, filtered])

  const handleToggleSprintLock = async () => {
    if (!activeSprint) return
    try {
      if (activeSprint.locked) {
        await lockSprint(workspaceId, activeSprint.id, false)
        setAlertMessage(`Sprint ${activeSprint.number} unlocked for items scope modifications.`)
      } else {
        await lockSprint(workspaceId, activeSprint.id, true)
        setAlertMessage(`Sprint ${activeSprint.number} scope locked to prevent unplanned work.`)
      }
    } catch (err) {
      setAlertMessage('Failed to update sprint lock status.')
    }
  }

  // Access Restricted View for non-authorized users
  if (!isAuthorized) {
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
              <NotificationBell currentUser={user} />
              <UserMenu />
            </div>
          </div>
        </nav>

        <main className="dash-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: '32px' }}>
          <div className="dash-surface-card" style={{
            padding: '40px',
            maxWidth: '520px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'rgba(209, 67, 67, 0.1)',
              color: '#D14343',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto'
            }}>
              <ShieldCheck size={32} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 10px 0', color: 'var(--text)' }}>
              Dedicated Workflow Maintenance Gated
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 24px 0' }}>
              Maintaining board columns, editing WIP limits, and modifying workflow list items is reserved for workspace Admins and designated Workflow Leaders.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="dash-btn-accent" onClick={() => navigate(`/${workspaceId}`)}>
                Return to My Tasks
              </button>
            </div>
          </div>
        </main>
      </div>
    )
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
            <NotificationBell currentUser={user} />
            <UserMenu />
          </div>
        </div>
      </nav>

      <main className="dash-container" style={{ paddingBottom: '48px' }}>
        {/* Dedicated Workflow Header Banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.02) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '12px',
          padding: '18px 24px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ background: '#10b981', color: '#fff', fontSize: '12px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px' }}>
                Tier #{activeWorkflow.num}
              </span>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {activeWorkflow.name} Workflow Maintenance Center
              </h1>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {activeWorkflow.description}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link 
              to={`/${workspaceId}/settings`} 
              className="btn-ghost btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
            >
              <Sliders size={14} /> Configure Workflow
            </Link>
            
            {activeSprint && (
              <button 
                onClick={handleToggleSprintLock} 
                className="btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: activeSprint.locked ? '#ef4444' : '#10b981' }}
              >
                {activeSprint.locked ? <Lock size={14} /> : <Unlock size={14} />}
                {activeSprint.locked ? `Unlock Sprint ${activeSprint.number}` : `Lock Sprint ${activeSprint.number}`}
              </button>
            )}
          </div>
        </div>

        {/* Maintenance Controls Bar */}
        <section className="dash-controls-bar">
          <div className="dash-controls-left">
            <div className="dash-search-bar" style={{ minWidth: '220px', padding: '6px 12px' }}>
              <svg className="dash-search-icon" width="14" height="14" viewBox="0 0 15 15" fill="none">
                <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                className="dash-search-input"
                placeholder="Filter list items…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="dash-filter-select"
            >
              <option value="all">All Column Stages</option>
              <option value="not_started">To Do / Backlog</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review / QA</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done / Shipped</option>
            </select>
          </div>

          <div className="dash-controls-right">
            <button
              type="button"
              className="dash-btn-accent"
              onClick={() => setShowNewModal(true)}
              style={{
                padding: '8px 16px',
                fontSize: '12.5px',
                borderRadius: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={15} /> New Task
            </button>
          </div>
        </section>

        {/* Dedicated Dynamic Workflow Board */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '18px',
          alignItems: 'flex-start',
          overflowX: 'auto'
        }}>
          {kanbanColumns.map(col => (
            <div key={col.id} style={{
              background: 'var(--bg-layer-1)',
              borderRadius: '12px',
              border: col.isExceeded ? '1px solid #ef4444' : '1px solid var(--border-hair)',
              padding: '16px',
              minWidth: '260px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px',
                paddingBottom: '10px',
                borderBottom: '1px solid var(--border-subtle)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: col.color }} />
                  {col.title}
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {col.isExceeded && (
                    <span title="WIP Limit Exceeded!" style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700 }}>
                      ⚠️ WIP Exceeded
                    </span>
                  )}
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    background: col.isExceeded ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-panel)',
                    color: col.isExceeded ? '#ef4444' : 'var(--text-secondary)',
                    padding: '2px 10px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-hair)'
                  }}>
                    {col.items.length}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '140px' }}>
                {col.items.length === 0 ? (
                  <div style={{
                    padding: '24px 12px',
                    textAlign: 'center',
                    fontSize: '12px',
                    color: 'var(--text-tertiary)',
                    border: '1px dashed var(--border-subtle)',
                    borderRadius: '8px',
                    background: 'var(--bg-inset)'
                  }}>
                    No items in {col.title}
                  </div>
                ) : (
                  col.items.map(d => (
                    <DeadlineCard
                      key={d.id}
                      deadline={d}
                      currentUser={user}
                      teamId={workspaceId}
                      sprintLocked={!!(d.sprintId && sprints.find(s => s.id === d.sprintId)?.locked)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      {showNewModal && (
        <NewDeadlineModal
          teamId={workspaceId}
          members={members}
          currentUser={user}
          activeSprint={activeSprint}
          title="New workflow item"
          submitText="Create item"
          onClose={() => setShowNewModal(false)}
        />
      )}

      <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />
    </div>
  )
}
