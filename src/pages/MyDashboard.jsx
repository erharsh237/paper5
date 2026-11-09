import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useDeadlines } from '../lib/useDeadlines'
import { subscribeSprints } from '../lib/sprints'
import { getUrgency } from '../lib/utils'
import { hasSeenTour } from '../lib/onboarding'
import DeadlineCard from '../components/DeadlineCard'
import NotificationBell from '../components/NotificationBell'
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

  // Real Data Velocity Calculation (7D / 30D / 90D)
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
        subtitle: 'Data updates in real-time',
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
        subtitle: 'Weekly velocity aggregation',
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
      subtitle: 'Quarterly velocity breakdown',
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

  // User presentation names
  const userFirstName = useMemo(() => {
    if (user?.displayName) return user.displayName.split(' ')[0]
    if (user?.email) {
      const prefix = user.email.split('@')[0]
      return prefix.charAt(0).toUpperCase() + prefix.slice(1)
    }
    return 'there'
  }, [user])

  const userFullName = useMemo(() => {
    if (user?.displayName) return user.displayName
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name
    if (user?.email) {
      const prefix = user.email.split('@')[0]
      return prefix.charAt(0).toUpperCase() + prefix.slice(1)
    }
    return 'Workspace Admin'
  }, [user])

  const userInitials = useMemo(() => {
    const raw = user?.displayName || user?.user_metadata?.full_name || user?.email || 'ER'
    const parts = raw.split(/[\s@._]+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return raw.slice(0, 2).toUpperCase()
  }, [user])

  const activeHoverItem = hoveredIndex !== null ? velocityData.bars[hoveredIndex] : null

  // Helper for workspace navigation links
  const getPath = (path) => `/${workspaceId}${path === '/' ? '' : path}`

  const scrollToDeliverables = () => {
    const el = document.getElementById('deliverables-board')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="mydash-page-bg">
      <div className="mydash-shell-card">
        {/* ─────────────────────────────────────────────────────────────
             1. LEFT SIDEBAR (WARM IVORY #FCF8F2)
        ───────────────────────────────────────────────────────────── */}
        <aside className="mydash-sidebar">
          <div className="mydash-sidebar-top">
            {/* Brand Logo with 4 colored dots */}
            <Link to={getPath('/')} className="mydash-brand">
              <div className="mydash-dots">
                <span className="mydash-dot-1" />
                <span className="mydash-dot-2" />
                <span className="mydash-dot-3" />
                <span className="mydash-dot-4" />
              </div>
              <span className="mydash-brand-name">Paper5</span>
              <span className="mydash-env-pill">{(workspace?.name || 'TEST').toUpperCase()}</span>
            </Link>

            {/* Profile badge with avatar & role */}
            <div className="mydash-profile">
              <div className="mydash-avatar-wrap">
                {user?.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="Profile" className="mydash-avatar-img" />
                ) : (
                  <div className="mydash-avatar-initials">{userInitials}</div>
                )}
              </div>
              <h3 className="mydash-profile-name">{userFullName}</h3>
              <p className="mydash-profile-role">
                {workspaceRole === 'owner' ? 'Workspace Owner' : (isAdmin ? 'Workspace Admin' : 'Product Lead')}
              </p>
            </div>

            {/* Vertical Navigation Links */}
            <nav className="mydash-nav">
              <Link to={getPath('/')} className="mydash-nav-item active">
                <span>Dashboard</span>
                <span className="mydash-badge-pill">{stats.active || 1}</span>
              </Link>
              <Link to={getPath('/workflow')} className="mydash-nav-item">
                <span>Workflow</span>
              </Link>
              <Link to={getPath('/team')} className="mydash-nav-item">
                <span>Team</span>
              </Link>
              <Link to={getPath('/meeting')} className="mydash-nav-item">
                <span>Meeting</span>
              </Link>
              <Link to={getPath('/analytics')} className="mydash-nav-item">
                <span>Analytics</span>
              </Link>
            </nav>
          </div>

          {/* Sidebar Footer with Notification, User Menu & Settings */}
          <div className="mydash-sidebar-footer">
            <NotificationBell currentUser={user} />
            <UserMenu />
            <Link to={getPath('/settings')} className="mydash-gear-btn" title="Workspace Settings">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          </div>
        </aside>

        {/* ─────────────────────────────────────────────────────────────
             2. MAIN CONTENT CANVAS (EDITORIAL WHITE CANVAS)
        ───────────────────────────────────────────────────────────── */}
        <main className="mydash-main-content">
          {/* ── TOP ROW: TITLE + SEARCH + KPI STRIP + ARC GAUGE CARD ── */}
          <div className="mydash-top-row">
            <div className="mydash-top-left">
              <div className="mydash-title-row">
                <h1 className="mydash-heading">Dashboard</h1>
                <span className="mydash-action-badge">1</span>
                <Link to={getPath('/settings')} className="mydash-gear-btn" title="Settings">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </Link>
              </div>

              {/* Search Bar with ⌘K */}
              <div className="mydash-search-wrap">
                <svg className="mydash-search-icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  className="mydash-search-input"
                  type="text"
                  placeholder="Search tasks, repos, people..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <kbd className="mydash-search-kbd">⌘K</kbd>
              </div>

              {/* KPI Strip */}
              <div className="mydash-kpi-strip">
                <div className="mydash-kpi-unit">
                  <div className="mydash-kpi-label">
                    <span>Active</span>
                    <span className="mydash-dot-blue" />
                  </div>
                  <div className="mydash-kpi-value">{stats.active}</div>
                </div>

                <div className="mydash-kpi-unit">
                  <div className="mydash-kpi-label">
                    <span>Overdue</span>
                    <span className="mydash-dot-red" />
                  </div>
                  <div className="mydash-kpi-value">{stats.overdue}</div>
                </div>

                <div className="mydash-kpi-unit">
                  <div className="mydash-kpi-label">
                    <span>Due Soon</span>
                    <span className="mydash-dot-orange" />
                  </div>
                  <div className="mydash-kpi-value">{stats.dueSoon}</div>
                </div>

                <div className="mydash-kpi-unit">
                  <div className="mydash-kpi-label">
                    <span>Completed</span>
                    <span className="mydash-dot-green" />
                  </div>
                  <div className="mydash-kpi-value">{stats.done}</div>
                </div>
              </div>
            </div>

            {/* Top Right: Arc Gauge Card ("Upgrade Your Crowd" / Sprint Velocity) */}
            <div className="mydash-arc-card">
              <div className="mydash-arc-left">
                <div className="mydash-arc-badge">⚡</div>
                <h4 className="mydash-arc-title">Upgrade Your Crowd</h4>
                <p className="mydash-arc-sub">
                  {activeSprint?.name ? `Sprint: ${activeSprint.name}` : 'Pro plan for better results'}
                </p>
              </div>

              {/* Concentric Arc Gauges */}
              <div className="mydash-arc-wrap">
                <svg viewBox="0 0 140 85" style={{ width: '130px', height: '80px', overflow: 'visible' }}>
                  {/* Outer pastel teal arc */}
                  <path
                    d="M 12 75 A 58 58 0 0 1 128 75"
                    fill="none"
                    stroke="#7dd3fc"
                    strokeWidth="9"
                    strokeLinecap="round"
                  />
                  {/* Middle warm peach arc */}
                  <path
                    d="M 26 75 A 44 44 0 0 1 114 75"
                    fill="none"
                    stroke="#fdba74"
                    strokeWidth="9"
                    strokeLinecap="round"
                  />
                  {/* Inner dark charcoal arc */}
                  <path
                    d="M 40 75 A 30 30 0 0 1 100 75"
                    fill="none"
                    stroke="#334155"
                    strokeWidth="9"
                    strokeLinecap="round"
                  />
                </svg>

                {/* Central Action Button */}
                <button
                  type="button"
                  className="mydash-arc-button"
                  onClick={() => setShowNewModal(true)}
                  title="Add New Task"
                >
                  + TASK
                </button>
              </div>
            </div>
          </div>

          {/* ── MIDDLE ROW: ACTIVITY GOLDEN WAVE CHART + TOP PERFORMERS ── */}
          <div className="mydash-middle-grid">
            {/* Left: Activity Chart */}
            <div className="mydash-activity-col">
              <div className="mydash-activity-header">
                <h3 className="mydash-activity-title">Activity</h3>
                <div className="mydash-activity-meta">
                  <span className="mydash-activity-subtext">{velocityData.subtitle}</span>
                  <div className="mydash-range-tabs">
                    <button
                      type="button"
                      className={`mydash-range-btn${timeRange === '7D' ? ' active' : ''}`}
                      onClick={() => { setTimeRange('7D'); setHoveredIndex(null); }}
                    >
                      01-07 May ⌵
                    </button>
                    <button
                      type="button"
                      className={`mydash-range-btn${timeRange === '30D' ? ' active' : ''}`}
                      onClick={() => { setTimeRange('30D'); setHoveredIndex(null); }}
                    >
                      30D
                    </button>
                    <button
                      type="button"
                      className={`mydash-range-btn${timeRange === '90D' ? ' active' : ''}`}
                      onClick={() => { setTimeRange('90D'); setHoveredIndex(null); }}
                    >
                      90D
                    </button>
                  </div>
                </div>
              </div>

              {/* Golden Wave Spline Chart with Floating Tooltip */}
              <div className="mydash-chart-container">
                {/* Y-Axis Labels */}
                <div className="mydash-y-axis">
                  <span>40k</span>
                  <span>30k</span>
                  <span>20k</span>
                  <span>10k</span>
                  <span>0 k</span>
                </div>

                {/* Floating Peak Tooltip */}
                <div className="mydash-tooltip-card">
                  <div className="mydash-tooltip-num">
                    {stats.active > 0 || stats.done > 0
                      ? `${stats.active + stats.done} Tasks / active`
                      : '32 210 Views/hour'}
                  </div>
                  <div className="mydash-tooltip-sub">
                    {activeSprint?.name || 'Sprint velocity on target'}
                  </div>
                </div>

                {/* SVG Spline Canvas */}
                <div style={{ marginLeft: '36px', height: '100%', position: 'relative' }}>
                  <svg
                    viewBox="0 0 500 130"
                    preserveAspectRatio="none"
                    className="mydash-svg-canvas"
                  >
                    <defs>
                      <linearGradient id="mydashGoldenGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.32" />
                        <stop offset="70%" stopColor="#f59e0b" stopOpacity="0.08" />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {/* Gradient Area Fill under spline */}
                    <path
                      d="M 15 85 Q 85 40, 160 70 T 320 65 T 410 40 T 485 28 L 485 130 L 15 130 Z"
                      fill="url(#mydashGoldenGrad)"
                    />

                    {/* Golden Spline Stroke */}
                    <path
                      d="M 15 85 Q 85 40, 160 70 T 320 65 T 410 40 T 485 28"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />

                    {/* Peak Point Indicator */}
                    <circle cx="320" cy="65" r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="2.5" />
                    <circle cx="410" cy="40" r="4.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="485" cy="28" r="4.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                  </svg>
                </div>

                {/* X-Axis Labels */}
                <div className="mydash-x-axis">
                  {velocityData.bars.map((bar, idx) => (
                    <span
                      key={idx}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedPeriodFilter(selectedPeriodFilter?.title === bar.title ? null : bar)}
                    >
                      {bar.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Top Performers */}
            <div className="mydash-performers-col">
              <h3 className="mydash-performers-title">Top performers</h3>
              <div className="mydash-performers-list">
                <div className="mydash-performer-row">
                  <div className="mydash-performer-left">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces"
                      alt="Valy Antonova"
                      className="mydash-performer-avatar"
                    />
                    <div className="mydash-performer-info">
                      <h4 className="mydash-performer-name">Valy Antonova</h4>
                      <span className="mydash-performer-handle">@valyantonova</span>
                    </div>
                  </div>
                  <span className="mydash-performer-stat">39%</span>
                </div>

                <div className="mydash-performer-row">
                  <div className="mydash-performer-left">
                    <img
                      src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces"
                      alt="Mark Noil"
                      className="mydash-performer-avatar"
                    />
                    <div className="mydash-performer-info">
                      <h4 className="mydash-performer-name">Mark Noil</h4>
                      <span className="mydash-performer-handle">@marknoil</span>
                    </div>
                  </div>
                  <span className="mydash-performer-stat">18%</span>
                </div>

                <div className="mydash-performer-row">
                  <div className="mydash-performer-left">
                    <img
                      src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces"
                      alt="Nenci Villy"
                      className="mydash-performer-avatar"
                    />
                    <div className="mydash-performer-info">
                      <h4 className="mydash-performer-name">Nenci Villy</h4>
                      <span className="mydash-performer-handle">@nencivilly</span>
                    </div>
                  </div>
                  <span className="mydash-performer-stat">25%</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                <Link to={getPath('/team')} className="mydash-view-more-link">
                  View More ›
                </Link>

                {isAdmin && (
                  <Link
                    to={getPath('/integrations')}
                    style={{ fontSize: '11.5px', color: '#4f46e5', textDecoration: 'none', fontWeight: 700 }}
                  >
                    {githubRepos.length > 0 ? '✓ GitHub Synced' : '+ Connect GitHub'}
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* ── BOTTOM SHELF: CHANNELS (MINT ROUNDED CONTAINER #E3F4EF) ── */}
          <div className="mydash-channels-shelf">
            <div className="mydash-channels-intro">
              <h3 className="mydash-channels-title">Channels</h3>
              <p className="mydash-channels-desc">
                Your channels statistics for 1 week period.
              </p>
            </div>

            <div className="mydash-channels-deck">
              {/* Card 1: Dribbble / Active */}
              <div className="mydash-card-pill" onClick={scrollToDeliverables} title="View Active Tasks">
                <div className="mydash-icon-circle mydash-icon-pink">⚽</div>
                <h4 className="mydash-card-name">Dribble</h4>
                <p className="mydash-card-handle">@grantart</p>
                <span className="mydash-card-stat">+2 %</span>
              </div>

              {/* Card 2: Behance / Overdue */}
              <div className="mydash-card-pill" onClick={scrollToDeliverables} title="View Overdue Tasks">
                <div className="mydash-icon-circle mydash-icon-blue">Bē</div>
                <h4 className="mydash-card-name">Bahance</h4>
                <p className="mydash-card-handle">@grantart</p>
                <span className="mydash-card-stat" style={{ color: stats.overdue > 0 ? '#ef4444' : '#111827' }}>
                  {stats.overdue > 0 ? `-${stats.overdue}%` : '-7 %'}
                </span>
              </div>

              {/* Card 3: Instagram / Due Soon */}
              <div className="mydash-card-pill" onClick={scrollToDeliverables} title="View Due Soon Tasks">
                <div className="mydash-icon-circle mydash-icon-orange">📷</div>
                <h4 className="mydash-card-name">Instagram</h4>
                <p className="mydash-card-handle">@robertgrant</p>
                <span className="mydash-card-stat">+4 %</span>
              </div>

              {/* Card 4: Pinterest / Completed */}
              <div className="mydash-card-pill" onClick={scrollToDeliverables} title="View Completed Tasks">
                <div className="mydash-icon-circle mydash-icon-red">P</div>
                <h4 className="mydash-card-name">Pinterest</h4>
                <p className="mydash-card-handle">@robertgrant</p>
                <span className="mydash-card-stat">+2 %</span>
              </div>

              {/* Card 5: Full Stats Accent Pill */}
              <button
                type="button"
                className="mydash-full-stats-card"
                onClick={scrollToDeliverables}
                title="Scroll to Deliverables Board"
              >
                <div className="mydash-full-stats-title">Full<br />Stats</div>
                <div className="mydash-full-stats-icon">›</div>
              </button>
            </div>
          </div>

          {/* ── DELIVERABLES / TASKS SECTION (KANBAN & LIST) ── */}
          <section id="deliverables-board" className="mydash-deliverables-section">
            <div className="mydash-deliv-header">
              <div className="mydash-deliv-title-group">
                <h2 className="mydash-deliv-title">
                  {isAdmin ? (adminScope === 'team' ? 'Team Deadlines' : 'My Assigned Tasks') : 'My Assigned Tasks'}
                </h2>
                <span className="mydash-deliv-count">{sortedTasks.length} total</span>

                {isAdmin && (
                  <div className="mydash-scope-toggle">
                    <button
                      type="button"
                      className={`mydash-scope-btn${adminScope === 'team' ? ' active' : ''}`}
                      onClick={() => setAdminScope('team')}
                    >
                      Whole Team
                    </button>
                    <button
                      type="button"
                      className={`mydash-scope-btn${adminScope === 'mine' ? ' active' : ''}`}
                      onClick={() => setAdminScope('mine')}
                    >
                      Assigned to Me
                    </button>
                  </div>
                )}
              </div>

              {/* Kanban vs List Switcher */}
              <div className="mydash-view-mode-toggle">
                <button
                  type="button"
                  className={`mydash-view-btn${viewMode === 'board' ? ' active' : ''}`}
                  onClick={() => setViewMode('board')}
                >
                  <span>☷</span> Kanban
                </button>
                <button
                  type="button"
                  className={`mydash-view-btn${viewMode === 'list' ? ' active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  <span>☰</span> List
                </button>
              </div>
            </div>

            {/* Active Timeline Filter banner if clicked */}
            {selectedPeriodFilter && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(244, 91, 86, 0.08)',
                border: '1px solid rgba(244, 91, 86, 0.25)',
                borderRadius: '12px',
                padding: '10px 18px',
                fontSize: '13px',
                color: '#f45b56',
                fontWeight: 600
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🔍 Filtered by Activity Period:</span>
                  <span style={{ color: '#111827', fontWeight: 700 }}>{selectedPeriodFilter.title}</span>
                  <span style={{
                    background: '#f45b56',
                    color: '#ffffff',
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
                    background: 'rgba(244, 91, 86, 0.15)',
                    border: 'none',
                    color: '#f45b56',
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

            {/* View Render: Kanban or List */}
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
      </div>

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

      {/* Site Tour */}
      {showTour && (
        <SiteTour currentUser={user} onFinish={() => setShowTour(false)} />
      )}
    </div>
  )
}
