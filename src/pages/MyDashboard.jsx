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
import UserMenu from '../components/UserMenu'
import CalendarWidget from '../components/CalendarWidget'
import { useWorkspace } from '../lib/WorkspaceContext'
import { Link } from 'react-router-dom'
import { subscribeIntegrationConfig } from '../lib/integrations/config'
import './Dashboard.css'
import './MyDashboard.css'

export default function MyDashboard() {
  const { workspaceId, workspace, workspaceRole } = useWorkspace();
  const isAdmin = workspaceRole === 'owner' || workspaceRole === 'admin'
  const { user, logout } = useAuth()
  const { deadlines, hasMore, loadMore, loadingMore } = useDeadlines(workspaceId)
  const [sprints, setSprints] = useState([])
  const [showTour, setShowTour] = useState(false)

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
    if (typeof integrationConfig.github_repos === 'string') return integrationConfig.github_repos.split(',').map(r => r.trim()).filter(Boolean)
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
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-brand">
            <span className="dash-brand-dot" />
            <span className="mono">Paper5 <span className="dash-brand-sub" style={{ whiteSpace: "nowrap" }}>{workspace?.name ? `| ${workspace.name}` : ''}</span></span>
          </div>
          <div className="dash-header-actions">
            <NavTabs />
            <NotificationBell currentUser={user} />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="dash-body">
        <section className="mydash-top-row" style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div className="mydash-hello" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h1 style={{ margin: '0 0 8px 0' }}>Welcome back, {user?.displayName?.split(' ')[0] || 'there'}</h1>
            {activeSprint && (
              <p className="mono mydash-hello-sprint" style={{ margin: 0 }}>
                Sprint {activeSprint.number}{activeSprint.locked ? ' · locked' : ''} — {mySprintTasks.length} task{mySprintTasks.length === 1 ? '' : 's'} yours this sprint, {mySprintProgress}% done
              </p>
            )}
          </div>

           <div style={{ flex: '1 1 250px' }}>
             <CalendarWidget user={user} />
           </div>
           
           <div style={{ flex: '1 1 250px', background: 'var(--bg-panel)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-hair)' }}>
              <h3 className="mono" style={{ margin: '0 0 1rem 0', fontSize: '12px', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>REPOSITORIES</h3>
              {githubRepos.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {githubRepos.map((repo, idx) => (
                    <li key={idx} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-inset)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>📦</span>
                      <a href={repo.startsWith('http') ? repo : `https://github.com/${repo}`} target="_blank" rel="noreferrer" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}>
                        {repo.replace(/^https?:\/\/github\.com\//, '')}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>No GitHub repositories connected.</span>
                  {isAdmin ? (
                    <Link to={`/${workspaceId}/integrations`} style={{ fontSize: '12px', color: 'var(--accent-signal, #10b981)', textDecoration: 'none', fontWeight: 600 }}>
                      + Connect GitHub in Integrations
                    </Link>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                      Ask your admin to connect GitHub repos.
                    </span>
                  )}
                </div>
              )}
           </div>
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

      {showTour && (
        <SiteTour currentUser={user} onFinish={() => setShowTour(false)} />
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
