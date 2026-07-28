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
import Breadcrumbs from '../components/Breadcrumbs'
import './Dashboard.css'
import './MyDashboard.css'

const TEAM_ID = 'default-team'

export default function MyDashboard() {
  const { user, logout } = useAuth()
  const { deadlines, hasMore, loadMore, loadingMore } = useDeadlines(TEAM_ID)
  const [sprints, setSprints] = useState([])
  const [showTour, setShowTour] = useState(false)

  useEffect(() => {
    return subscribeSprints(TEAM_ID, setSprints)
  }, [])

  useEffect(() => {
    if (!user?.email) return
    let cancelled = false
    hasSeenTour(user.email).then(seen => {
      if (!cancelled && !seen) setShowTour(true)
    })
    return () => { cancelled = true }
  }, [user?.email])

  const myEmail = (user?.email || '').toLowerCase()
  const activeSprint = useMemo(() => sprints.find(s => s.status === 'active'), [sprints])

  const myTasks = useMemo(
    () => deadlines.filter(d => d.assigneeEmail?.toLowerCase() === myEmail),
    [deadlines, myEmail]
  )

  const stats = useMemo(() => {
    const active = myTasks.filter(d => d.status !== 'done')
    const overdue = active.filter(d => getUrgency(d.dueDate, d.status) === 'overdue')
    const dueSoon = active.filter(d => ['critical', 'warn'].includes(getUrgency(d.dueDate, d.status)))
    const done = myTasks.filter(d => d.status === 'done')
    const blocked = myTasks.filter(d => d.status === 'blocked')
    return { total: myTasks.length, active: active.length, overdue: overdue.length, dueSoon: dueSoon.length, done: done.length, blocked: blocked.length }
  }, [myTasks])

  const reliability = stats.total === 0 ? null : Math.round((stats.done / stats.total) * 100)

  const mySprintTasks = useMemo(() => {
    if (!activeSprint) return []
    return myTasks.filter(d => d.sprintId === activeSprint.id)
  }, [activeSprint, myTasks])

  const mySprintProgress = useMemo(() => {
    if (mySprintTasks.length === 0) return 0
    const done = mySprintTasks.filter(d => d.status === 'done').length
    return Math.round((done / mySprintTasks.length) * 100)
  }, [mySprintTasks])

  // Tasks any teammate submitted for review that this person can act on —
  // reviewer just needs to not be the assignee.
  const needsMyReview = useMemo(
    () => deadlines.filter(d => d.status === 'review' && d.assigneeEmail?.toLowerCase() !== myEmail),
    [deadlines, myEmail]
  )

  const sortedMyTasks = useMemo(() => {
    return [...myTasks].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
  }, [myTasks])

  return (
    <div className="dash">
      {showTour && (
        <SiteTour currentUserEmail={user?.email} onFinish={() => setShowTour(false)} />
      )}
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-brand">
            <span className="dash-brand-dot" />
            <span className="mono">SECURIQ <span className="dash-brand-sub">| My tasks</span></span>
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
        <Breadcrumbs trail={[{ label: 'My tasks' }]} />

        <section className="mydash-hello">
          <h1>Welcome back, {user?.displayName?.split(' ')[0] || 'there'}</h1>
          {activeSprint && (
            <p className="mono mydash-hello-sprint">
              Sprint {activeSprint.number}{activeSprint.locked ? ' · locked' : ''} — {mySprintTasks.length} task{mySprintTasks.length === 1 ? '' : 's'} yours this sprint, {mySprintProgress}% done
            </p>
          )}
        </section>

        <section className="stat-strip">
          <StatTile label="Active" value={stats.active} tone="info" />
          <StatTile label="Overdue" value={stats.overdue} tone="critical" />
          <StatTile label="Due soon" value={stats.dueSoon} tone="warn" />
          <StatTile label="Completed" value={stats.done} tone="signal" />
        </section>

        {(stats.blocked > 0 || needsMyReview.length > 0) && (
          <section className="mydash-attention">
            {stats.blocked > 0 && (
              <div className="mydash-attention-card mydash-attention-card--critical">
                <div className="mydash-attention-title">You have {stats.blocked} blocked task{stats.blocked === 1 ? '' : 's'}</div>
                <p>Clear the blocker once it's resolved so it stops counting against you.</p>
              </div>
            )}
            {needsMyReview.length > 0 && (
              <div className="mydash-attention-card">
                <div className="mydash-attention-title">{needsMyReview.length} task{needsMyReview.length === 1 ? '' : 's'} waiting on your review</div>
                <p>{needsMyReview.map(d => d.title).slice(0, 3).join(' · ')}{needsMyReview.length > 3 ? '…' : ''}</p>
              </div>
            )}
          </section>
        )}

        {reliability != null && (
          <section className="mydash-reliability">
            <span className="mono">Completion rate: {reliability}%</span>
            <span className="mydash-reliability-sub">({stats.done} of {stats.total} tasks ever assigned to you)</span>
          </section>
        )}

        <section className="deadline-list">
          {sortedMyTasks.length === 0 ? (
            <div className="empty-state">
              <p>No tasks assigned to you yet.</p>
            </div>
          ) : (
            sortedMyTasks.map(d => (
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

        {needsMyReview.length > 0 && (
          <>
            <h2 className="mydash-section-title mono">WAITING ON YOUR REVIEW</h2>
            <section className="deadline-list">
              {needsMyReview.map(d => (
                <DeadlineCard
                  key={d.id}
                  deadline={d}
                  currentUser={user}
                  teamId={TEAM_ID}
                  sprintLocked={!!(d.sprintId && sprints.find(s => s.id === d.sprintId)?.locked)}
                />
              ))}
            </section>
          </>
        )}
      </main>
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
