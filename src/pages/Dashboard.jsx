import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { subscribeMembers } from '../lib/deadlines'
import { useDeadlines } from '../lib/useDeadlines'
import { subscribeSprints } from '../lib/sprints'
import { getUrgency } from '../lib/utils'
import { downloadMonthlyReport } from '../lib/report'
import DeadlineCard from '../components/DeadlineCard'
import NewDeadlineModal from '../components/NewDeadlineModal'
import WorkloadPanel from '../components/WorkloadPanel'
import NotificationBell from '../components/NotificationBell'
import NavTabs from '../components/NavTabs'
import UserMenu from '../components/UserMenu'
import { useWorkspace } from '../lib/WorkspaceContext'
import { Link } from 'react-router-dom'
import { getWorkflowById } from '../lib/workflows'
import './Dashboard.css'

const TEAM_ID = 'default-team'

export default function Dashboard() {
  const { workspaceId, workspace, workspaceRole } = useWorkspace()
  const { user } = useAuth()
  const { deadlines, hasMore, loadMore, loadingMore } = useDeadlines(workspaceId, undefined)
  const [members, setMembers] = useState([])
  const [sprints, setSprints] = useState([])
  const [showNewModal, setShowNewModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('board')
  const [timeRange, setTimeRange] = useState('30D')
  const [generatingReport, setGeneratingReport] = useState(false)
  
  const now = new Date()
  const [reportMonth, setReportMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )

  async function handleDownloadReport() {
    const [y, m] = reportMonth.split('-').map(Number)
    setGeneratingReport(true)
    try {
      await downloadMonthlyReport(deadlines, members, { year: y, month: m - 1 })
    } finally {
      setGeneratingReport(false)
    }
  }

  useEffect(() => {
    const unsub2 = subscribeMembers(workspaceId, undefined, setMembers)
    const unsub3 = subscribeSprints(workspaceId, undefined, setSprints)
    return () => { unsub2(); unsub3() }
  }, [workspaceId])

  const activeSprint = useMemo(() => sprints.find(s => s.status === 'active'), [sprints])

  const stats = useMemo(() => {
    const active = deadlines.filter(d => d.status !== 'done')
    const overdue = active.filter(d => getUrgency(d.dueDate, d.status) === 'overdue')
    const dueSoon = active.filter(d => ['critical', 'warn'].includes(getUrgency(d.dueDate, d.status)))
    const done = deadlines.filter(d => d.status === 'done')
    return { total: deadlines.length, active: active.length, overdue: overdue.length, dueSoon: dueSoon.length, done: done.length }
  }, [deadlines])

  const filtered = useMemo(() => {
    return deadlines.filter(d => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false
      if (assigneeFilter !== 'all' && d.assigneeId !== assigneeFilter) return false
      if (search.trim() && !d.title?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [deadlines, statusFilter, assigneeFilter, search])

  const activeWorkflow = useMemo(() => {
    const wfId = workspace?.settings?.agile_workflow || 'scrum'
    return getWorkflowById(wfId) || getWorkflowById('scrum')
  }, [workspace?.settings?.agile_workflow])

  // 5 Canonical Kanban Columns with design tokens
  const kanbanColumns = useMemo(() => {
    const standardCols = [
      { id: 'not_started', title: 'To Do', colorKey: 'todo', color: '#A3A5C2', fillPct: stats.total ? Math.round((stats.active / stats.total) * 100) : 0 },
      { id: 'in_progress', title: 'In Progress', colorKey: 'progress', color: '#3D6FD6', fillPct: stats.total ? Math.round((stats.active / stats.total) * 100) : 0 },
      { id: 'review', title: 'Review / QA', colorKey: 'review', color: '#7C5CE0', fillPct: stats.total ? Math.round((stats.dueSoon / stats.total) * 100) : 0 },
      { id: 'blocked', title: 'Blocked', colorKey: 'blocked', color: '#D14343', fillPct: stats.total ? Math.round((stats.overdue / stats.total) * 100) : 0 },
      { id: 'done', title: 'Done', colorKey: 'done', color: '#1A9959', fillPct: stats.total ? Math.round((stats.done / stats.total) * 100) : 0 },
    ]

    return standardCols.map(col => {
      let items = []
      if (col.id === 'not_started') {
        items = filtered.filter(d => d.status === 'not_started' || d.status === 'todo')
      } else if (col.id === 'in_progress') {
        items = filtered.filter(d => d.status === 'in_progress')
      } else if (col.id === 'review') {
        items = filtered.filter(d => d.status === 'review' || d.status === 'qa')
      } else if (col.id === 'blocked') {
        items = filtered.filter(d => d.status === 'blocked')
      } else if (col.id === 'done') {
        items = filtered.filter(d => d.status === 'done' || d.status === 'completed' || d.status === 'shipped')
      }
      return { ...col, items }
    })
  }, [filtered, stats])

  const isAdmin = workspaceRole === 'owner' || workspaceRole === 'admin'
  const activeWf = getWorkflowById(workspace?.settings?.agile_workflow || 'scrum')

  // User Greeting
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
          {/* Logo Mark + Glow + Env Tag */}
          <Link to={`/${workspaceId}`} className="dash-nav-brand">
            <div className="dash-logo-dot">
              <svg viewBox="0 0 14 14" fill="none">
                <path d="M2 7L5.5 10.5L12 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="dash-logo-name">SprintOS</span>
            <span className="dash-env-tag">{workspace?.name || 'Beta'}</span>
          </Link>

          {/* Primary Nav Links */}
          <NavTabs />

          {/* Right-side Actions */}
          <div className="dash-nav-actions">
            <NotificationBell currentUser={user} />
            <UserMenu />
          </div>
        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────────────
           MAIN DASHBOARD CONTENT
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
              <p className="dash-subtext">Here's what's happening across your workspace today.</p>
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
                placeholder="Search anything…"
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
          {/* Active */}
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
              <span className="dash-delta-green">+{stats.active} in sprint</span>
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
                  <span className="dash-delta-red">Needs immediate review</span>
                </>
              ) : (
                <span className="dash-delta-green">No overdue items 🎉</span>
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

        {/* ── 4. TWO-COLUMN ROW: VELOCITY & MILESTONE ── */}
        <section className="dash-two-col">
          {/* Left: Sprint Velocity Bar Chart Panel */}
          <div className="dash-surface-card dash-chart-panel">
            <div className="dash-panel-header">
              <div>
                <div className="dash-panel-title">Sprint Velocity</div>
                <div className="dash-panel-desc">
                  {activeSprint ? `Active: ${activeSprint.name || 'Sprint'}` : 'Tasks completed per sprint cycle'}
                </div>
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
              {/* Velocity Bars */}
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

              {/* Current Cycle */}
              <div className="dash-bar-col">
                <div className="dash-bar-tube" style={{ height: `${Math.max(30, Math.min(100, (stats.done + stats.active) * 8))}%` }}>
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

          {/* Right: Milestone / Upcoming Deadlines Empty State Card */}
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
              {stats.dueSoon > 0 ? `${stats.dueSoon} deadlines due soon` : 'No urgent blockers'}
            </div>
            <div className="dash-milestone-desc">
              {stats.dueSoon > 0
                ? 'Keep your sprint on track by prioritizing work items approaching their deadline.'
                : "You're all caught up! Create a new deadline to start tracking important dates and keep your team aligned."}
            </div>
            <button
              type="button"
              className="dash-btn-accent"
              onClick={() => setShowNewModal(true)}
            >
              + Create Milestone
            </button>
          </div>
        </section>

        {/* ── 5. CONTROLS BAR ── */}
        <section className="dash-controls-bar">
          <div className="dash-controls-left">
            {/* View Mode Toggle */}
            <div className="dash-view-toggle">
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

            <input
              className="dash-filter-input"
              placeholder="Search deadlines…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="dash-filter-select"
            >
              <option value="all">All statuses</option>
              <option value="not_started">To Do</option>
              <option value="in_progress">In progress</option>
              <option value="review">Review / QA</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>

            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="dash-filter-select"
            >
              <option value="all">Everyone</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
            </select>
          </div>

          <div className="dash-controls-right">
            <input
              type="month"
              className="dash-filter-select"
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              title="Select report month"
            />
            <button
              className="btn-ghost btn-sm"
              onClick={handleDownloadReport}
              disabled={generatingReport}
              style={{ borderRadius: '8px', border: '1px solid var(--border-soft)', padding: '7px 12px', fontSize: '12.5px' }}
              title="Download monthly sprint execution report"
            >
              {generatingReport ? 'Generating…' : '↓ Report'}
            </button>
            <button
              className="dash-btn-accent"
              style={{ padding: '8px 16px', fontSize: '12.5px' }}
              onClick={() => setShowNewModal(true)}
            >
              + New deadline
            </button>
          </div>
        </section>

        {/* ── 6. MAIN BOARD + SIDEBAR ── */}
        <div className="dash-main-columns">
          <div className="dash-board-area">
            {viewMode === 'board' ? (
              /* KANBAN BOARD (5 Equal Columns) */
              <div className="dash-kanban-grid">
                {kanbanColumns.map(col => (
                  <div key={col.id} className="dash-kanban-col">
                    {/* Top colored accent stripe */}
                    <div className={`dash-col-top-bar ${col.colorKey}`} style={{ background: col.color }} />

                    <div className="dash-col-header">
                      <div className="dash-col-title-row">
                        <div className="dash-col-title-left">
                          <span className={`dash-col-dot ${col.colorKey}`} style={{ background: col.color }} />
                          <span className="dash-col-name">{col.title}</span>
                        </div>
                        <span className="dash-col-count">{col.items.length}</span>
                      </div>

                      {/* Thin progress track under header */}
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
                          <div className="dash-col-empty-text">
                            {col.id === 'not_started' && "Tasks you're ready to tackle will appear here."}
                            {col.id === 'in_progress' && "Move tasks here when work is actively underway."}
                            {col.id === 'review' && "Completed work waiting for review or QA sign-off."}
                            {col.id === 'blocked' && "Great — no blockers right now. Keep moving."}
                            {col.id === 'done' && "Finished tasks land here. Ship something great."}
                          </div>
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
                            teamId={TEAM_ID}
                            sprintLocked={!!(d.sprintId && sprints.find(s => s.id === d.sprintId)?.locked)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* LIST VIEW */
              <section className="dash-list-view">
                {filtered.length === 0 ? (
                  <div className="dash-empty-list">
                    {deadlines.length === 0
                      ? 'No deadlines yet. Click "+ New deadline" to create one.'
                      : 'Nothing matches the selected filters.'}
                  </div>
                ) : (
                  filtered.map(d => (
                    <DeadlineCard
                      key={d.id}
                      deadline={d}
                      currentUser={user}
                      teamId={TEAM_ID}
                      sprintLocked={!!(d.sprintId && sprints.find(s => s.id === d.sprintId)?.locked)}
                    />
                  ))
                )}
              </section>
            )}

            {/* Load More Pagination */}
            {hasMore && (
              <div className="dash-load-more">
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
          </div>

          {/* ── SIDEBAR: WORKLOAD PANEL ── */}
          <aside className="dash-sidebar-area">
            <WorkloadPanel members={members} deadlines={deadlines} />
          </aside>
        </div>
      </main>

      {/* ── NEW DEADLINE MODAL ── */}
      {showNewModal && (
        <NewDeadlineModal
          teamId={TEAM_ID}
          members={members}
          currentUser={user}
          activeSprint={activeSprint}
          onClose={() => setShowNewModal(false)}
        />
      )}
    </div>
  )
}
