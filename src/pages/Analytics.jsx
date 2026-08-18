import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area, AreaChart
} from 'recharts'
import { useAuth } from '../lib/AuthContext'
import { subscribeDeadlines, subscribeMembers } from '../lib/deadlines'
import { subscribeSprints } from '../lib/sprints'
import { computeAccountability } from '../lib/accountability'
import NavTabs from '../components/NavTabs'
import UserMenu from '../components/UserMenu'
import { useWorkspace } from '../lib/WorkspaceContext'
import './Dashboard.css'
import './Analytics.css'

const ANALYTICS_DEADLINES_CAP = 1000

export default function Analytics() {
  const { workspaceId, workspace } = useWorkspace();
  const { user, userData } = useAuth()
  
  const planId = userData?.billing?.planId || 'free'
  const isScale = planId === 'scale'
  const [deadlines, setDeadlines] = useState([])
  const [members, setMembers] = useState([])
  const [sprints, setSprints] = useState([])

  useEffect(() => {
    const unsub1 = subscribeDeadlines(workspaceId, undefined, setDeadlines, ANALYTICS_DEADLINES_CAP)
    const unsub2 = subscribeMembers(workspaceId, undefined, setMembers)
    const unsub3 = subscribeSprints(workspaceId, undefined, setSprints)
    return () => { unsub1(); unsub2(); unsub3() }
  }, [workspaceId])

  const sprintStats = useMemo(() => {
    const bySprintNumber = [...sprints].sort((a, b) => (a.number || 0) - (b.number || 0))
    if (!bySprintNumber.length) {
      // If no sprints created yet, fallback to a default mock point so charts don't crash
      return []
    }
    return bySprintNumber.map(s => {
      const tasks = deadlines.filter(d => d.sprintId === s.id)
      const done = tasks.filter(d => d.status === 'done' || d.status === 'completed' || d.status === 'shipped').length
      const inProgress = tasks.filter(d => d.status === 'in_progress' || d.status === 'review').length
      const estimated = tasks.reduce((sum, d) => sum + (d.estimatedHours || 0), 0)
      const actual = tasks.reduce((sum, d) => sum + (d.actualHours || 0), 0)
      return {
        name: `Sprint ${s.number}`,
        completed: done,
        inProgress,
        total: tasks.length,
        completionRate: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
        estimated,
        actual,
      }
    })
  }, [sprints, deadlines])

  const overall = useMemo(() => {
    const done = deadlines.filter(d => d.status === 'done' || d.status === 'completed' || d.status === 'shipped')
    const blocked = deadlines.filter(d => d.status === 'blocked').length
    const total = deadlines.length
    const completionRate = total ? Math.round((done.length / total) * 100) : 0

    // Delay calculation
    const delaySamples = done
      .filter(d => d.completedAt && d.dueDate)
      .map(d => (new Date(d.completedAt) - new Date(d.dueDate)) / (1000 * 60 * 60))
    const avgDelayHours = delaySamples.length
      ? Math.max(0, Math.round(delaySamples.reduce((a, b) => a + b, 0) / delaySamples.length))
      : 0

    return { total, done: done.length, blocked, completionRate, avgDelayHours, hasDelaySamples: delaySamples.length > 0 }
  }, [deadlines])

  const mostProductiveSprint = useMemo(() => {
    if (!sprintStats.length) return null
    return [...sprintStats].sort((a, b) => b.completed - a.completed)[0]
  }, [sprintStats])

  const workloadPerMember = useMemo(() => {
    return members.map(m => {
      const email = (m.email || '').toLowerCase()
      const assigned = deadlines.filter(d => {
        const emailMatch = d.assigneeEmail && d.assigneeEmail.toLowerCase() === email
        const idMatch = d.assigneeId && (d.assigneeId === m.id || d.assigneeId === m.user_id)
        return emailMatch || idMatch
      })
      const done = assigned.filter(d => d.status === 'done' || d.status === 'completed' || d.status === 'shipped').length
      const inProgress = assigned.filter(d => d.status === 'in_progress').length
      const blocked = assigned.filter(d => d.status === 'blocked').length
      const total = assigned.length
      const rate = total > 0 ? Math.round((done / total) * 100) : 0
      return {
        id: m.id || m.email,
        name: m.name || m.fullName || m.email?.split('@')[0] || 'Member',
        email: m.email || '',
        inProgress,
        blocked,
        done,
        total,
        rate
      }
    }).sort((a, b) => b.total - a.total)
  }, [members, deadlines])

  const priorityBreakdown = useMemo(() => {
    const counts = { urgent: 0, high: 0, medium: 0, low: 0 }
    deadlines.forEach(d => {
      const p = (d.priority || 'medium').toLowerCase()
      if (counts[p] !== undefined) counts[p]++
      else counts.medium++
    })
    return [
      { name: 'Urgent', count: counts.urgent, color: '#EF4444' },
      { name: 'High', count: counts.high, color: '#F97316' },
      { name: 'Medium', count: counts.medium, color: '#4F46E5' },
      { name: 'Low', count: counts.low, color: '#10B981' },
    ]
  }, [deadlines])

  const accountability = useMemo(
    () => computeAccountability(members, deadlines, sprints).filter(a => a.level > 0),
    [members, deadlines, sprints]
  )

  const CustomChartTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: '#1C1D2B',
          color: '#FFFFFF',
          padding: '8px 12px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          fontSize: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          minWidth: '150px'
        }}>
          <div style={{ fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '3px', marginBottom: '2px' }}>
            {label}
          </div>
          {payload.map((entry, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ color: '#A3A5C2', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: entry.color }} />
                {entry.name}:
              </span>
              <strong style={{ color: '#FFFFFF' }}>{entry.value}</strong>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="dash-root">
      {/* 1. STICKY TOP NAV */}
      <nav className="dash-sticky-nav">
        <div className="dash-container dash-nav-inner">
          <Link to={`/${workspaceId}`} className="dash-nav-brand">
            <div className="dash-logo-dot">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <span className="dash-logo-name">SprintOS</span>
            <span className="dash-env-tag">{(workspace?.name || 'Workspace').toUpperCase()}</span>
          </Link>

          <NavTabs />

          <div className="dash-nav-actions">
            <UserMenu />
          </div>
        </div>
      </nav>

      <main className="dash-container" style={{ paddingBottom: '60px' }}>
        
        {/* 2. HERO HEADER */}
        <section className="dash-page-header">
          <div className="dash-header-inner">
            <div className="dash-header-left">
              <div className="dash-eyebrow">
                <span className="dash-eyebrow-dot" />
                Performance & Velocity
              </div>
              <h1 className="dash-greeting">Team <span>Analytics</span></h1>
              <p className="dash-subtext">Comprehensive sprint performance, delivery velocity, and workload distribution</p>
            </div>
          </div>
        </section>

        {/* 3. TOP 4 METRIC CARDS (UNIFIED DASH-STAT-STRIP) */}
        <section className="dash-stat-strip">
          <div className="dash-stat-col">
            <div className="dash-stat-label-row">
              <span className="dash-stat-dot" style={{ background: '#10B981' }} />
              <span>Completion Rate</span>
            </div>
            <div className="dash-stat-value">{overall.completionRate}%</div>
            <div className="dash-stat-delta dash-delta-green">
              {overall.done} of {overall.total} deadlines delivered
            </div>
          </div>

          <div className="dash-stat-col">
            <div className="dash-stat-label-row">
              <span className="dash-stat-dot" style={{ background: overall.blocked > 0 ? '#EF4444' : '#10B981' }} />
              <span>Currently Blocked</span>
            </div>
            <div className="dash-stat-value">{overall.blocked}</div>
            <div className={`dash-stat-delta ${overall.blocked === 0 ? 'dash-delta-green' : 'dash-delta-red'}`}>
              {overall.blocked === 0 ? '✓ All clear, no blockers' : 'Requires founder review'}
            </div>
          </div>

          <div className="dash-stat-col">
            <div className="dash-stat-label-row">
              <span className="dash-stat-dot" style={{ background: '#F59E0B' }} />
              <span>Average Lead Delay</span>
            </div>
            <div className="dash-stat-value">{overall.hasDelaySamples ? `${overall.avgDelayHours}h` : '0h'}</div>
            <div className="dash-stat-delta dash-delta-amber">
              Across delivered deliverables
            </div>
          </div>

          <div className="dash-stat-col">
            <div className="dash-stat-label-row">
              <span className="dash-stat-dot" style={{ background: '#4F46E5' }} />
              <span>Most Productive Sprint</span>
            </div>
            <div className="dash-stat-value" style={{ fontSize: '24px' }}>
              {mostProductiveSprint ? mostProductiveSprint.name : '—'}
            </div>
            <div className="dash-stat-delta dash-delta-blue">
              {mostProductiveSprint ? `${mostProductiveSprint.completed} tasks delivered` : 'No sprints closed yet'}
            </div>
          </div>
        </section>

        {/* 4. CHARTS SECTION */}
        {sprintStats.length === 0 ? (
          <div className="dash-surface-card" style={{ padding: '36px', textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text)', marginBottom: '6px' }}>No Sprint Cycles Yet</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px', maxWidth: '380px', margin: '0 auto 16px' }}>
              Charts will automatically graph team velocity once sprint cycles and deliverables are created.
            </div>
            <Link to={`/${workspaceId}/team`} className="dash-btn-accent" style={{ textDecoration: 'none', display: 'inline-block' }}>
              Go to Sprints Board →
            </Link>
          </div>
        ) : (
          <div className="analytics-charts-grid">
            
            {/* Chart 1: Sprint Velocity & Completion Rate */}
            <div className="dash-surface-card analytics-chart-card">
              <div className="dash-panel-header" style={{ marginBottom: '18px' }}>
                <div>
                  <div className="dash-panel-title">Sprint Velocity & Completion</div>
                  <div className="dash-panel-desc">Delivered task volume and % completion per sprint cycle</div>
                </div>
              </div>

              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sprintStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="doneGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={{ stroke: 'var(--border-soft)' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Area type="monotone" dataKey="completionRate" name="Completion Rate %" stroke="#4F46E5" strokeWidth={2.5} fillOpacity={1} fill="url(#rateGradient)" />
                    <Area type="monotone" dataKey="completed" name="Tasks Delivered" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#doneGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Estimated vs Actual Hours */}
            <div className="dash-surface-card analytics-chart-card">
              <div className="dash-panel-header" style={{ marginBottom: '18px' }}>
                <div>
                  <div className="dash-panel-title">Workload & Estimation Accuracy</div>
                  <div className="dash-panel-desc">Planned estimated hours vs actual logged work per sprint</div>
                </div>
              </div>

              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sprintStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={{ stroke: 'var(--border-soft)' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="estimated" name="Estimated (Hrs)" fill="#C7D7FB" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="actual" name="Actual Logged (Hrs)" fill="#4F46E5" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}

        {/* 5. TEAM WORKLOAD & CAPACITY TABLE */}
        <section className="dash-surface-card" style={{ padding: '24px', marginBottom: '24px' }}>
          <div className="dash-panel-header" style={{ marginBottom: '20px' }}>
            <div>
              <div className="dash-panel-title">Team Workload & Output</div>
              <div className="dash-panel-desc">Individual workload distribution and task completion velocity across members</div>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--muted)' }}>
              {workloadPerMember.length} Members Active
            </span>
          </div>

          {workloadPerMember.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
              No member assignments recorded in this workspace.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>In Progress</th>
                    <th>Blocked</th>
                    <th>Delivered</th>
                    <th>Total Workload</th>
                    <th style={{ minWidth: '180px' }}>Completion Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {workloadPerMember.map(m => (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="avatar-dot mono">{m.name[0]?.toUpperCase() || '?'}</span>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '13px' }}>{m.name}</div>
                            {m.email && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{m.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="analytics-badge analytics-badge--blue">{m.inProgress} in flight</span>
                      </td>
                      <td>
                        <span className={`analytics-badge ${m.blocked > 0 ? 'analytics-badge--red' : 'analytics-badge--gray'}`}>
                          {m.blocked} blocked
                        </span>
                      </td>
                      <td>
                        <span className="analytics-badge analytics-badge--green">{m.done} shipped</span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text)' }}>
                          {m.total} tasks
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ flex: 1, height: '6px', background: 'var(--surface-2)', borderRadius: '100px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${m.rate}%`,
                              height: '100%',
                              background: m.rate === 100 ? '#10B981' : '#4F46E5',
                              borderRadius: '100px'
                            }} />
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', fontWeight: 700, color: 'var(--text)', minWidth: '34px' }}>
                            {m.rate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 6. PRIORITY DISTRIBUTION & RISK */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          
          <div className="dash-surface-card" style={{ padding: '24px' }}>
            <div className="dash-panel-header" style={{ marginBottom: '16px' }}>
              <div>
                <div className="dash-panel-title">Deadlines by Priority</div>
                <div className="dash-panel-desc">Scope distribution across urgency tiers</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {priorityBreakdown.map(p => {
                const pct = overall.total > 0 ? Math.round((p.count / overall.total) * 100) : 0
                return (
                  <div key={p.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color }} />
                        {p.name}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)', fontSize: '11.5px' }}>
                        {p.count} ({pct}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'var(--surface-2)', borderRadius: '100px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: p.color, borderRadius: '100px' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Scale Plan Accountability / Risk Audit */}
          <div className="dash-surface-card" style={{ padding: '24px' }}>
            <div className="dash-panel-header" style={{ marginBottom: '16px' }}>
              <div>
                <div className="dash-panel-title">Risk & Delay Intelligence</div>
                <div className="dash-panel-desc">Automated accountability signals and delay warnings</div>
              </div>
            </div>

            {accountability.length === 0 ? (
              <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🛡️</div>
                <div>No critical delay warnings detected across the workspace.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {accountability.map(a => (
                  <div key={a.member.id} style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-soft)',
                    borderLeft: `3px solid ${a.level === 3 ? '#EF4444' : a.level === 2 ? '#F59E0B' : '#3D6FD6'}`,
                    background: a.level === 3 ? 'rgba(239, 68, 68, 0.04)' : 'var(--surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>{a.member.name}</span>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', flex: 1 }}>{a.recommendation}</span>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '100px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border-soft)'
                    }}>
                      Level {a.level}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </main>
    </div>
  )
}
