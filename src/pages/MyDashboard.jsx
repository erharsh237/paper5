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

// Catmull-Rom spline path generator for smooth golden wave curve
function getSmoothSplinePath(points) {
  if (!points || points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

export default function MyDashboard() {
  const { workspaceId, workspace, workspaceRole } = useWorkspace()
  const isAdmin = workspaceRole === 'owner' || workspaceRole === 'admin'
  const { user } = useAuth()
  const { deadlines, hasMore, loadMore, loadingMore } = useDeadlines(workspaceId)
  const [sprints, setSprints] = useState([])
  const [adminScope, setAdminScope] = useState('team') // 'team' | 'mine'
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState(null)
  const [laneFilter, setLaneFilter] = useState(null) // null | 'todo' | 'in_progress' | 'dueSoon' | 'done'
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
  const activeSprint = useMemo(() => sprints.find(s => s.status === 'active') || sprints[0], [sprints])

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
      // Period filter from velocity chart
      if (selectedPeriodFilter && Array.isArray(selectedPeriodFilter.taskIds)) {
        if (!selectedPeriodFilter.taskIds.includes(d.id)) return false
      }
      // Lane filter from Sprint Lanes shelf
      if (laneFilter === 'todo') {
        if (d.status !== 'not_started' && d.status !== 'todo') return false
      } else if (laneFilter === 'in_progress') {
        if (d.status !== 'in_progress' && d.status !== 'review') return false
      } else if (laneFilter === 'dueSoon') {
        if (!['critical', 'warn'].includes(getUrgency(d.dueDate, d.status))) return false
      } else if (laneFilter === 'done') {
        if (d.status !== 'done' && d.status !== 'completed' && d.status !== 'shipped') return false
      }
      // Search filter
      if (search.trim() && !d.title?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [displayTasks, search, selectedPeriodFilter, laneFilter])

  const stats = useMemo(() => {
    const active = displayTasks.filter(d => d.status !== 'done')
    const overdue = active.filter(d => getUrgency(d.dueDate, d.status) === 'overdue')
    const dueSoon = active.filter(d => ['critical', 'warn'].includes(getUrgency(d.dueDate, d.status)))
    const done = displayTasks.filter(d => d.status === 'done' || d.status === 'completed' || d.status === 'shipped')
    const blocked = displayTasks.filter(d => d.status === 'blocked')
    return {
      total: displayTasks.length,
      active: active.length,
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      done: done.length,
      blocked: blocked.length
    }
  }, [displayTasks])

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
  }, [filteredTasks])

  // 5 Canonical Kanban Columns
  const kanbanColumns = useMemo(() => {
    const standardCols = [
      { id: 'not_started', title: 'To Do', dotColor: '#1e293b', emptyText: 'Nothing queued', showAdd: true },
      { id: 'in_progress', title: 'In Progress', dotColor: '#3b82f6', emptyText: 'Nothing in flight', showAdd: false },
      { id: 'review', title: 'Review / QA', dotColor: '#f59e0b', emptyText: 'Nothing to review', showAdd: false },
      { id: 'blocked', title: 'Blocked', dotColor: '#ef4444', emptyText: 'No blockers 🎉', showAdd: false },
      { id: 'done', title: 'Done', dotColor: '#10b981', emptyText: 'Ship your first task', showAdd: false },
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

  // Velocity Calculation (7D / 30D / 90D)
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
        const dayLabel = `0${i + 1}`
        const dayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]
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
          dayName,
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
        subtitle: 'Completed vs assigned per day',
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
          label: i === 0 ? 'Now' : `W0${5 - i}`,
          dayName: `Week ${5 - i}`,
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
        subtitle: 'Weekly sprint delivery velocity',
        bars: weeks.map(w => ({
          ...w,
          heightPct: w.total > 0 ? Math.round((w.total / maxCount) * 100) : 0,
          donePct: w.total > 0 ? Math.round((d.done / d.total) * 100) : 0,
          progPct: w.total > 0 ? Math.round((d.inProgress / d.total) * 100) : 0,
        })),
        totalDone: displayTasks.filter(isDone).length,
        totalProg: displayTasks.filter(isInProg).length,
        totalScope: displayTasks.length
      }
    }

    // 90D Breakdown
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
        label: `M0${3 - i}`,
        dayName: monthName,
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
      subtitle: 'Quarterly sprint execution',
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

  // Golden Wave Chart Spline Points
  const splineChartData = useMemo(() => {
    const bars = velocityData.bars
    if (!bars || bars.length === 0) return { splinePath: '', areaPath: '', points: [] }

    const maxVal = Math.max(1, ...bars.map(b => b.total))
    // Natural subtle rhythm curve for when data is zero/low
    const baseCurve = [78, 55, 70, 52, 65, 45, 38]

    const points = bars.map((b, idx) => {
      const x = 20 + idx * (500 / Math.max(1, bars.length - 1))
      let y = baseCurve[idx % baseCurve.length]
      if (b.total > 0) {
        y = 105 - (b.total / maxVal) * 75
      }
      return { x, y, bar: b, idx }
    })

    const splinePath = getSmoothSplinePath(points)
    const lastX = points[points.length - 1].x
    const firstX = points[0].x
    const areaPath = `${splinePath} L ${lastX} 130 L ${firstX} 130 Z`

    return { splinePath, areaPath, points }
  }, [velocityData])

  // Team Contributors Breakdown
  const contributors = useMemo(() => {
    const map = new Map()
    displayTasks.forEach(t => {
      const key = t.assigneeEmail || t.assigneeName || 'Unassigned'
      if (!map.has(key)) {
        map.set(key, {
          name: t.assigneeName || (t.assigneeEmail ? t.assigneeEmail.split('@')[0] : 'Team Member'),
          role: t.assigneeEmail ? `@${t.assigneeEmail.split('@')[0]}` : 'Engineer',
          total: 0,
          done: 0
        })
      }
      const item = map.get(key)
      item.total++
      if (t.status === 'done' || t.status === 'completed' || t.status === 'shipped') {
        item.done++
      }
    })

    const list = Array.from(map.values())
    if (list.length === 0) {
      return [
        { name: user?.displayName || user?.email?.split('@')[0] || 'Erharsh237', role: '@lead · Owner', pct: '100%', done: stats.done, total: stats.total },
        { name: 'Sprint CI/CD', role: '@automations', pct: '85%', done: 0, total: 0 }
      ]
    }

    const totalTasks = Math.max(1, displayTasks.length)
    return list.slice(0, 3).map(c => ({
      name: c.name,
      role: c.role,
      pct: `${Math.round((c.total / totalTasks) * 100)}%`,
      done: c.done,
      total: c.total
    }))
  }, [displayTasks, user, stats])

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
  const getPath = (path) => `/${workspaceId}${path === '/' ? '' : path}`

  const scrollToDeliverables = () => {
    const el = document.getElementById('deliverables-board')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="sprint-dash-root">
      {/* ─────────────────────────────────────────────────────────────
           1. STICKY TOP NAV
      ───────────────────────────────────────────────────────────── */}
      <nav className="dash-sticky-nav">
        <div className="dash-container dash-nav-inner">
          <Link to={getPath('/')} className="dash-nav-brand">
            <span className="dash-logo-name">Paper5</span>
            <span className="dash-env-tag">{(workspace?.name || 'TEST').toUpperCase()}</span>
          </Link>

          <NavTabs />

          <div className="dash-nav-actions">
            <NotificationBell currentUser={user} />
            <UserMenu />
            <Link to={getPath('/settings')} className="dash-nav-btn-icon" title="Workspace Settings" style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          </div>
        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────────────
           MAIN DASHBOARD CONTAINER
      ───────────────────────────────────────────────────────────── */}
      <main className="sprint-dash-container">

        {/* ── 1. HEADER ROW: GREETING & CONCENTRIC ARC GAUGE CARD ── */}
        <section className="sprint-header-row">
          <div className="sprint-header-left">
            <div>
              <div className="sprint-welcome-meta">
                <span className="sprint-role-badge">
                  {workspaceRole === 'owner' ? 'Workspace Owner' : (isAdmin ? 'Workspace Admin' : 'Team Member')}
                </span>
                <span className="sprint-active-pill">
                  {activeSprint?.name ? `Active: ${activeSprint.name}` : 'Sprint 1 · In Flight'}
                </span>
              </div>
              <h1 className="sprint-greeting-title">
                Welcome back, <span>{userFirstName}</span>
              </h1>
            </div>

            {/* Quick Search */}
            <div className="sprint-search-row">
              <div className="sprint-search-wrap">
                <svg className="sprint-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="sprint-search-input"
                  placeholder="Search tasks, sprints, repos, assignees..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <kbd className="sprint-search-kbd">⌘K</kbd>
              </div>
            </div>
          </div>

          {/* Top Right: Arc Gauge Card (Dribbble Design Reference) */}
          <div className="sprint-arc-card">
            <div className="sprint-arc-info">
              <span className="sprint-arc-tag">⚡ Sprint Health</span>
              <h3 className="sprint-arc-title">
                {activeSprint?.name || 'Sprint Velocity'}
              </h3>
              <p className="sprint-arc-sub">
                {stats.done} of {stats.total} delivered
              </p>
            </div>

            {/* Concentric Semi-Circular Arc Gauges */}
            <div className="sprint-arc-gauge-wrap">
              <svg viewBox="0 0 150 90" style={{ width: '135px', height: '80px', overflow: 'visible' }}>
                {/* Outer Scope Arc (Pastel Cyan) */}
                <path
                  d="M 12 80 A 62 62 0 0 1 138 80"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {/* Middle In-Progress Arc (Warm Peach) */}
                <path
                  d="M 26 80 A 48 48 0 0 1 124 80"
                  fill="none"
                  stroke="#fb923c"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {/* Inner Completed Arc (Indigo) */}
                <path
                  d="M 40 80 A 34 34 0 0 1 110 80"
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
              </svg>

              {/* Central Action Button */}
              <button
                type="button"
                className="sprint-arc-button"
                onClick={() => setShowNewModal(true)}
                title="Create New Task"
              >
                + TASK
              </button>
            </div>
          </div>
        </section>

        {/* ── 2. METRIC STRIP (4 MODERN KPI CARDS) ── */}
        <section className="sprint-kpi-grid">
          {/* ACTIVE */}
          <div className="sprint-kpi-card" onClick={() => setLaneFilter(laneFilter === 'in_progress' ? null : 'in_progress')}>
            <div className="sprint-kpi-head">
              <span className="sprint-kpi-label">Active</span>
              <span className="sprint-kpi-dot" style={{ background: '#3b82f6' }} />
            </div>
            <div className="sprint-kpi-val">{stats.active}</div>
            <div className="sprint-kpi-sub">
              <span>{stats.active === 0 ? 'No active tasks' : 'In flight this week'}</span>
            </div>
          </div>

          {/* OVERDUE */}
          <div className="sprint-kpi-card" onClick={() => setLaneFilter(laneFilter === 'dueSoon' ? null : 'dueSoon')}>
            <div className="sprint-kpi-head">
              <span className="sprint-kpi-label">Overdue</span>
              <span className="sprint-kpi-dot" style={{ background: '#ef4444' }} />
            </div>
            <div className="sprint-kpi-val">{stats.overdue}</div>
            <div className="sprint-kpi-sub" style={{ color: stats.overdue === 0 ? '#10b981' : '#ef4444' }}>
              <span>{stats.overdue === 0 ? '✓ Scope on schedule' : 'Requires attention'}</span>
            </div>
          </div>

          {/* DUE SOON */}
          <div className="sprint-kpi-card" onClick={() => setLaneFilter(laneFilter === 'dueSoon' ? null : 'dueSoon')}>
            <div className="sprint-kpi-head">
              <span className="sprint-kpi-label">Due Soon</span>
              <span className="sprint-kpi-dot" style={{ background: '#f59e0b' }} />
            </div>
            <div className="sprint-kpi-val">{stats.dueSoon}</div>
            <div className="sprint-kpi-sub">
              <span>Next 48 hours</span>
            </div>
          </div>

          {/* COMPLETED */}
          <div className="sprint-kpi-card" onClick={() => setLaneFilter(laneFilter === 'done' ? null : 'done')}>
            <div className="sprint-kpi-head">
              <span className="sprint-kpi-label">Completed</span>
              <span className="sprint-kpi-dot" style={{ background: '#10b981' }} />
            </div>
            <div className="sprint-kpi-val">{stats.done}</div>
            <div className="sprint-kpi-sub" style={{ color: '#10b981' }}>
              <span>Delivered this sprint</span>
            </div>
          </div>
        </section>

        {/* ── 3. MIDDLE SECTION: VELOCITY GOLDEN SPLINE + TOP CONTRIBUTORS ── */}
        <section className="sprint-middle-grid">
          {/* Left: Task Velocity Card */}
          <div className="sprint-velocity-card">
            <div className="sprint-chart-header">
              <div>
                <h3 className="sprint-chart-title">Task Velocity & Activity</h3>
                <p className="sprint-chart-sub">
                  {activeHoverItem
                    ? `${activeHoverItem.title}: ${activeHoverItem.done} completed, ${activeHoverItem.inProgress} active`
                    : velocityData.subtitle}
                </p>
              </div>

              {/* Time Range Pills */}
              <div className="sprint-range-pills">
                <button
                  type="button"
                  className={`sprint-range-btn${timeRange === '7D' ? ' active' : ''}`}
                  onClick={() => { setTimeRange('7D'); setHoveredIndex(null); }}
                >
                  7D
                </button>
                <button
                  type="button"
                  className={`sprint-range-btn${timeRange === '30D' ? ' active' : ''}`}
                  onClick={() => { setTimeRange('30D'); setHoveredIndex(null); }}
                >
                  30D
                </button>
                <button
                  type="button"
                  className={`sprint-range-btn${timeRange === '90D' ? ' active' : ''}`}
                  onClick={() => { setTimeRange('90D'); setHoveredIndex(null); }}
                >
                  90D
                </button>
              </div>
            </div>

            {/* Smooth Spline SVG Chart */}
            <div className="sprint-svg-area">
              <div className="sprint-y-axis">
                <span>40k</span>
                <span>30k</span>
                <span>20k</span>
                <span>10k</span>
                <span>0k</span>
              </div>

              {/* Peak Floating Tooltip Badge */}
              <div className="sprint-peak-tooltip">
                <div className="sprint-tooltip-val">
                  {stats.active > 0 || stats.done > 0
                    ? `${stats.active + stats.done} Active Scope`
                    : 'Sprint Target On Track'}
                </div>
                <div className="sprint-tooltip-sub">
                  {activeSprint?.name || 'Sprint Velocity'}
                </div>
              </div>

              <div className="sprint-svg-wrapper">
                <svg
                  viewBox="0 0 540 120"
                  preserveAspectRatio="none"
                  className="sprint-svg-element"
                >
                  <defs>
                    <linearGradient id="sprintWaveGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.30" />
                      <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Area fill beneath spline */}
                  {splineChartData.areaPath && (
                    <path
                      d={splineChartData.areaPath}
                      fill="url(#sprintWaveGrad)"
                    />
                  )}

                  {/* Golden Wave Stroke */}
                  {splineChartData.splinePath && (
                    <path
                      d={splineChartData.splinePath}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Interactive points on the curve */}
                  {splineChartData.points.map((pt, idx) => (
                    <circle
                      key={idx}
                      cx={pt.x}
                      cy={pt.y}
                      r={hoveredIndex === idx ? 6 : 4}
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth="2"
                      style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      onClick={() => setSelectedPeriodFilter(selectedPeriodFilter?.title === pt.bar.title ? null : pt.bar)}
                    />
                  ))}
                </svg>
              </div>

              {/* X-Axis Labels */}
              <div className="sprint-x-axis">
                {velocityData.bars.map((bar, idx) => {
                  const isSel = selectedPeriodFilter?.title === bar.title
                  return (
                    <span
                      key={idx}
                      className={isSel ? 'selected' : ''}
                      onClick={() => setSelectedPeriodFilter(isSel ? null : bar)}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      {bar.dayName || bar.label}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right: Top Contributors & GitHub Sync */}
          <div className="sprint-performers-card">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 className="sprint-performers-title">Top Contributors</h3>
                <Link to={getPath('/team')} style={{ fontSize: '12px', color: '#4f46e5', fontWeight: 700, textDecoration: 'none' }}>
                  View All ›
                </Link>
              </div>
              <p className="sprint-performers-sub">Velocity share this sprint</p>
            </div>

            <div className="sprint-performers-list">
              {contributors.map((c, i) => (
                <div key={i} className="sprint-performer-row">
                  <div className="sprint-performer-info">
                    <div className="sprint-performer-avatar">
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="sprint-performer-name">{c.name}</h4>
                      <p className="sprint-performer-role">{c.role}</p>
                    </div>
                  </div>
                  <div className="sprint-performer-metric">
                    <div className="sprint-performer-pct">{c.pct}</div>
                    <div className="sprint-performer-sub">{c.done} shipped</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Repositories / GitHub Sync Box */}
            <div className="sprint-github-sync-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#475569' }}>
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/>
                </svg>
                <span className="sprint-github-text">
                  {githubRepos.length > 0 ? `${githubRepos.length} Repos synced` : 'GitHub PR Sync'}
                </span>
              </div>
              <Link to={getPath('/integrations')} className="sprint-github-btn">
                {githubRepos.length > 0 ? 'Manage ›' : 'Connect ›'}
              </Link>
            </div>
          </div>
        </section>

        {/* ── 4. SPRINT LANES SHELF (ADAPTED FROM DRIBBBLE CHANNELS CONTAINER) ── */}
        <section className="sprint-lanes-shelf">
          <div className="sprint-lanes-intro">
            <h3 className="sprint-lanes-heading">Sprint Lanes</h3>
            <p className="sprint-lanes-desc">
              Live status across current iteration workstreams.
            </p>
          </div>

          <div className="sprint-lanes-deck">
            {/* Card 1: Queued / Backlog */}
            <div
              className={`sprint-lane-pill${laneFilter === 'todo' ? ' active' : ''}`}
              onClick={() => setLaneFilter(laneFilter === 'todo' ? null : 'todo')}
              title="Click to filter To Do items"
            >
              <div className="sprint-lane-icon" style={{ background: '#f1f5f9', color: '#1e293b' }}>📋</div>
              <h4 className="sprint-lane-title">Queued</h4>
              <p className="sprint-lane-sub">Backlog</p>
              <span className="sprint-lane-stat">{stats.total - stats.active - stats.done > 0 ? stats.total - stats.active - stats.done : 0}</span>
            </div>

            {/* Card 2: In Flight */}
            <div
              className={`sprint-lane-pill${laneFilter === 'in_progress' ? ' active' : ''}`}
              onClick={() => setLaneFilter(laneFilter === 'in_progress' ? null : 'in_progress')}
              title="Click to filter In Progress items"
            >
              <div className="sprint-lane-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}>⚡</div>
              <h4 className="sprint-lane-title">In Flight</h4>
              <p className="sprint-lane-sub">Active tasks</p>
              <span className="sprint-lane-stat">{stats.active}</span>
            </div>

            {/* Card 3: Due Soon / Attention */}
            <div
              className={`sprint-lane-pill${laneFilter === 'dueSoon' ? ' active' : ''}`}
              onClick={() => setLaneFilter(laneFilter === 'dueSoon' ? null : 'dueSoon')}
              title="Click to filter Due Soon items"
            >
              <div className="sprint-lane-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}>⏳</div>
              <h4 className="sprint-lane-title">Due Soon</h4>
              <p className="sprint-lane-sub">Next 48h</p>
              <span className="sprint-lane-stat" style={{ color: stats.dueSoon > 0 ? '#d97706' : '#0f172a' }}>
                {stats.dueSoon}
              </span>
            </div>

            {/* Card 4: Shipped / Done */}
            <div
              className={`sprint-lane-pill${laneFilter === 'done' ? ' active' : ''}`}
              onClick={() => setLaneFilter(laneFilter === 'done' ? null : 'done')}
              title="Click to filter Completed items"
            >
              <div className="sprint-lane-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>🚀</div>
              <h4 className="sprint-lane-title">Shipped</h4>
              <p className="sprint-lane-sub">Delivered</p>
              <span className="sprint-lane-stat" style={{ color: '#10b981' }}>{stats.done}</span>
            </div>

            {/* Card 5: Full Board Button */}
            <button
              type="button"
              className="sprint-full-board-btn"
              onClick={scrollToDeliverables}
              title="Jump to Deliverables Board"
            >
              <div className="sprint-full-board-title">Full<br />Board</div>
              <div className="sprint-full-board-icon">›</div>
            </button>
          </div>
        </section>

        {/* ── 5. DELIVERABLES BOARD SECTION (KANBAN & LIST) ── */}
        <section id="deliverables-board" className="sprint-board-section">
          <div className="sprint-board-header">
            <div className="sprint-board-title-group">
              <h2 className="sprint-board-title">
                {isAdmin ? (adminScope === 'team' ? 'Team Deadlines' : 'My Assigned Tasks') : 'My Assigned Tasks'}
              </h2>
              <span className="sprint-board-count">{sortedTasks.length} total</span>

              {isAdmin && (
                <div className="sprint-scope-pills">
                  <button
                    type="button"
                    className={`sprint-scope-btn${adminScope === 'team' ? ' active' : ''}`}
                    onClick={() => setAdminScope('team')}
                  >
                    Whole Team
                  </button>
                  <button
                    type="button"
                    className={`sprint-scope-btn${adminScope === 'mine' ? ' active' : ''}`}
                    onClick={() => setAdminScope('mine')}
                  >
                    Assigned to Me
                  </button>
                </div>
              )}
            </div>

            {/* Kanban / List Toggle */}
            <div className="sprint-view-mode-toggle">
              <button
                type="button"
                className={`sprint-view-btn${viewMode === 'board' ? ' active' : ''}`}
                onClick={() => setViewMode('board')}
              >
                <span>☷</span> Kanban
              </button>
              <button
                type="button"
                className={`sprint-view-btn${viewMode === 'list' ? ' active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                <span>☰</span> List
              </button>
            </div>
          </div>

          {/* Active Filter Banner */}
          {(selectedPeriodFilter || laneFilter) && (
            <div className="sprint-filter-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🔍 Filter Applied:</span>
                <span style={{ fontWeight: 800 }}>
                  {selectedPeriodFilter ? selectedPeriodFilter.title : `Lane: ${laneFilter}`}
                </span>
                <span style={{ background: '#2563eb', color: '#ffffff', fontSize: '11px', padding: '2px 8px', borderRadius: '100px' }}>
                  {sortedTasks.length} task{sortedTasks.length === 1 ? '' : 's'}
                </span>
              </div>
              <button
                type="button"
                className="sprint-filter-clear-btn"
                onClick={() => { setSelectedPeriodFilter(null); setLaneFilter(null); }}
              >
                Clear Filter ✕
              </button>
            </div>
          )}

          {/* Kanban Board View */}
          {viewMode === 'board' ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, minmax(260px, 1fr))',
              gap: '14px',
              alignItems: 'start',
              overflowX: 'auto',
              paddingBottom: '12px',
              WebkitOverflowScrolling: 'touch'
            }}>
              {kanbanColumns.map(col => (
                <div key={col.id} className="dash-surface-card" style={{ overflow: 'hidden' }}>
                  {/* Column Header */}
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

                  {/* Tasks Column Body */}
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
                      <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
                        {col.emptyText}
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
        </section>
      </main>

      {/* New Task Modal */}
      {showNewModal && (
        <NewDeadlineModal
          teamId={workspaceId || 'default-team'}
          members={[]}
          currentUser={user}
          activeSprint={activeSprint}
          onClose={() => setShowNewModal(false)}
        />
      )}

      {/* Interactive Tour */}
      {showTour && (
        <SiteTour currentUser={user} onFinish={() => setShowTour(false)} />
      )}
    </div>
  )
}
