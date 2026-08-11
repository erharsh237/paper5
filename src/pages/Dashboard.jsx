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

// Single shared team workspace for this internal tool.
const TEAM_ID = 'default-team'

export default function Dashboard() {
  const { workspaceId, workspace } = useWorkspace();
  const { user } = useAuth()
  const { deadlines, hasMore, loadMore, loadingMore } = useDeadlines(workspaceId, undefined)
  const [members, setMembers] = useState([])
  const [sprints, setSprints] = useState([])
  const [showNewModal, setShowNewModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const now = new Date()
  const [reportMonth, setReportMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)

  const [generatingReport, setGeneratingReport] = useState(false)

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

  return (
    <div className="dash">
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-brand">
            <span className="dash-brand-dot" />
            <span className="mono">SprintOS <span className="dash-brand-sub" style={{ whiteSpace: "nowrap" }}>{workspace?.name ? `| ${workspace.name}` : ''}</span></span>
          </div>
          <div className="dash-header-actions">
            <NavTabs />
            <NotificationBell currentUser={user} />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="dash-body">
        {/* Active Agile Workflow Banner (Visible strictly to Admins) */}
        {(() => {
          const isAdmin = workspaceRole === 'owner' || workspaceRole === 'admin'
          if (!isAdmin) return null

          const currentWorkflowId = workspace?.settings?.agile_workflow || 'scrum'
          const activeWf = getWorkflowById(currentWorkflowId)
          return (
            <div style={{
              marginBottom: '1.5rem',
              padding: '14px 18px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: '#10b981',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '15px'
                }}>
                  #{activeWf.num}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                      {activeWf.name}
                    </span>
                    <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 8px', borderRadius: '100px', fontWeight: 600 }}>
                      {activeWf.badge}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      (Team Size: {workspace?.settings?.team_size || activeWf.teamSizeLabel})
                    </span>
                  </div>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {activeWf.description}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                  Columns: {activeWf.columns.map(c => c.title).join(' ➔ ')}
                </div>
                {isAdmin && (
                  <Link 
                    to={`/${workspaceId}/settings`} 
                    style={{ 
                      fontSize: '12px', 
                      color: '#10b981', 
                      background: 'var(--bg-layer-1)', 
                      padding: '6px 12px', 
                      borderRadius: '6px', 
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      textDecoration: 'none', 
                      fontWeight: 600 
                    }}
                  >
                    ⚙️ Change Workflow
                  </Link>
                )}
              </div>
            </div>
          )
        })()}

        <SprintOverview sprints={sprints} deadlines={deadlines} currentUser={user} members={members} />

        <section className="stat-strip">
          <StatTile label="Active" value={stats.active} tone="info" />
          <StatTile label="Overdue" value={stats.overdue} tone="critical" />
          <StatTile label="Due soon" value={stats.dueSoon} tone="warn" />
          <StatTile label="Completed" value={stats.done} tone="signal" />
        </section>

        <div className="dash-columns">
          <div className="dash-main">
            <section className="controls-bar">
              <div className="controls-left">
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
                  title="Report month"
                />
                <button className="btn-ghost btn-sm" onClick={handleDownloadReport} disabled={generatingReport} title="Only covers deadlines currently loaded — click Load more first if the report month is older than what's shown">
                  {generatingReport ? 'Generating…' : '⬇ Download report'}
                </button>
                <button className="btn-primary btn-sm" onClick={() => setShowNewModal(true)}>+ New deadline</button>
              </div>
            </section>

            <section className="deadline-list">
              {filtered.length === 0 ? (
                <div className="empty-state">
                  <p>{deadlines.length === 0 ? 'No deadlines yet. Create the first one.' : 'Nothing matches these filters.'}</p>
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

            {hasMore && (
              <div className="load-more-row">
                <button className="btn-ghost btn-sm" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </div>

          <aside className="dash-sidebar">
            <WorkloadPanel members={members} deadlines={deadlines} />
          </aside>
        </div>
      </main>

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
