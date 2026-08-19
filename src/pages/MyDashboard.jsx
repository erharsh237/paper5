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
  const [adminScope, setAdminScope] = useState('team') // 'team' | 'mine'
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState(null)
  const [showTour, setShowTour] = useState(false)
  const [viewMode, setViewMode] = useState('list')
  const [timeRange, setTimeRange] = useState('7D')
  const [hoveredIndex, setHoveredIndex] = useState(null)
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
    const email = user?.email
    if (!uid && !email) return
    const forceTour = window.location.search.includes('tour=true')
    if (forceTour) {
      setShowTour(true)
      try {
        const url = new URL(window.location.href)
        url.searchParams.delete('tour')
        window.history.replaceState({}, '', url.toString())
      } catch (_) {}
      return
    }
    let cancelled = false
    hasSeenTour(uid, email).then(seen => {
      if (!cancelled && !seen) setShowTour(true)
    })
    return () => { cancelled = true }
  }, [user])

  const myEmail = (user?.email || '').trim().toLowerCase()
  const myUid = user?.id || user?.uid
  const myName = (user?.displayName || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '').trim().toLowerCase()
  const activeSprint = useMemo(() => sprints.find(s => s.status === 'active'), [sprints])

  const myTasks = useMemo(
    () => deadlines.filter(d => {
      const dEmail = (d.assigneeEmail || '').trim().toLowerCase()
      const dName = (d.assigneeName || '').trim().toLowerCase()
      const emailMatch = dEmail && myEmail && (dEmail === myEmail || dEmail.includes(myEmail) || myEmail.includes(dEmail))
      const idMatch = d.assigneeId && myUid && (d.assigneeId === myUid)
      const nameMatch = myName && dName && (dName === myName || (dName.includes(myName) && myName.length > 2))
      return emailMatch || idMatch || nameMatch
    }),
    [deadlines, myEmail, myUid, myName]
  )

  // For Admins, default to whole team scope. For members, display their assigned tasks.
  const displayTasks = useMemo(() => {
    if (isAdmin) {
      return adminScope === 'mine' ? myTasks : deadlines
    }
    return myTasks
  }, [isAdmin, adminScope, myTasks, deadlines])

  const filteredTasks = useMemo(() => {
    return displayTasks.filter(d => {
      if (selectedPeriodFilter && Array.isArray(selectedPeriodFilter.taskIds)) {
        if (!selectedPeriodFilter.taskIds.includes(d.id)) return false
      }
      if (search.trim() && !d.title?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [displayTasks, search, selectedPeriodFilter])

  const stats = useMemo(() => {
    const active = displayTasks.filter(d => d.status !== 'done')
    const overdue = active.filter(d => getUrgency(d.dueDate, d.status) === 'overdue')
    const dueSoon = active.filter(d => ['critical', 'warn'].includes(getUrgency(d.dueDate, d.status)))
    const done = displayTasks.filter(d => d.status === 'done' || d.status === 'completed' || d.status === 'shipped')
    const blocked = displayTasks.filter(d => d.status === 'blocked')
    return { total: displayTasks.length, active: active.length, overdue: overdue.length, dueSoon: dueSoon.length, done: done.length, blocked: blocked.length }
  }, [displayTasks])

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
  }, [filteredTasks])

  // 5 Canonical Kanban Columns
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
        items = sortedTasks.filter(d => d.status === 'not_started' || d.status === 'todo')
      } else if (col.id === 'in_progress') {
        items = sortedTasks.filter(d => d.status === 'in_progress')
      } else if (col.id === 'review') {
        items = sortedTasks.filter(d => d.status === 'review' || d.status === 'qa')
      } else if (col.id === 'blocked') {
        items = sortedTasks.filter(d => d.status === 'blocked')
      } else if (col.id === 'done') {
        items = sortedTasks.filter(d => d.status === 'done' || d.status === 'completed' || d.status === 'shipped')
      }
      return { ...col, items }
    })
  }, [sortedTasks])

  // ── REAL DATA VELOCITY CALCULATION (7D / 30D / 90D) ──
  const velocityData = useMemo(() => {
    const now = new Date()
    const isDone = t => t.status === 'done' || t.status === 'completed' || t.status === 'shipped'
    const isInProg = t => t.status === 'in_progress' || t.status === 'review' || t.status === 'qa' || t.status === 'blocked'
    const isScheduled = t => !isDone(t)

    if (timeRange === '7D') {
      const currentDayIdx = now.getDay() // 0 = Sun
      const monday = new Date(now)
      const diffToMonday = (currentDayIdx === 0 ? -6 : 1 - currentDayIdx)
      monday.setDate(now.getDate() + diffToMonday)
      monday.setHours(0, 0, 0, 0)

      const days = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        const dateStr = d.toISOString().slice(0, 10)
        const dayLabel = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]
        const fullDateFormatted = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

        const doneTasks = displayTasks.filter(t => {
          if (!isDone(t)) return false
          const compDate = (t.completedAt || t.completed_at || t.dueDate || t.due_date || t.createdAt || '').slice(0, 10)
          return compDate === dateStr
        })

        const activeTasks = displayTasks.filter(t => {
          if (!isScheduled(t)) return false
          const taskDate = (t.dueDate || t.due_date || t.createdAt || '').slice(0, 10)
          return taskDate === dateStr
        })

        const combinedTasks = [...doneTasks, ...activeTasks]

        days.push({
          label: dayLabel,
          dateStr,
          title: fullDateFormatted,
          done: doneTasks.length,
          inProgress: activeTasks.length,
          total: combinedTasks.length,
          tasks: combinedTasks,
          taskIds: combinedTasks.map(t => t.id),
          isCurrent: d.toDateString() === now.toDateString()
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
        totalDone: displayTasks.filter(isDone).length,
        totalProg: displayTasks.filter(isInProg).length,
        totalScope: displayTasks.length
      }
    }

    if (timeRange === '30D') {
      const weeks = []
      for (let i = 4; i >= 0; i--) {
        const start = new Date(now)
        start.setDate(now.getDate() - (i * 7 + 6))
        start.setHours(0, 0, 0, 0)
        
        const end = new Date(now)
        end.setDate(now.getDate() - (i * 7))
        end.setHours(23, 59, 59, 999)

        const startFmt = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const endFmt = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

        const doneTasks = displayTasks.filter(t => {
          if (!isDone(t)) return false
          const d = new Date(t.completedAt || t.completed_at || t.dueDate || t.due_date || t.createdAt)
          return d >= start && d <= end
        })

        const activeTasks = displayTasks.filter(t => {
          if (!isScheduled(t)) return false
          const d = new Date(t.dueDate || t.due_date || t.createdAt)
          return d >= start && d <= end
        })

        const combinedTasks = [...doneTasks, ...activeTasks]

        weeks.push({
          label: i === 0 ? 'Now' : `W${5 - i}`,
          title: `${startFmt} – ${endFmt}`,
          done: doneTasks.length,
          inProgress: activeTasks.length,
          total: combinedTasks.length,
          tasks: combinedTasks,
          taskIds: combinedTasks.map(t => t.id),
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
        totalDone: displayTasks.filter(isDone).length,
        totalProg: displayTasks.filter(isInProg).length,
        totalScope: displayTasks.length
      }
    }

    // 90D: 3-month breakdown
    const months = []
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthName = d.toLocaleString('default', { month: 'short' })
      const fullMonthName = d.toLocaleString('default', { month: 'long', year: 'numeric' })
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)

      const doneTasks = displayTasks.filter(t => {
        if (!isDone(t)) return false
        const dt = new Date(t.completedAt || t.completed_at || t.dueDate || t.due_date || t.createdAt)
        return dt >= start && dt <= end
      })

      const activeTasks = displayTasks.filter(t => {
        if (!isScheduled(t)) return false
        const dt = new Date(t.dueDate || t.due_date || t.createdAt)
        return dt >= start && dt <= end
      })

      const combinedTasks = [...doneTasks, ...activeTasks]

      months.push({
        label: i === 0 ? 'This Mo' : monthName,
        title: fullMonthName,
        done: doneTasks.length,
        inProgress: activeTasks.length,
        total: combinedTasks.length,
        tasks: combinedTasks,
        taskIds: combinedTasks.map(t => t.id),
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
      totalDone: displayTasks.filter(isDone).length,
      totalProg: displayTasks.filter(isInProg).length,
      totalScope: displayTasks.length
    }
  }, [displayTasks, timeRange])

  // User First Name
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
      {/* ─────────────────────────────────────────────────────────────
           1. STICKY TOP NAV
      ───────────────────────────────────────────────────────────── */}
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

      {/* ─────────────────────────────────────────────────────────────
           MAIN DASHBOARD BODY
      ───────────────────────────────────────────────────────────── */}
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

        {/* ── 4. TWO-COLUMN ROW: VELOCITY & REPOSITORIES (RICH HOVER TOOLTIPS) ── */}
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

            {/* Interactive Velocity Canvas with Tooltip */}
            <div style={{ height: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingTop: '10px', position: 'relative' }}>
              
              {/* Floating Tooltip Box */}
              {activeHoverItem && (
                <div style={{
                  position: 'absolute',
                  top: '-14px',
                  left: `${((hoveredIndex + 0.5) / velocityData.bars.length) * 100}%`,
                  transform: 'translate(-50%, -100%)',
                  background: '#1C1D2B',
                  color: '#FFFFFF',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  fontSize: '11.5px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  zIndex: 30,
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  minWidth: '160px',
                  maxWidth: '240px'
                }}>
                  <div style={{ fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '4px', marginBottom: '2px' }}>
                    {activeHoverItem.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ color: '#A3A5C2' }}>Completed:</span>
                    <strong style={{ color: '#10B981' }}>{activeHoverItem.done}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ color: '#A3A5C2' }}>In Progress / Sched:</span>
                    <strong style={{ color: '#3D6FD6' }}>{activeHoverItem.inProgress}</strong>
                  </div>

                  {activeHoverItem.tasks?.length > 0 && (
                    <div style={{
                      marginTop: '4px',
                      paddingTop: '4px',
                      borderTop: '1px dashed rgba(255,255,255,0.15)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px'
                    }}>
                      {activeHoverItem.tasks.slice(0, 3).map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: t.status === 'done' ? '#10B981' : '#3D6FD6', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                        </div>
                      ))}
                      {activeHoverItem.tasks.length > 3 && (
                        <div style={{ fontSize: '10px', color: '#A3A5C2' }}>
                          +{activeHoverItem.tasks.length - 3} more
                        </div>
                      )}
                      <div style={{ fontSize: '10.5px', color: '#818CF8', fontWeight: 600, marginTop: '2px', textAlign: 'center' }}>
                        Click bar to filter tasks ↓
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Bars and Interactive Columns */}
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
                  const isSelected = selectedPeriodFilter?.title === bar.title
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedPeriodFilter(isSelected ? null : bar)}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      title={`Click to filter tasks for ${bar.title}`}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        height: '100%',
                        justifyContent: 'flex-end',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(79, 70, 229, 0.14)' : (isHovered ? 'rgba(79, 70, 229, 0.06)' : 'transparent'),
                        borderRadius: '6px 6px 0 0',
                        border: isSelected ? '1px dashed #4F46E5' : '1px solid transparent',
                        transition: 'all 0.15s ease',
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
                          transform: isHovered || isSelected ? 'scaleY(1.05)' : 'scaleY(1)',
                          transition: 'transform 0.15s ease, height 0.3s ease'
                        }}>
                          {bar.done > 0 && (
                            <div style={{
                              width: '100%',
                              height: `${bar.donePct}%`,
                              background: '#4F46E5',
                              borderRadius: '3px 3px 0 0',
                              boxShadow: isHovered || isSelected ? '0 0 8px rgba(79, 70, 229, 0.5)' : 'none'
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
                  const isSelected = selectedPeriodFilter?.title === bar.title
                  return (
                    <span
                      key={idx}
                      onClick={() => setSelectedPeriodFilter(isSelected ? null : bar)}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        fontSize: '11px',
                        color: isSelected ? '#4F46E5' : (isHovered ? '#4F46E5' : (bar.isCurrent ? '#4F46E5' : '#A3A5C2')),
                        fontFamily: 'var(--font-mono)',
                        fontWeight: isSelected || isHovered || bar.isCurrent ? 700 : 500,
                        cursor: 'pointer'
                      }}
                    >
                      {bar.label}
                    </span>
                  )
                })}
              </div>
            </div>

            {/* Legend with Real Counts */}
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
              {githubRepos.length > 0 ? (
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
                    {githubRepos.length} Connected {githubRepos.length === 1 ? 'Repository' : 'Repositories'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                    {githubRepos.map(r => r.replace(/^https?:\/\/github\.com\//, '')).join(', ')}
                  </div>
                </div>
              ) : (
                isAdmin
                  ? 'No repositories connected yet. Link GitHub to see commits and PRs against your tasks.'
                  : 'No repositories connected yet. Ask your workspace admin to connect GitHub repos in Integrations.'
              )}
            </div>

            {isAdmin && (
              <Link to={`/${workspaceId}/integrations`} className="dash-btn-accent" style={{ textDecoration: 'none', padding: '9px 24px', borderRadius: '10px' }}>
                {githubRepos.length > 0 ? 'Manage GitHub' : 'Connect GitHub'}
              </Link>
            )}
          </div>
        </section>

        {/* ── 5. TASKS HEADER & VIEW SWITCHER ── */}
        <section style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>
                {isAdmin ? (adminScope === 'team' ? 'Team Deadlines' : 'My Assigned Tasks') : 'My Assigned Tasks'}
              </h2>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', color: 'var(--muted-2, #A3A5C2)' }}>
                {sortedTasks.length} total
              </span>
            </div>

            {/* If Admin, show Whole Team / Assigned to Me toggle */}
            {isAdmin && (
              <div style={{
                display: 'inline-flex',
                gap: '2px',
                background: 'var(--surface-2, #EEF0F9)',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid var(--border-soft, #E2E8F0)'
              }}>
                <button
                  type="button"
                  onClick={() => setAdminScope('team')}
                  style={{
                    border: 'none',
                    background: adminScope === 'team' ? '#FFFFFF' : 'transparent',
                    color: adminScope === 'team' ? 'var(--accent, #4F46E5)' : 'var(--muted, #64748B)',
                    fontWeight: adminScope === 'team' ? 700 : 500,
                    fontSize: '11.5px',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: adminScope === 'team' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Whole Team
                </button>
                <button
                  type="button"
                  onClick={() => setAdminScope('mine')}
                  style={{
                    border: 'none',
                    background: adminScope === 'mine' ? '#FFFFFF' : 'transparent',
                    color: adminScope === 'mine' ? 'var(--accent, #4F46E5)' : 'var(--muted, #64748B)',
                    fontWeight: adminScope === 'mine' ? 700 : 500,
                    fontSize: '11.5px',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: adminScope === 'mine' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Assigned to Me
                </button>
              </div>
            )}
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

        {/* Active Filter Banner when velocity bar clicked */}
        {selectedPeriodFilter && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(79, 70, 229, 0.08)',
            border: '1px solid rgba(79, 70, 229, 0.25)',
            borderRadius: '10px',
            padding: '10px 16px',
            marginBottom: '16px',
            fontSize: '13px',
            color: 'var(--accent, #4F46E5)',
            fontWeight: 600
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🔍 Filtered by Velocity Timeline:</span>
              <span style={{ color: 'var(--text)', fontWeight: 700 }}>{selectedPeriodFilter.title}</span>
              <span style={{
                background: '#4F46E5',
                color: '#FFFFFF',
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '100px'
              }}>
                {sortedTasks.length} task{sortedTasks.length === 1 ? '' : 's'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPeriodFilter(null)}
              style={{
                background: 'rgba(79, 70, 229, 0.15)',
                border: 'none',
                color: 'var(--accent, #4F46E5)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '12px',
                padding: '4px 10px',
                borderRadius: '6px'
              }}
            >
              Clear Filter ✕
            </button>
          </div>
        )}

        {/* ── 6. 5 KANBAN COLUMNS WITH REAL DATA ── */}
        {viewMode === 'board' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(270px, 1fr))',
            gap: '14px',
            alignItems: 'start',
            overflowX: 'auto',
            paddingBottom: '12px',
            WebkitOverflowScrolling: 'touch'
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

                {/* Body with real tasks or empty state */}
                <div style={{
                  padding: '14px 10px',
                  minHeight: '160px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: col.items.length === 0 ? 'center' : 'stretch',
                  justifyContent: col.items.length === 0 ? 'center' : 'flex-start',
                  textAlign: col.items.length === 0 ? 'center' : 'left'
                }}>
                  {col.items.length === 0 ? (
                    <div>
                      <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
                        {col.emptyText}
                      </div>
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
            {sortedTasks.length === 0 ? (
              <div className="dash-empty-list">
                {isAdmin && adminScope === 'team' ? 'No deadlines in workspace yet.' : 'No tasks assigned to you yet.'}
              </div>
            ) : (
              sortedTasks.map(d => (
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
