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
  const [timeRange, setTimeRange] = useState('7D')
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

  const sortedMyTasks = useMemo(() => {
    return [...filteredMyTasks].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
  }, [filteredMyTasks])

  // 5 Canonical Kanban Columns matching the user's screenshot
  const kanbanColumns = useMemo(() => {
    const standardCols = [
      { id: 'not_started', title: 'To Do', dotColor: '#1C1D2B', emptyText: 'Nothing queued', showAdd: true },
      { id: 'in_progress', title: 'In Progress', dotColor: '#3D6FD6', emptyText: 'Nothing in flight', showAdd: false },
      { id: 'review', title: 'Review / QA', dotColor: '#C4791A', emptyText: 'Nothing to review', showAdd: false },
      { id: 'blocked', title: 'Blocked', dotColor: '#D14343', emptyText: 'No blockers 🎉', showAdd: false },
      { id: 'done', title: 'Done', dotColor: '#4F46E5', emptyText: 'Ship your first task', showAdd: false },
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

  // User First Name
  const userFirstName = useMemo(() => {
    if (user?.displayName) return user.displayName.split(' ')[0]
    if (user?.email) {
      const prefix = user.email.split('@')[0]
      return prefix.charAt(0).toUpperCase() + prefix.slice(1)
    }
    return 'there'
  }, [user])

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="dash-root">
      {/* ─────────────────────────────────────────────────────────────
           1. STICKY TOP NAV
      ───────────────────────────────────────────────────────────── */}
      <nav className="dash-sticky-nav">
        <div className="dash-container dash-nav-inner">
          {/* Logo Mark + Glow + Env Tag */}
          <Link to={`/${workspaceId}`} className="dash-nav-brand">
            <div className="dash-logo-dot">
              <svg viewBox="0 0 14 14" fill="none">
                <path d="M2 7L5.5 10.5L12 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="dash-logo-name">SprintOS</span>
            <span className="dash-env-tag">{(workspace?.name || 'TEST').toUpperCase()}</span>
          </Link>

          {/* NavTabs Pills */}
          <NavTabs />

          {/* Right Actions */}
          <div className="dash-nav-actions">
            <NotificationBell currentUser={user} />
            <UserMenu />
          </div>
        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────────────
           MAIN DASHBOARD BODY
      ───────────────────────────────────────────────────────────── */}
      <main className="dash-container" style={{ paddingBottom: '48px' }}>

        {/* ── HEADER ROW ── */}
        <header className="dash-page-header">
          <div className="dash-header-inner">
            <div className="dash-header-left">
              <div className="dash-eyebrow">
                <span className="dash-eyebrow-dot"></span>
                ALL SYSTEMS NORMAL
              </div>
              <h1 className="dash-greeting">Welcome back, <span>{userFirstName}</span></h1>
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
                placeholder="Search tasks, repos, people..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd className="dash-search-kbd">⌘K</kbd>
            </div>
          </div>
        </header>

        {/* ── 3. STAT STRIP (Exact 4 Columns with Hairlines) ── */}
        <section className="dash-stat-strip">
          {/* ACTIVE */}
          <div className="dash-stat-col">
            <div className="dash-stat-label-row" style={{ justifyContent: 'space-between' }}>
              <span>ACTIVE</span>
              <span className="dash-stat-dot" style={{ background: '#3D6FD6' }}></span>
            </div>
            <div className="dash-stat-value">{stats.active}</div>
            <div className="dash-stat-delta">
              <span>— no change this week</span>
            </div>
          </div>

          {/* OVERDUE */}
          <div className="dash-stat-col">
            <div className="dash-stat-label-row" style={{ justifyContent: 'space-between' }}>
              <span>OVERDUE</span>
              <span className="dash-stat-dot" style={{ background: '#D14343' }}></span>
            </div>
            <div className="dash-stat-value">{stats.overdue}</div>
            <div className="dash-stat-delta">
              <span style={{ color: stats.overdue === 0 ? '#3D6FD6' : '#D14343' }}>
                {stats.overdue === 0 ? '✓ clear' : 'Needs attention'}
              </span>
            </div>
          </div>

          {/* DUE SOON */}
          <div className="dash-stat-col">
            <div className="dash-stat-label-row" style={{ justifyContent: 'space-between' }}>
              <span>DUE SOON</span>
              <span className="dash-stat-dot" style={{ background: '#C4791A' }}></span>
            </div>
            <div className="dash-stat-value">{stats.dueSoon}</div>
            <div className="dash-stat-delta">
              <span>next 48h</span>
            </div>
          </div>

          {/* COMPLETED */}
          <div className="dash-stat-col">
            <div className="dash-stat-label-row" style={{ justifyContent: 'space-between' }}>
              <span>COMPLETED</span>
              <span className="dash-stat-dot" style={{ background: '#4F46E5' }}></span>
            </div>
            <div className="dash-stat-value">{stats.done}</div>
            <div className="dash-stat-delta">
              <span>this sprint</span>
            </div>
          </div>
        </section>

        {/* ── 4. TWO-COLUMN ROW: VELOCITY & REPOSITORIES ── */}
        <section className="dash-two-col">
          {/* Left: Task Velocity Card */}
          <div className="dash-surface-card dash-chart-panel">
            <div className="dash-panel-header">
              <div>
                <div className="dash-panel-title">Task velocity</div>
                <div className="dash-panel-desc">completed / assigned per day</div>
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

            {/* Velocity Canvas matching screenshot */}
            <div style={{ height: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', borderBottom: '2px solid #4F46E5', paddingBottom: '8px' }}>
                {daysOfWeek.map((day, idx) => (
                  <div key={day} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{
                      height: idx === 6 ? '12px' : '0px',
                      background: 'var(--accent, #4F46E5)',
                      borderRadius: '3px 3px 0 0',
                      marginBottom: '4px',
                      opacity: idx === 6 ? 0.7 : 0
                    }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', padding: '0 4px' }}>
                {daysOfWeek.map(day => (
                  <span key={day} style={{ fontSize: '11px', color: 'var(--muted-2, #A3A5C2)', fontFamily: 'var(--font-mono)' }}>
                    {day}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Repositories Card */}
          <div className="dash-surface-card dash-milestone-panel">
            <div style={{ alignSelf: 'flex-start', textAlign: 'left', width: '100%', marginBottom: '14px' }}>
              <div className="dash-panel-title">Repositories</div>
              <div className="dash-panel-desc">github sync</div>
            </div>

            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'var(--surface-2, #EEF0F9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '6px auto 14px',
              border: '1px solid var(--border-soft)'
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--muted)' }}>
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/>
              </svg>
            </div>

            <div className="dash-milestone-desc" style={{ fontSize: '12.5px', marginBottom: '18px', maxWidth: '280px' }}>
              {githubRepos.length > 0
                ? `${githubRepos.length} repo(s) connected: ${githubRepos.join(', ')}`
                : 'No repositories connected yet. Link GitHub to see commits and PRs against your tasks.'}
            </div>

            {isAdmin ? (
              <Link to={`/${workspaceId}/integrations`} className="dash-btn-accent" style={{ textDecoration: 'none', padding: '9px 24px', borderRadius: '10px' }}>
                {githubRepos.length > 0 ? 'Manage GitHub' : 'Connect GitHub'}
              </Link>
            ) : (
              <button type="button" className="dash-btn-accent" style={{ padding: '9px 24px', borderRadius: '10px' }} onClick={() => setShowNewModal(true)}>
                + Create Task
              </button>
            )}
          </div>
        </section>

        {/* ── 5. MY ASSIGNED TASKS HEADER & VIEW SWITCHER ── */}
        <section style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>My Assigned Tasks</h2>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', color: 'var(--muted-2, #A3A5C2)' }}>
              {myTasks.length} total
            </span>
          </div>

          {/* View toggle pill */}
          <div className="dash-view-toggle">
            <button
              type="button"
              className={`dash-view-btn${viewMode === 'board' ? ' active' : ''}`}
              onClick={() => setViewMode('board')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>☷</span> Kanban
            </button>
            <button
              type="button"
              className={`dash-view-btn${viewMode === 'list' ? ' active' : ''}`}
              onClick={() => setViewMode('list')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>☰</span> List
            </button>
          </div>
        </section>

        {/* ── 6. 5 KANBAN COLUMNS MATCHING SCREENSHOT ── */}
        {viewMode === 'board' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '14px',
            alignItems: 'start'
          }}>
            {kanbanColumns.map(col => (
              <div key={col.id} className="dash-surface-card" style={{ overflow: 'hidden' }}>
                {/* Header */}
                <div style={{
                  padding: '16px 18px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--border-soft)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.dotColor, flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{col.title}</span>
                  </div>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    fontWeight: 600,
                    background: 'var(--surface-2)',
                    color: 'var(--muted)',
                    padding: '2px 8px',
                    borderRadius: '100px',
                    border: '1px solid var(--border-soft)'
                  }}>
                    {col.items.length}
                  </span>
                </div>

                {/* Body with clean empty state */}
                <div style={{
                  padding: '28px 14px',
                  minHeight: '160px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center'
                }}>
                  {col.items.length === 0 ? (
                    <div>
                      <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500, marginBottom: col.showAdd ? '10px' : '0' }}>
                        {col.emptyText}
                      </div>
                      {col.showAdd && (
                        <button
                          type="button"
                          onClick={() => setShowNewModal(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent, #4F46E5)',
                            fontSize: '12.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            padding: '4px 8px'
                          }}
                        >
                          + Add task
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {col.items.map(d => (
                        <DeadlineCard
                          key={d.id}
                          deadline={d}
                          currentUser={user}
                          teamId={d.workspaceId || 'default-team'}
                          sprintLocked={!!(d.sprintId && activeSprint?.id === d.sprintId && activeSprint?.locked)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <section className="dash-list-view">
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
          <div className="dash-load-more" style={{ marginTop: '24px' }}>
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
