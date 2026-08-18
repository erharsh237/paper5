import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { subscribeMembers } from '../lib/deadlines'
import { useDeadlines } from '../lib/useDeadlines'
import { subscribeSprints } from '../lib/sprints'
import { getUrgency } from '../lib/utils'
import { downloadMonthlyReport } from '../lib/report'
import DeadlineCard from '../components/DeadlineCard'
import NewDeadlineModal from '../components/NewDeadlineModal'
import NewSprintModal from '../components/NewSprintModal'
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
  const { workspaceId, workspace, workspaceRole, canAddKanbanItems } = useWorkspace()
  const { user } = useAuth()
  const { deadlines, hasMore, loadMore, loadingMore } = useDeadlines(workspaceId, undefined)
  const [members, setMembers] = useState([])
  const [sprints, setSprints] = useState([])
  const [showNewModal, setShowNewModal] = useState(false)
  const [showNewSprintModal, setShowNewSprintModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('board')
  const [timeRange, setTimeRange] = useState('7D')
  const [hoveredIndex, setHoveredIndex] = useState(null)
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

  const [selectedSprintViewId, setSelectedSprintViewId] = useState(null)

  const activeSprint = useMemo(() => sprints.find(s => s.status === 'active'), [sprints])

  const currentDisplaySprint = useMemo(() => {
    if (selectedSprintViewId) {
      const found = sprints.find(s => s.id === selectedSprintViewId)
      if (found) return found
    }
    return activeSprint || sprints[0] || null
  }, [sprints, selectedSprintViewId, activeSprint])

  const sprintDeadlines = useMemo(() => {
    if (!currentDisplaySprint) return []
    return deadlines.filter(d => d.sprintId === currentDisplaySprint.id)
  }, [deadlines, currentDisplaySprint])

  const sprintStats = useMemo(() => {
    const total = sprintDeadlines.length
    const done = sprintDeadlines.filter(d => d.status === 'done' || d.status === 'completed').length
    const inProgress = sprintDeadlines.filter(d => d.status === 'in_progress').length
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return { total, done, inProgress, pct }
  }, [sprintDeadlines])

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
      if (assigneeFilter !== 'all' && d.assigneeId !== assigneeFilter && d.assigneeEmail !== assigneeFilter) return false
      if (search.trim() && !d.title?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [deadlines, statusFilter, assigneeFilter, search])

  // 5 Canonical Kanban Columns
  const kanbanColumns = useMemo(() => {
    const standardCols = [
      { id: 'not_started', title: 'To Do', colorKey: 'todo', color: '#1C1D2B' },
      { id: 'in_progress', title: 'In Progress', colorKey: 'progress', color: '#3D6FD6' },
      { id: 'review', title: 'Review / QA', colorKey: 'review', color: '#C4791A' },
      { id: 'blocked', title: 'Blocked', colorKey: 'blocked', color: '#D14343' },
      { id: 'done', title: 'Done', colorKey: 'done', color: '#4F46E5' },
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
  }, [filtered])

  // ── REAL DATA VELOCITY CALCULATION (7D / 30D / 90D) ──
  const velocityData = useMemo(() => {
    const nowDate = new Date()

    if (timeRange === '7D') {
      const currentDayIdx = nowDate.getDay()
      const monday = new Date(nowDate)
      const diffToMonday = (currentDayIdx === 0 ? -6 : 1 - currentDayIdx)
      monday.setDate(nowDate.getDate() + diffToMonday)
      monday.setHours(0, 0, 0, 0)

      const days = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        const dateStr = d.toISOString().slice(0, 10)
        const dayLabel = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]
        const fullDateFormatted = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

        const doneTasks = deadlines.filter(t => {
          if (t.status !== 'done') return false
          const compDate = (t.completedAt || t.completed_at || t.dueDate || t.due_date || t.createdAt || '').slice(0, 10)
          return compDate === dateStr
        })

        const inProgTasks = deadlines.filter(t => {
          if (t.status !== 'in_progress') return false
          const taskDate = (t.dueDate || t.due_date || t.createdAt || '').slice(0, 10)
          return taskDate === dateStr
        })

        days.push({
          label: dayLabel,
          title: fullDateFormatted,
          done: doneTasks.length,
          inProgress: inProgTasks.length,
          total: doneTasks.length + inProgTasks.length,
          isCurrent: d.toDateString() === nowDate.toDateString()
        })
      }

      const maxCount = Math.max(1, ...days.map(d => d.total))
      return {
        subtitle: 'completed / assigned per day',
        bars: days.map(d => ({
          ...d,
          heightPct: d.total > 0 ? Math.round((d.total / maxCount) * 100) : 0,
          donePct: d.total > 0 ? Math.round((d.done / d.total) * 100) : 0,
          progPct: d.total > 0 ? Math.round((d.inProgress / d.total) * 100) : 0,
        })),
        totalDone: days.reduce((sum, d) => sum + d.done, 0),
        totalProg: days.reduce((sum, d) => sum + d.inProgress, 0),
        totalScope: deadlines.length
      }
    }

    if (timeRange === '30D') {
      const weeks = []
      for (let i = 4; i >= 0; i--) {
        const start = new Date(nowDate)
        start.setDate(nowDate.getDate() - (i * 7 + 6))
        start.setHours(0, 0, 0, 0)
        
        const end = new Date(nowDate)
        end.setDate(nowDate.getDate() - (i * 7))
        end.setHours(23, 59, 59, 999)

        const startFmt = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const endFmt = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

        const doneTasks = deadlines.filter(t => {
          if (t.status !== 'done') return false
          const d = new Date(t.completedAt || t.completed_at || t.dueDate || t.due_date || t.createdAt)
          return d >= start && d <= end
        })

        const inProgTasks = deadlines.filter(t => {
          if (t.status !== 'in_progress') return false
          const d = new Date(t.dueDate || t.due_date || t.createdAt)
          return d >= start && d <= end
        })

        weeks.push({
          label: i === 0 ? 'Now' : `W${5 - i}`,
          title: `${startFmt} – ${endFmt}`,
          done: doneTasks.length,
          inProgress: inProgTasks.length,
          total: doneTasks.length + inProgTasks.length,
          isCurrent: i === 0
        })
      }

      const maxCount = Math.max(1, ...weeks.map(w => w.total))
      return {
        subtitle: 'completed / assigned per week',
        bars: weeks.map(w => ({
          ...w,
          heightPct: w.total > 0 ? Math.round((w.total / maxCount) * 100) : 0,
          donePct: w.total > 0 ? Math.round((w.done / w.total) * 100) : 0,
          progPct: w.total > 0 ? Math.round((w.inProgress / w.total) * 100) : 0,
        })),
        totalDone: weeks.reduce((sum, w) => sum + w.done, 0),
        totalProg: weeks.reduce((sum, w) => sum + w.inProgress, 0),
        totalScope: deadlines.length
      }
    }

    // 90D: 3-month breakdown
    const months = []
    for (let i = 2; i >= 0; i--) {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1)
      const monthName = d.toLocaleString('default', { month: 'short' })
      const fullMonthName = d.toLocaleString('default', { month: 'long', year: 'numeric' })
      const start = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1)
      const end = new Date(nowDate.getFullYear(), nowDate.getMonth() - i + 1, 0, 23, 59, 59)

      const doneTasks = deadlines.filter(t => {
        if (t.status !== 'done') return false
        const dt = new Date(t.completedAt || t.completed_at || t.dueDate || t.due_date || t.createdAt)
        return dt >= start && dt <= end
      })

      const inProgTasks = deadlines.filter(t => {
        if (t.status !== 'in_progress') return false
        const dt = new Date(t.dueDate || t.due_date || t.createdAt)
        return dt >= start && dt <= end
      })

      months.push({
        label: i === 0 ? 'This Mo' : monthName,
        title: fullMonthName,
        done: doneTasks.length,
        inProgress: inProgTasks.length,
        total: doneTasks.length + inProgTasks.length,
        isCurrent: i === 0
      })
    }

    const maxCount = Math.max(1, ...months.map(m => m.total))
    return {
      subtitle: 'completed / assigned per month',
      bars: months.map(m => ({
        ...m,
        heightPct: m.total > 0 ? Math.round((m.total / maxCount) * 100) : 0,
        donePct: m.total > 0 ? Math.round((m.done / m.total) * 100) : 0,
        progPct: m.total > 0 ? Math.round((m.inProgress / m.total) * 100) : 0,
      })),
      totalDone: months.reduce((sum, m) => sum + m.done, 0),
      totalProg: months.reduce((sum, m) => sum + m.inProgress, 0),
      totalScope: deadlines.length
    }
  }, [deadlines, timeRange])

  const isAdmin = workspaceRole === 'owner' || workspaceRole === 'admin'
  const activeWf = getWorkflowById(workspace?.settings?.agile_workflow || 'scrum')

  const userFirstName = useMemo(() => {
    if (user?.displayName) return user.displayName.split(' ')[0]
    if (user?.email) {
      const prefix = user.email.split('@')[0]
      return prefix.charAt(0).toUpperCase() + prefix.slice(1)
    }
    return 'there'
  }, [user])

  const activeHoverItem = hoveredIndex !== null ? velocityData.bars[hoveredIndex] : null

  return (
    <div className="dash-root">
      {/* ── 1. STICKY TOP NAV ── */}
      <nav className="dash-sticky-nav">
        <div className="dash-container dash-nav-inner">
          <Link to={`/${workspaceId}`} className="dash-nav-brand">
            <span className="dash-logo-name">SprintOS</span>
            <span className="dash-env-tag">{(workspace?.name || 'TEST').toUpperCase()}</span>
          </Link>

          <NavTabs />

          <div className="dash-nav-actions">
            <NotificationBell currentUser={user} />
            <UserMenu />
          </div>
        </div>
      </nav>

      {/* ── MAIN BODY ── */}
      <main className="dash-container" style={{ paddingBottom: '48px' }}>
        
        {/* ── HEADER ROW ── */}
        <header className="dash-page-header">
          <div className="dash-header-inner">
            <div className="dash-header-left">
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

        {/* ── 3. STAT STRIP ── */}
        <section className="dash-stat-strip">
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

        {/* ── 4. TWO-COLUMN ROW: VELOCITY & MILESTONES (WITH RICH TOOLTIPS) ── */}
        <section className="dash-two-col">
          {/* Left: Task Velocity Card */}
          <div className="dash-surface-card dash-chart-panel" style={{ position: 'relative' }}>
            <div className="dash-panel-header">
              <div>
                <div className="dash-panel-title">Task velocity</div>
                <div className="dash-panel-desc">
                  {activeHoverItem
                    ? `${activeHoverItem.title}: ${activeHoverItem.done} completed, ${activeHoverItem.inProgress} in progress`
                    : velocityData.subtitle}
                </div>
              </div>
              <div className="dash-range-pills">
                <button
                  type="button"
                  className={`dash-range-btn${timeRange === '7D' ? ' active' : ''}`}
                  onClick={() => { setTimeRange('7D'); setHoveredIndex(null); }}
                >
                  7D
                </button>
                <button
                  type="button"
                  className={`dash-range-btn${timeRange === '30D' ? ' active' : ''}`}
                  onClick={() => { setTimeRange('30D'); setHoveredIndex(null); }}
                >
                  30D
                </button>
                <button
                  type="button"
                  className={`dash-range-btn${timeRange === '90D' ? ' active' : ''}`}
                  onClick={() => { setTimeRange('90D'); setHoveredIndex(null); }}
                >
                  90D
                </button>
              </div>
            </div>

            {/* Dynamic Velocity Canvas with Floating Tooltip */}
            <div style={{ height: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingTop: '10px', position: 'relative' }}>
              
              {/* Floating Tooltip Box */}
              {activeHoverItem && (
                <div style={{
                  position: 'absolute',
                  top: '-8px',
                  left: `${((hoveredIndex + 0.5) / velocityData.bars.length) * 100}%`,
                  transform: 'translateX(-50%)',
                  background: '#1C1D2B',
                  color: '#FFFFFF',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  zIndex: 20,
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '3px', marginBottom: '3px' }}>
                    {activeHoverItem.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ color: '#A3A5C2' }}>Completed:</span>
                    <strong style={{ color: '#10B981' }}>{activeHoverItem.done}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ color: '#A3A5C2' }}>In Progress:</span>
                    <strong style={{ color: '#3D6FD6' }}>{activeHoverItem.inProgress}</strong>
                  </div>
                </div>
              )}

              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: '8px',
                borderBottom: '2px solid #4F46E5',
                paddingBottom: '8px',
                height: '100%'
              }}>
                {velocityData.bars.map((bar, idx) => {
                  const hasTasks = bar.total > 0
                  const isHovered = hoveredIndex === idx
                  return (
                    <div
                      key={idx}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        height: '100%',
                        justifyContent: 'flex-end',
                        cursor: 'pointer',
                        background: isHovered ? 'rgba(79, 70, 229, 0.06)' : 'transparent',
                        borderRadius: '6px 6px 0 0',
                        transition: 'background 0.15s ease',
                        padding: '0 2px'
                      }}
                    >
                      {hasTasks ? (
                        <div style={{
                          width: '100%',
                          maxWidth: '36px',
                          height: `${Math.max(16, bar.heightPct)}%`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          transform: isHovered ? 'scaleY(1.05)' : 'scaleY(1)',
                          transition: 'transform 0.15s ease, height 0.3s ease'
                        }}>
                          {bar.done > 0 && (
                            <div style={{
                              width: '100%',
                              height: `${bar.donePct}%`,
                              background: '#4F46E5',
                              borderRadius: '3px 3px 0 0',
                              boxShadow: isHovered ? '0 0 8px rgba(79, 70, 229, 0.5)' : 'none'
                            }} />
                          )}
                          {bar.inProgress > 0 && (
                            <div style={{
                              width: '100%',
                              height: `${bar.progPct}%`,
                              background: '#3D6FD6',
                              borderRadius: bar.done === 0 ? '3px 3px 0 0' : '0'
                            }} />
                          )}
                        </div>
                      ) : (
                        <div style={{
                          width: '100%',
                          maxWidth: '36px',
                          height: isHovered ? '8px' : (bar.isCurrent ? '4px' : '0px'),
                          background: isHovered ? 'rgba(79, 70, 229, 0.4)' : (bar.isCurrent ? '#4F46E5' : 'transparent'),
                          borderRadius: '2px 2px 0 0',
                          transition: 'all 0.15s ease'
                        }} />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Day / Period Labels */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', padding: '0 4px' }}>
                {velocityData.bars.map((bar, idx) => {
                  const isHovered = hoveredIndex === idx
                  return (
                    <span
                      key={idx}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        fontSize: '11px',
                        color: isHovered ? '#4F46E5' : (bar.isCurrent ? '#4F46E5' : '#A3A5C2'),
                        fontFamily: 'var(--font-mono)',
                        fontWeight: isHovered || bar.isCurrent ? 700 : 500,
                        cursor: 'pointer'
                      }}
                    >
                      {bar.label}
                    </span>
                  )
                })}
              </div>
            </div>

            {/* Legend with Real Dynamic Scope */}
            <div style={{ display: 'flex', gap: '18px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--muted)', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4F46E5' }}></span>
                Completed ({velocityData.totalDone})
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--muted)', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3D6FD6' }}></span>
                In Progress ({velocityData.totalProg})
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--muted)', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}></span>
                Total Scope ({velocityData.totalScope})
              </div>
            </div>
          </div>

          {/* Right: Sprints Card with Mini Deadline Cards */}
          <div className="dash-surface-card" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', minHeight: '340px' }}>
            {!currentDisplaySprint ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', height: '100%', padding: '24px 0', margin: 'auto' }}>
                <div className="dash-milestone-icon" style={{ width: '46px', height: '46px', borderRadius: '14px', marginBottom: '14px' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4" width="18" height="16" rx="3" stroke="var(--accent)" strokeWidth="1.7"/>
                    <path d="M8 9h8M8 13h5" stroke="var(--accent)" strokeWidth="1.7" strokeLinecap="round"/>
                    <circle cx="19" cy="19" r="4" fill="var(--accent)"/>
                    <path d="M19 17v2l1 1" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="dash-milestone-title" style={{ fontSize: '15px' }}>No upcoming Sprints</div>
                <div className="dash-milestone-desc" style={{ fontSize: '12.5px', marginBottom: '18px', maxWidth: '280px' }}>
                  You're all caught up! Create a Sprint to start tracking important dates and keep your sprint on schedule.
                </div>
                {canAddKanbanItems && (
                  <button
                    type="button"
                    className="dash-btn-accent"
                    style={{ borderRadius: '10px', padding: '8px 20px', fontSize: '12.5px' }}
                    onClick={() => setShowNewSprintModal(true)}
                  >
                    + Create Sprint
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px' }}>
                {/* Sprint Header & Selector */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-soft)', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.2px' }}>
                      Sprint {currentDisplaySprint.number}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '100px',
                      background: currentDisplaySprint.status === 'active' ? 'rgba(16, 185, 129, 0.12)' : 'var(--surface-2)',
                      color: currentDisplaySprint.status === 'active' ? '#059669' : 'var(--muted)',
                      border: `1px solid ${currentDisplaySprint.status === 'active' ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-soft)'}`,
                      textTransform: 'uppercase'
                    }}>
                      {currentDisplaySprint.status === 'active' ? '⚡ Active' : currentDisplaySprint.status}
                    </span>

                    {sprints.length > 1 && (
                      <select
                        value={currentDisplaySprint.id}
                        onChange={(e) => setSelectedSprintViewId(e.target.value)}
                        style={{
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-soft)',
                          background: 'var(--surface-2)',
                          color: 'var(--text)',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {sprints.map(s => (
                          <option key={s.id} value={s.id}>
                            Sprint {s.number} ({s.status})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {canAddKanbanItems && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => setShowNewSprintModal(true)}
                      style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border-soft)' }}
                      title="Create a new sprint"
                    >
                      + New Sprint
                    </button>
                  )}
                </div>

                {/* Sprint Goal & Date Timeline */}
                <div>
                  {currentDisplaySprint.goal && (
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
                      "{currentDisplaySprint.goal}"
                    </div>
                  )}
                  <div style={{ fontSize: '11.5px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📅</span>
                    <span>
                      {currentDisplaySprint.start_date ? new Date(currentDisplaySprint.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Start'}
                      {' – '}
                      {currentDisplaySprint.end_date ? new Date(currentDisplaySprint.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'End'}
                    </span>
                  </div>
                </div>

                {/* Execution Progress Bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 600, color: 'var(--muted)', marginBottom: '5px' }}>
                    <span>Sprint Execution</span>
                    <span>{sprintStats.done} of {sprintStats.total} done ({sprintStats.pct}%)</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--surface-2)', borderRadius: '100px', overflow: 'hidden', border: '1px solid var(--border-soft)' }}>
                    <div style={{
                      height: '100%',
                      width: `${sprintStats.pct}%`,
                      background: 'linear-gradient(90deg, #4F46E5 0%, #10B981 100%)',
                      borderRadius: '100px',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>

                {/* Small Deadline Cards Section */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Assigned Deadlines ({sprintDeadlines.length})
                    </span>
                    {canAddKanbanItems && (
                      <button
                        type="button"
                        onClick={() => setShowNewModal(true)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent, #4F46E5)',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '2px 4px'
                        }}
                      >
                        + Add Deadline
                      </button>
                    )}
                  </div>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '7px',
                    maxHeight: '145px',
                    overflowY: 'auto',
                    paddingRight: '4px'
                  }}>
                    {sprintDeadlines.length === 0 ? (
                      <div style={{
                        padding: '14px 12px',
                        textAlign: 'center',
                        fontSize: '12px',
                        color: 'var(--muted)',
                        background: 'var(--surface-2)',
                        borderRadius: '8px',
                        border: '1px dashed var(--border-soft)'
                      }}>
                        No deadlines assigned to Sprint {currentDisplaySprint.number} yet.
                      </div>
                    ) : (
                      sprintDeadlines.map(d => {
                        const statusColors = {
                          not_started: '#1C1D2B',
                          in_progress: '#3D6FD6',
                          review: '#C4791A',
                          blocked: '#D14343',
                          done: '#10B981'
                        }
                        const dotColor = statusColors[d.status] || '#4F46E5'
                        const assigneeName = d.assigneeName || (d.assigneeEmail ? d.assigneeEmail.split('@')[0] : 'Unassigned')

                        return (
                          <div
                            key={d.id}
                            style={{
                              background: 'var(--surface-2)',
                              border: '1px solid var(--border-soft)',
                              borderRadius: '8px',
                              padding: '7px 10px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.title}>
                                {d.title}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                              <span style={{ fontSize: '10.5px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                                {assigneeName}
                              </span>
                              <span className={`dash-badge-priority ${d.priority || 'medium'}`} style={{ fontSize: '9.5px', padding: '1px 5px' }}>
                                {d.priority || 'medium'}
                              </span>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── 5. CONTROLS BAR ── */}
        <section className="dash-controls-bar">
          <div className="dash-controls-left">
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
            >
              {generatingReport ? 'Generating…' : '↓ Report'}
            </button>
            {canAddKanbanItems && (
              <button
                type="button"
                className="dash-btn-accent"
                style={{ padding: '8px 16px', fontSize: '12.5px', borderRadius: '10px' }}
                onClick={() => setShowNewModal(true)}
              >
                + New Deadline
              </button>
            )}
          </div>
        </section>

        {/* ── 6. MAIN BOARD + SIDEBAR ── */}
        <div className="dash-main-columns">
          <div className="dash-board-area">
            {viewMode === 'board' ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, minmax(180px, 1fr))',
                gap: '14px',
                alignItems: 'start',
                overflowX: 'auto',
                paddingBottom: '8px'
              }}>
                {kanbanColumns.map(col => (
                  <div key={col.id} className="dash-surface-card" style={{ overflow: 'hidden' }}>
                    <div style={{
                       padding: '16px 18px 14px',
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'space-between',
                       borderBottom: '1px solid var(--border-soft)'
                     }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color, flexShrink: 0 }} />
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

                    <div style={{
                      padding: '20px 14px',
                      minHeight: '160px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: col.items.length === 0 ? 'center' : 'flex-start',
                      textAlign: 'center'
                    }}>
                      {col.items.length === 0 ? (
                        <div>
                          <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
                            {col.id === 'not_started' && 'Nothing queued'}
                            {col.id === 'in_progress' && 'Nothing in flight'}
                            {col.id === 'review' && 'Nothing to review'}
                            {col.id === 'blocked' && 'No blockers 🎉'}
                            {col.id === 'done' && 'Ship your first task'}
                          </div>
                        </div>
                      ) : (
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {col.items.map(d => (
                            <DeadlineCard
                              key={d.id}
                              deadline={d}
                              currentUser={user}
                              teamId={TEAM_ID}
                              sprintLocked={!!(d.sprintId && sprints.find(s => s.id === d.sprintId)?.locked)}
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
                {filtered.length === 0 ? (
                  <div className="dash-empty-list">No deadlines match these filters.</div>
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

            {hasMore && (
              <div className="dash-load-more" style={{ marginTop: '20px' }}>
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

          {/* Sidebar */}
          <aside className="dash-sidebar-area">
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
          sprints={sprints}
          onClose={() => setShowNewModal(false)}
        />
      )}

      {/* New Sprint Modal */}
      {showNewSprintModal && (
        <NewSprintModal
          currentUser={user}
          existingCount={sprints.length}
          members={members}
          onClose={() => setShowNewSprintModal(false)}
        />
      )}
    </div>
  )
}
