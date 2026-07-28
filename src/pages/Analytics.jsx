import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { useAuth } from '../lib/AuthContext'
import { subscribeDeadlines, subscribeMembers } from '../lib/deadlines'
import { subscribeSprints } from '../lib/sprints'
import { computeAccountability } from '../lib/accountability'
import NotificationBell from '../components/NotificationBell'
import NavTabs from '../components/NavTabs'
import Breadcrumbs from '../components/Breadcrumbs'
import './Dashboard.css'
import './Analytics.css'

const TEAM_ID = 'default-team'

// Analytics needs the full aggregate (velocity, completion trends across
// sprints), not one page at a time, so this deliberately doesn't use the
// paginated useDeadlines hook — a partial page would silently skew every
// chart on this page toward whatever happened to load. Still bounded
// rather than truly unlimited, at a size generous enough that a small
// team won't hit it for a long while; revisit with real cursor pagination
// (or a server-aggregated rollup doc) if that ever changes.
const ANALYTICS_DEADLINES_CAP = 1000

export default function Analytics() {
  const { user, logout } = useAuth()
  const [deadlines, setDeadlines] = useState([])
  const [members, setMembers] = useState([])
  const [sprints, setSprints] = useState([])

  useEffect(() => {
    const unsub1 = subscribeDeadlines(TEAM_ID, setDeadlines, ANALYTICS_DEADLINES_CAP)
    const unsub2 = subscribeMembers(TEAM_ID, setMembers)
    const unsub3 = subscribeSprints(TEAM_ID, setSprints)
    return () => { unsub1(); unsub2(); unsub3() }
  }, [])

  const sprintStats = useMemo(() => {
    const bySprintNumber = [...sprints].sort((a, b) => (a.number || 0) - (b.number || 0))
    return bySprintNumber.map(s => {
      const tasks = deadlines.filter(d => d.sprintId === s.id)
      const done = tasks.filter(d => d.status === 'done').length
      const estimated = tasks.reduce((sum, d) => sum + (d.estimatedHours || 0), 0)
      const actual = tasks.reduce((sum, d) => sum + (d.actualHours || 0), 0)
      return {
        name: `Sprint ${s.number}`,
        completed: done,
        total: tasks.length,
        completionRate: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
        estimated, actual,
      }
    })
  }, [sprints, deadlines])

  const overall = useMemo(() => {
    const total = deadlines.length
    const done = deadlines.filter(d => d.status === 'done').length
    const blocked = deadlines.filter(d => d.status === 'blocked').length
    let blockedHours = 0
    let delaySamples = []
    deadlines.forEach(d => {
      if (d.blockerInfo?.blockedAt) blockedHours += 1 // coarse count — we don't track unblock time yet
      if (d.status === 'done' && d.completedAt?.toDate && d.dueDate) {
        const delayMs = d.completedAt.toDate().getTime() - new Date(d.dueDate).getTime()
        delaySamples.push(delayMs / (1000 * 60 * 60)) // hours
      }
    })
    const avgDelayHours = delaySamples.length
      ? Math.round(delaySamples.reduce((a, b) => a + b, 0) / delaySamples.length)
      : null
    return {
      completionRate: total ? Math.round((done / total) * 100) : 0,
      blocked,
      avgDelayHours,
      hasDelaySamples: delaySamples.length > 0,
    }
  }, [deadlines])

  const mostProductiveSprint = useMemo(() => {
    if (sprintStats.length === 0) return null
    return sprintStats.reduce((best, s) => (s.completed > (best?.completed || 0) ? s : best), null)
  }, [sprintStats])

  const priorityDelay = useMemo(() => {
    const byPriority = { low: 0, medium: 0, high: 0, critical: 0 }
    deadlines.forEach(d => {
      if (d.status !== 'done' && new Date(d.dueDate) < new Date()) {
        byPriority[d.priority] = (byPriority[d.priority] || 0) + 1
      }
    })
    return Object.entries(byPriority).map(([name, value]) => ({ name, overdue: value }))
  }, [deadlines])

  const accountability = useMemo(
    () => computeAccountability(members, deadlines, sprints).filter(a => a.level > 0),
    [members, deadlines, sprints]
  )

  return (
    <div className="dash">
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-brand">
            <span className="dash-brand-dot" />
            <span className="mono">SECURIQ <span className="dash-brand-sub">| Analytics</span></span>
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
        <Breadcrumbs trail={[{ label: 'Analytics' }]} />

        <section className="stat-strip">
          <StatTile label="Completion rate" value={`${overall.completionRate}%`} tone="signal" />
          <StatTile label="Currently blocked" value={overall.blocked} tone="critical" />
          <StatTile label="Avg delay (done tasks)" value={overall.hasDelaySamples ? `${overall.avgDelayHours}h` : '—'} tone="warn" />
          <StatTile label="Most productive" value={mostProductiveSprint ? mostProductiveSprint.name : '—'} tone="info" />
        </section>

        {accountability.length > 0 && (
          <section className="sprint-overview">
            <h2 className="mono">ACCOUNTABILITY STATUS</h2>
            <div className="accountability-list">
              {accountability.map(a => (
                <div key={a.member.id} className={`accountability-row accountability-row--level${a.level}`}>
                  <span className="accountability-name">{a.member.name}</span>
                  <span className="accountability-level mono">LEVEL {a.level}</span>
                  <span className="accountability-rec">{a.recommendation}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {sprintStats.length === 0 ? (
          <div className="empty-state">
            <p>No sprint data yet — charts will populate once sprints have tasks.</p>
          </div>
        ) : (
          <>
            <section className="sprint-overview">
              <h2 className="mono">SPRINT VELOCITY & COMPLETION RATE</h2>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={sprintStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-hair)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="completed" name="Tasks completed" stroke="#2f9e6e" strokeWidth={2} />
                    <Line type="monotone" dataKey="completionRate" name="Completion rate %" stroke="#4c6fff" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="sprint-overview">
              <h2 className="mono">ESTIMATED VS ACTUAL HOURS</h2>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={sprintStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-hair)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="estimated" name="Estimated hrs" fill="#c7d7fb" />
                    <Bar dataKey="actual" name="Actual hrs" fill="#4c6fff" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="sprint-overview">
              <h2 className="mono">OVERDUE TASKS BY PRIORITY (most delayed categories)</h2>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={priorityDelay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-hair)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="overdue" name="Overdue now" fill="#ff5470" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
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
