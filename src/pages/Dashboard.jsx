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
import SprintOverview from '../components/SprintOverview'
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
      if (search.trim() && !d.title.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [deadlines, statusFilter, assigneeFilter, search])

  const activeWorkflow = useMemo(() => {
    const wfId = workspace?.settings?.agile_workflow || 'scrum'
    return getWorkflowById(wfId) || getWorkflowById('scrum')
  }, [workspace?.settings?.agile_workflow])

  const kanbanColumns = useMemo(() => {
    if (!activeWorkflow || !activeWorkflow.columns || activeWorkflow.columns.length === 0) {
      return [
        { id: 'not_started', title: 'To Do',       color: '#64748b', items: filtered.filter(d => d.status === 'not_started' || d.status === 'todo') },
        { id: 'in_progress', title: 'In Progress',  color: '#3b82f6', items: filtered.filter(d => d.status === 'in_progress') },
        { id: 'review',      title: 'Review / QA',  color: '#f59e0b', items: filtered.filter(d => d.status === 'review') },
        { id: 'blocked',     title: 'Blocked',       color: '#ef4444', items: filtered.filter(d => d.status === 'blocked') },
        { id: 'done',        title: 'Done',          color: '#10b981', items: filtered.filter(d => d.status === 'done') },
      ]
    }

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
      return { id: col.id, title: col.title, color: colors[idx % colors.length], items: colItems }
    })
  }, [activeWorkflow, filtered])

  const isAdmin = workspaceRole === 'owner' || workspaceRole === 'admin'
  const activeWf = getWorkflowById(workspace?.settings?.agile_workflow || 'scrum')

  return (
    <div className="dash">
      {/* ── HEADER ── */}
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-brand">
            <span className="dash-brand-dot" />
            SprintOS
            {workspace?.name && (
              <>
                <span className="dash-brand-divider" />
                <span className="dash-brand-workspace">{workspace.name}</span>
              </>
            )}
          </div>
          <div className="dash-header-actions">
            <NavTabs />
            <NotificationBell currentUser={user} />
            <UserMenu />
          </div>
        </div>
      </header>

      {/* ── BODY ── */}
      <main className="dash-body">

        {/* Agile Workflow Banner — Admin only */}
        {isAdmin && activeWf && (
          <div className="workflow-banner">
            <div className="workflow-banner-left">
              <div className="workflow-banner-icon">#{activeWf.num}</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <span className="workflow-banner-name">{activeWf.name}</span>
                  <span className="workflow-banner-badge">{activeWf.badge}</span>
                </div>
                <div className="workflow-banner-team">
                  Team size: {workspace?.settings?.team_size || activeWf.teamSizeLabel}
                  &ensp;·&ensp;
                  <span className="workflow-banner-columns">
                    {activeWf.columns.map(c => c.title).join(' → ')}
                  </span>
                </div>
              </div>
            </div>
            <Link to={`/${workspaceId}/settings`} className="workflow-banner-link">
              Change Workflow
            </Link>
          </div>
        )}

        {/* Sprint Overview */}
        <SprintOverview sprints={sprints} deadlines={deadlines} currentUser={user} members={members} />

        {/* Stat Strip */}
        <section className="stat-strip">
          <StatTile label="Active"    value={stats.active}  tone="info" />
          <StatTile label="Overdue"   value={stats.overdue} tone="critical" />
          <StatTile label="Due Soon"  value={stats.dueSoon} tone="warn" />
          <StatTile label="Completed" value={stats.done}    tone="signal" />
        </section>

        {/* Main + Sidebar */}
        <div className="dash-columns">
          <div className="dash-main">

            {/* Controls Bar */}
            <section className="controls-bar">
              <div className="controls-left">
                {/* View Mode Toggle */}
                <div className="view-toggle">
                  <button
                    type="button"
                    className={`view-toggle-btn${viewMode === 'board' ? ' active' : ''}`}
                    onClick={() => setViewMode('board')}
                  >
                    Kanban Board
                  </button>
                  <button
                    type="button"
                    className={`view-toggle-btn${viewMode === 'list' ? ' active' : ''}`}
                    onClick={() => setViewMode('list')}
                  >
                    List View
                  </button>
                </div>

                <input
                  className="search-input"
                  placeholder="Search deadlines…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
                  <option value="all">All statuses</option>
                  <option value="not_started">Not started</option>
                  <option value="in_progress">In progress</option>
                  <option value="review">Review / QA</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>

                <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="filter-select">
                  <option value="all">Everyone</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>

              <div className="controls-right">
                <input
                  type="month"
                  className="filter-select"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(e.target.value)}
                  title="Select report month"
                />
                <button
                  className="btn-ghost btn-sm"
                  onClick={handleDownloadReport}
                  disabled={generatingReport}
                  title="Only covers deadlines currently loaded — click Load more first if the report month is older"
                >
                  {generatingReport ? 'Generating…' : '↓ Report'}
                </button>
                <button className="btn-primary btn-sm" onClick={() => setShowNewModal(true)}>
                  + New deadline
                </button>
              </div>
            </section>

            {/* ── KANBAN BOARD ── */}
            {viewMode === 'board' ? (
              <div className="kanban-board">
                {kanbanColumns.map(col => (
                  <div key={col.id} className="kanban-column">
                    <div className="kanban-column-stripe" style={{ background: col.color }} />
                    <div className="kanban-column-header">
                      <div className="kanban-column-title-row">
                        <span className="kanban-col-dot" style={{ background: col.color }} />
                        {col.title}
                      </div>
                      <span className="kanban-col-count">{col.items.length}</span>
                    </div>
                    <div className="kanban-column-body">
                      {col.items.length === 0 ? (
                        <div className="kanban-empty">No tasks</div>
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
              /* ── LIST VIEW ── */
              <section className="deadline-list">
                {filtered.length === 0 ? (
                  <div className="empty-state">
                    {deadlines.length === 0 ? 'No deadlines yet. Create the first one.' : 'Nothing matches these filters.'}
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

            {/* Load More */}
            {hasMore && (
              <div className="load-more-row">
                <button className="btn-ghost btn-sm" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </div>

          {/* ── SIDEBAR ── */}
          <aside className="dash-sidebar">
            <WorkloadPanel members={members} deadlines={deadlines} />
          </aside>
        </div>
      </main>

      {/* New Deadline Modal */}
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

function StatTile({ label, value, tone }) {
  return (
    <div className={`stat-tile stat-tile--${tone}`}>
      <div className="stat-value mono">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
