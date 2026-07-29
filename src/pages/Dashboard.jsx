import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { subscribeAllowedUsers } from '../lib/allowlist'
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
import Breadcrumbs from '../components/Breadcrumbs'
import './Dashboard.css'

// Single shared team workspace for this internal tool.
const TEAM_ID = 'default-team'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const { deadlines, hasMore, loadMore, loadingMore } = useDeadlines(TEAM_ID)
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
    const unsub2 = subscribeAllowedUsers(setMembers)
    const unsub3 = subscribeSprints(TEAM_ID, setSprints)
    return () => { unsub2(); unsub3() }
  }, [])

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
            <span className="mono">SECURIQ <span className="dash-brand-sub">| Deadline Tracker</span></span>
          </div>
          <div className="dash-header-actions">
            <NavTabs />
            <NotificationBell teamId={TEAM_ID} currentUser={user} />
            <span className="dash-user">{user?.displayName || user?.email}</span>
            <button className="btn-ghost btn-sm" onClick={logout}>Sign out</button>
          </div>
        </div>
      </header>

      <main className="dash-body">
        <Breadcrumbs trail={[{ label: 'Team' }]} />

        <SprintOverview teamId={TEAM_ID} sprints={sprints} deadlines={deadlines} currentUser={user} members={members} />

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
