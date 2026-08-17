import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useDeadlines } from '../lib/useDeadlines'
import { subscribeSprints } from '../lib/sprints'
import { getUrgency } from '../lib/utils'
import { hasSeenTour } from '../lib/onboarding'
import DeadlineCard from '../components/DeadlineCard'
import NotificationBell from '../components/NotificationBell'
import NavTabs from '../components/NavTabs'
import SiteTour from '../components/SiteTour'
import UserMenu from '../components/UserMenu'
import { useWorkspace } from '../lib/WorkspaceContext'
import { Link } from 'react-router-dom'
import { subscribeIntegrationConfig } from '../lib/integrations/config'
import { getWorkflowById } from '../lib/workflows'
import NewDeadlineModal from '../components/NewDeadlineModal'
import './Dashboard.css'
import './MyDashboard.css'

export default function MyDashboard() {
  const { workspaceId, workspace, workspaceRole } = useWorkspace()
  const isAdmin = workspaceRole === 'owner' || workspaceRole === 'admin'
  const { user } = useAuth()
  const { deadlines, hasMore, loadMore, loadingMore } = useDeadlines(workspaceId)
  const [sprints, setSprints] = useState([])
  const [showTour, setShowTour] = useState(false)
  const [viewMode, setViewMode] = useState('board')
  const [timeRange, setTimeRange] = useState('30D')
  const [search, setSearch] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  const [integrationConfig, setIntegrationConfig] = useState({})

  useEffect(() => {
    return subscribeSprints(workspaceId, undefined, setSprints)
  }, [workspaceId])

  useEffect(() => {
    if (!workspaceId) return
    return subscribeIntegrationConfig(workspaceId, setIntegrationConfig)
  }, [workspaceId])

  const githubRepos = useMemo(() => {
    if (!integrationConfig?.github_connected) return []
    if (Array.isArray(integrationConfig.github_repos)) return integrationConfig.github_repos
    if (typeof integrationConfig.github_repos === 'string') {
      return integrationConfig.github_repos.split(',').map(r => r.trim()).filter(Boolean)
    }
    if (integrationConfig.github_repo) return [integrationConfig.github_repo]
    return []
  }, [integrationConfig])

  useEffect(() => {
    const uid = user?.id || user?.uid
    if (!uid) return
    const forceTour = window.location.search.includes('tour=true')
    if (forceTour) {
      setShowTour(true)
      return
    }
    let cancelled = false
    hasSeenTour(uid).then(seen => {
      if (!cancelled && !seen) setShowTour(true)
    })
    return () => { cancelled = true }
  }, [user])

  const myEmail = (user?.email || '').toLowerCase()
  const activeSprint = useMemo(() => sprints.find(s => s.status === 'active'), [sprints])

  const myTasks = useMemo(
    () => deadlines.filter(d => d.assigneeEmail?.toLowerCase() === myEmail),
    [deadlines, myEmail]
  )

  const filteredMyTasks = useMemo(() => {
    return myTasks.filter(d => {
      if (search.trim() && !d.title?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [myTasks, search])

  const stats = useMemo(() => {
    const active = myTasks.filter(d => d.status !== 'done')
    const overdue = active.filter(d => getUrgency(d.dueDate, d.status) === 'overdue')
    const dueSoon = active.filter(d => ['critical', 'warn'].includes(getUrgency(d.dueDate, d.status)))
    const done = myTasks.filter(d => d.status === 'done')
    const blocked = myTasks.filter(d => d.status === 'blocked')
    return { total: myTasks.length, active: active.length, overdue: overdue.length, dueSoon: dueSoon.length, done: done.length, blocked: blocked.length }
  }, [myTasks])

  const mySprintTasks = useMemo(() => {
    if (!activeSprint) return []
    return myTasks.filter(d => d.sprintId === activeSprint.id)
  }, [activeSprint, myTasks])

  const mySprintProgress = useMemo(() => {
    if (mySprintTasks.length === 0) return 0
    const done = mySprintTasks.filter(d => d.status === 'done').length
    return Math.round((done / mySprintTasks.length) * 100)
  }, [mySprintTasks])

  const needsMyReview = useMemo(
    () => deadlines.filter(d => d.status === 'review' && d.assigneeEmail?.toLowerCase() !== myEmail),
    [deadlines, myEmail]
  )

  const sortedMyTasks = useMemo(() => {
    return [...filteredMyTasks].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
  }, [filteredMyTasks])

  // 5 Canonical Kanban Columns for My Tasks
  const kanbanColumns = useMemo(() => {
    const standardCols = [
      { id: 'not_started', title: 'To Do', colorKey: 'todo', color: '#A3A5C2' },
      { id: 'in_progress', title: 'In Progress', colorKey: 'progress', color: '#3D6FD6' },
      { id: 'review', title: 'Review / QA', colorKey: 'review', color: '#7C5CE0' },
      { id: 'blocked', title: 'Blocked', colorKey: 'blocked', color: '#D14343' },
      { id: 'done', title: 'Done', colorKey: 'done', color: '#1A9959' },
    ]

    return standardCols.map(col => {
      let items = []
      if (col.id === 'not_started') {
        items = sortedMyTasks.filter(d => d.status === 'not_started' || d.status === 'todo')
      } else if (col.id === 'in_progress') {
        items = sortedMyTasks.filter(d => d.status === 'in_progress')
      } else if (col.id === 'review') {
        items = sortedMyTasks.filter(d => d.status === 'review' || d.status === 'qa')
      } else if (col.id === 'blocked') {
        items = sortedMyTasks.filter(d => d.status === 'blocked')
      } else if (col.id === 'done') {
        items = sortedMyTasks.filter(d => d.status === 'done' || d.status === 'completed' || d.status === 'shipped')
      }
      return { ...col, items }
    })
  }, [sortedMyTasks])

  const activeWf = getWorkflowById(workspace?.settings?.agile_workflow || 'scrum')

  const userName = useMemo(() => {
    if (user?.displayName) return user.displayName.split(' ')[0]
    if (user?.email) return user.email.split('@')[0]
    return 'there'
  }, [user])

  return (
    <div className="dash-root">
      {/* ─────────────────────────────────────────────────────────────
           1. STICKY TOP NAV
      ───────────────────────────────────────────────────────────── */}
      <nav className="dash-sticky-nav">
        <div className="dash-container dash-nav-inner">
          <Link to={`/${workspaceId}`} className="dash-nav-brand">
            <div className="dash-logo-dot">
              <svg viewBox="0 0 14 14" fill="none">
                <path d="M2 7L5.5 10.5L12 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="dash-logo-name">SprintOS</span>
            <span className="dash-env-tag">{workspace?.name || 'Beta'}</span>
          </Link>

          <NavTabs />

          <div className="dash-nav-actions">
            <NotificationBell currentUser={user} />
            <UserMenu />
          </div>
        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────────────
           MAIN DASHBOARD BODY
      ───────────────────────────────────────────────────────────── */}
      <main className="dash-container">

        {/* ── HEADER ROW ── */}
        <header className="dash-page-header">
          <div className="dash-header-inner">
            <div className="dash-header-left">
              <div className="dash-eyebrow">
                <span className="dash-eyebrow-dot"></span>
                All systems normal
              </div>
              <h1 className="dash-greeting">Good morning, <span>{userName}</span> 👋</h1>
              <p className="dash-subtext">
                {activeSprint
                  ? `Sprint ${activeSprint.number || ''}${activeSprint.locked ? ' (locked)' : ''} · ${mySprintTasks.length} task${mySprintTasks.length === 1 ? '' : 's'} assigned to you (${mySprintProgress}% completed)`
                  : "Here's what's on your agenda today."}
              </p>
            </div>

            {/* Search Bar with ⌘K */}
            <div className="dash-search-bar">
              <svg className="dash-search-icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
                <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                className="dash-search-input"
                type="text"
                placeholder="Search assigned tasks…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd className="dash-search-kbd">⌘K</kbd>
            </div>
          </div>
        </header>

        {/* ── AGILE WORKFLOW BANNER (Admin Only) ── */}
        {isAdmin && activeWf && (
          <div className="dash-workflow-banner">
            <div className="dash-wf-left">
              <div className="dash-wf-icon">#{activeWf.num}</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="dash-wf-name">{activeWf.name}</span>
                  <span className="dash-wf-badge">{activeWf.badge}</span>
                </div>
                <div className="dash-wf-team">
                  Team size: {workspace?.settings?.team_size || activeWf.teamSizeLabel}
                  &ensp;·&ensp;
                  <span className="dash-wf-cols">
                    {activeWf.columns.map(c => c.title).join(' → ')}
                  </span>
                </div>
              </div>
            </div>
            <Link to={`/${workspaceId}/settings`} className="dash-wf-link">
              ⚙️ Change Workflow
            </Link>
          </div>
        )}

        {/* ── 3. STAT STRIP (Single 14px Card with Hairlines) ── */}
        <section className="dash-stat-strip">
          {/* Active Tasks */}
          <div className="dash-stat-col">
            <div className="dash-stat-label-row">
              <span className="dash-stat-dot" style={{ background: 'var(--blue)' }}></span>
              Active Tasks
            </div>
            <div className="dash-stat-value">{String(stats.active).padStart(2, '0')}</div>
            <div className="dash-stat-delta">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M5.5 2L9 7H2L5.5 2Z" fill="var(--green)"/>
              </svg>
              <span className="dash-delta-green">+{stats.active} assigned to you</span>
            </div>
          </div>

          {/* Overdue */}
          <div className="dash-stat-col">
            <div className="dash-stat-label-row">
              <span className="dash-stat-dot" style={{ background: 'var(--red)' }}></span>
              Overdue
            </div>
            <div className="dash-stat-value">{String(stats.overdue).padStart(2, '0')}</div>
            <div className="dash-stat-delta">
              {stats.overdue > 0 ? (
                <>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M5.5 9L9 4H2L5.5 9Z" fill="var(--red)"/>
                  </svg>
                  <span className="dash-delta-red">Needs attention</span>
                </>
              ) : (
                <span className="dash-delta-green">No overdue tasks 🎉</span>
              )}
            </div>
          </div>

          {/* Due Soon */}
          <div className="dash-stat-col">
            <div className="dash-stat-label-row">
              <span className="dash-stat-dot" style={{ background: 'var(--amber)' }}></span>
              Due Soon
            </div>
            <div className="dash-stat-value">{String(stats.dueSoon).padStart(2, '0')}</div>
            <div className="dash-stat-delta">
              <span className="dash-delta-amber">— within 48 hours</span>
            </div>
          </div>

          {/* Completed */}
          <div className="dash-stat-col">
            <div className="dash-stat-label-row">
              <span className="dash-stat-dot" style={{ background: 'var(--green)' }}></span>
              Completed
            </div>
            <div className="dash-stat-value">{String(stats.done).padStart(2, '0')}</div>
            <div className="dash-stat-delta">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M5.5 2L9 7H2L5.5 2Z" fill="var(--green)"/>
              </svg>
              <span className="dash-delta-green">{stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}% completion rate</span>
            </div>
          </div>
        </section>

        {/* ── 4. TWO-COLUMN ROW: VELOCITY & REPOSITORIES/MILESTONES ── */}
        <section className="dash-two-col">
          {/* Left: Sprint Velocity Bar Chart */}
          <div className="dash-surface-card dash-chart-panel">
            <div className="dash-panel-header">
              <div>
                <div className="dash-panel-title">Sprint Velocity</div>
                <div className="dash-panel-desc">Tasks completed per sprint cycle</div>
              </div>
              <div className="dash-range-pills">
                <button
                  type="button"
                  className={`dash-range-btn${timeRange === '7D' ? ' active' : ''}`}
                  onClick={() => setTimeRange('7D')}
                >
                  7D
                </button>
                <button
                  type="button"
                  className={`dash-range-btn${timeRange === '30D' ? ' active' : ''}`}
                  onClick={() => setTimeRange('30D')}
                >
                  30D
                </button>
                <button
                  type="button"
                  className={`dash-range-btn${timeRange === '90D' ? ' active' : ''}`}
                  onClick={() => setTimeRange('90D')}
                >
                  90D
                </button>
              </div>
            </div>

            <div className="dash-chart-bars">
              <div className="dash-bar-col">
                <div className="dash-bar-tube" style={{ height: '85%' }}>
                  <div className="dash-bar-slice done" style={{ height: '55%' }}></div>
                  <div style={{ height: '3px' }}></div>
                  <div className="dash-bar-slice prog" style={{ height: '30%' }}></div>
                </div>
                <div className="dash-bar-tag">W1</div>
              </div>

              <div className="dash-bar-col">
                <div className="dash-bar-tube" style={{ height: '65%' }}>
                  <div className="dash-bar-slice done" style={{ height: '45%' }}></div>
                  <div style={{ height: '3px' }}></div>
                  <div className="dash-bar-slice prog" style={{ height: '35%' }}></div>
                </div>
                <div className="dash-bar-tag">W2</div>
              </div>

              <div className="dash-bar-col">
                <div className="dash-bar-tube" style={{ height: '90%' }}>
                  <div className="dash-bar-slice done" style={{ height: '65%' }}></div>
                  <div style={{ height: '3px' }}></div>
                  <div className="dash-bar-slice prog" style={{ height: '25%' }}></div>
                </div>
                <div className="dash-bar-tag">W3</div>
              </div>

              <div className="dash-bar-col">
                <div className="dash-bar-tube" style={{ height: '72%' }}>
                  <div className="dash-bar-slice done" style={{ height: '50%' }}></div>
                  <div style={{ height: '3px' }}></div>
                  <div className="dash-bar-slice prog" style={{ height: '28%' }}></div>
                </div>
                <div className="dash-bar-tag">W4</div>
              </div>

              <div className="dash-bar-col">
                <div className="dash-bar-tube" style={{ height: '100%' }}>
                  <div className="dash-bar-slice done" style={{ height: '70%' }}></div>
                  <div style={{ height: '3px' }}></div>
                  <div className="dash-bar-slice prog" style={{ height: '20%' }}></div>
                </div>
                <div className="dash-bar-tag">W5</div>
              </div>

              <div className="dash-bar-col">
                <div className="dash-bar-tube" style={{ height: '58%' }}>
                  <div className="dash-bar-slice done" style={{ height: '38%' }}></div>
                  <div style={{ height: '3px' }}></div>
                  <div className="dash-bar-slice prog" style={{ height: '40%' }}></div>
                </div>
                <div className="dash-bar-tag">W6</div>
              </div>

              <div className="dash-bar-col">
                <div className="dash-bar-tube" style={{ height: `${Math.max(35, Math.min(100, (stats.done + stats.active) * 12))}%` }}>
                  <div className="dash-bar-slice done" style={{ height: `${stats.total > 0 ? (stats.done / stats.total) * 100 : 50}%` }}></div>
                  <div style={{ height: '3px' }}></div>
                  <div className="dash-bar-slice prog" style={{ height: `${stats.total > 0 ? (stats.active / stats.total) * 100 : 50}%`, opacity: 0.7 }}></div>
                </div>
                <div className="dash-bar-tag" style={{ color: 'var(--accent)', fontWeight: 700 }}>Now</div>
              </div>
            </div>

            <div className="dash-chart-foot">
              <div className="dash-legend-item">
                <span className="dash-legend-dot" style={{ background: 'var(--accent)' }}></span>
                Completed ({stats.done})
              </div>
              <div className="dash-legend-item">
                <span className="dash-legend-dot" style={{ background: 'var(--blue)' }}></span>
                In Progress ({stats.active})
              </div>
              <div className="dash-legend-item">
                <span className="dash-legend-dot" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}></span>
                Total Scope ({stats.total})
              </div>
            </div>
          </div>

          {/* Right: Connected Repositories / Milestone Card */}
          <div className="dash-surface-card dash-milestone-panel">
            <div className="dash-milestone-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="16" rx="3" stroke="var(--accent)" strokeWidth="1.7"/>
                <path d="M8 9h8M8 13h5" stroke="var(--accent)" strokeWidth="1.7" strokeLinecap="round"/>
                <circle cx="19" cy="19" r="4" fill="var(--accent)"/>
                <path d="M19 17v2l1 1" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="dash-milestone-title">
              {githubRepos.length > 0 ? `${githubRepos.length} Connected Repositories` : 'No GitHub repo connected'}
            </div>
            <div className="dash-milestone-desc">
              {githubRepos.length > 0 ? (
                <span>Linked: {githubRepos.slice(0, 2).map(r => r.replace(/^https?:\/\/github\.com\//, '')).join(', ')}</span>
              ) : (
                'Connect your GitHub repository in Integrations to track pull requests, branches, and code deployments directly inside SprintOS.'
              )}
            </div>
            {isAdmin ? (
              <Link to={`/${workspaceId}/integrations`} className="dash-btn-accent" style={{ textDecoration: 'none' }}>
                {githubRepos.length > 0 ? 'Manage Integrations' : '+ Connect GitHub'}
              </Link>
            ) : (
              <button type="button" className="dash-btn-accent" onClick={() => setShowNewModal(true)}>
                + Create Task
              </button>
            )}
          </div>
        </section>

        {/* ── 5. ATTENTION CALLOUTS (Blocked / Review) ── */}
        {(stats.blocked > 0 || needsMyReview.length > 0) && (
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            {stats.blocked > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderLeft: '4px solid var(--red)', borderRadius: '12px', padding: '16px 20px', boxShadow: 'var(--card-shadow)' }}>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
                  ⚠️ You have {stats.blocked} blocked task{stats.blocked === 1 ? '' : 's'}
                </div>
                <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--muted)' }}>
                  Clear the blocker once resolved to maintain your team's velocity.
                </p>
              </div>
            )}
            {needsMyReview.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderLeft: '4px solid var(--violet)', borderRadius: '12px', padding: '16px 20px', boxShadow: 'var(--card-shadow)' }}>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
                  📋 {needsMyReview.length} task{needsMyReview.length === 1 ? '' : 's'} waiting on your review
                </div>
                <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--muted)' }}>
                  {needsMyReview.map(d => d.title).slice(0, 3).join(' · ')}{needsMyReview.length > 3 ? '…' : ''}
                </p>
              </div>
            )}
          </section>
        )}

        {/* ── 6. MY ASSIGNED TASKS SECTION WITH CONTROLS ── */}
        <section className="dash-controls-bar">
          <div className="dash-controls-left">
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>My Assigned Tasks</h2>
            <div className="dash-view-toggle" style={{ marginLeft: '12px' }}>
              <button
                type="button"
                className={`dash-view-btn${viewMode === 'board' ? ' active' : ''}`}
                onClick={() => setViewMode('board')}
              >
                Kanban Board
              </button>
              <button
                type="button"
                className={`dash-view-btn${viewMode === 'list' ? ' active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                List View
              </button>
            </div>
          </div>

          <div className="dash-controls-right">
            <button
              type="button"
              className="dash-btn-accent"
              style={{ padding: '8px 16px', fontSize: '12.5px' }}
              onClick={() => setShowNewModal(true)}
            >
              + Add task
            </button>
          </div>
        </section>

        {/* ── 7. KANBAN BOARD / LIST VIEW ── */}
        {viewMode === 'board' ? (
          <div className="dash-kanban-grid" style={{ marginBottom: '36px' }}>
            {kanbanColumns.map(col => (
              <div key={col.id} className="dash-kanban-col">
                <div className={`dash-col-top-bar ${col.colorKey}`} style={{ background: col.color }} />

                <div className="dash-col-header">
                  <div className="dash-col-title-row">
                    <div className="dash-col-title-left">
                      <span className={`dash-col-dot ${col.colorKey}`} style={{ background: col.color }} />
                      <span className="dash-col-name">{col.title}</span>
                    </div>
                    <span className="dash-col-count">{col.items.length}</span>
                  </div>

                  <div className="dash-col-prog-track">
                    <div
                      className={`dash-col-prog-fill ${col.colorKey}`}
                      style={{
                        background: col.color,
                        width: `${stats.total > 0 ? Math.min(100, Math.round((col.items.length / stats.total) * 100)) : 0}%`
                      }}
                    />
                  </div>
                </div>

                <div className="dash-col-body">
                  {col.items.length === 0 ? (
                    <div className="dash-col-empty">
                      <div className="dash-col-empty-icon">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <rect x="2" y="2" width="12" height="12" rx="3" stroke="var(--muted-2)" strokeWidth="1.4"/>
                          <path d="M5.5 8h5M8 5.5v5" stroke="var(--muted-2)" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div className="dash-col-empty-text">No tasks in {col.title}</div>
                      <button
                        type="button"
                        className="dash-col-add-btn"
                        onClick={() => setShowNewModal(true)}
                      >
                        + Add task
                      </button>
                    </div>
                  ) : (
                    col.items.map(d => (
                      <DeadlineCard
                        key={d.id}
                        deadline={d}
                        currentUser={user}
                        teamId={d.workspaceId || 'default-team'}
                        sprintLocked={!!(d.sprintId && activeSprint?.id === d.sprintId && activeSprint?.locked)}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <section className="dash-list-view" style={{ marginBottom: '36px' }}>
            {sortedMyTasks.length === 0 ? (
              <div className="dash-empty-list">No tasks assigned to you yet.</div>
            ) : (
              sortedMyTasks.map(d => (
                <DeadlineCard
                  key={d.id}
                  deadline={d}
                  currentUser={user}
                  teamId={d.workspaceId || 'default-team'}
                  sprintLocked={!!(d.sprintId && activeSprint?.id === d.sprintId && activeSprint?.locked)}
                />
              ))
            )}
          </section>
        )}

        {hasMore && (
          <div className="dash-load-more" style={{ marginBottom: '36px' }}>
            <button
              className="btn-ghost btn-sm"
              onClick={loadMore}
              disabled={loadingMore}
              style={{ borderRadius: '8px', border: '1px solid var(--border-soft)' }}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}

        {/* Waiting on Review section */}
        {needsMyReview.length > 0 && (
          <section style={{ marginTop: '24px', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', marginBottom: '14px' }}>
              Waiting On Your Review ({needsMyReview.length})
            </h2>
            <div className="dash-list-view">
              {needsMyReview.map(d => (
                <DeadlineCard
                  key={d.id}
                  deadline={d}
                  currentUser={user}
                  teamId={d.workspaceId || 'default-team'}
                  sprintLocked={!!(d.sprintId && sprints.find(s => s.id === d.sprintId)?.locked)}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* New Deadline / Task Modal */}
      {showNewModal && (
        <NewDeadlineModal
          teamId={workspaceId || 'default-team'}
          members={[]}
          currentUser={user}
          activeSprint={activeSprint}
          onClose={() => setShowNewModal(false)}
        />
      )}

      {/* Tour Modal */}
      {showTour && (
        <SiteTour currentUser={user} onFinish={() => setShowTour(false)} />
      )}
    </div>
  )
}
