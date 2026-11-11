import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useDeadlines } from '../lib/useDeadlines'
import { subscribeSprints } from '../lib/sprints'
import { subscribeMembers } from '../lib/deadlines'
import { getUrgency } from '../lib/utils'
import { hasSeenTour } from '../lib/onboarding'
import DeadlineCard from '../components/DeadlineCard'
import NotificationBell from '../components/NotificationBell'
import NavTabs from '../components/NavTabs'
import SiteTour from '../components/SiteTour'
import UserMenu from '../components/UserMenu'
import { useWorkspace } from '../lib/WorkspaceContext'
import { subscribeIntegrationConfig } from '../lib/integrations/config'
import NewDeadlineModal from '../components/NewDeadlineModal'
import './Dashboard.css'
import './MyDashboard.css'

/* ─────────────────────────────────────────────────────────────
   INLINE SVG ICONS
───────────────────────────────────────────────────────────── */
function GitHubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/>
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function SprintIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}

function BoardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M9 3v18"/>
      <path d="M15 3v18"/>
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  )
}

function AdminCrownIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/>
      <circle cx="12" cy="19" r="2"/>
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

export default function MyDashboard() {
  const { workspaceId, workspace, workspaceRole, capacityDetails, canAddKanbanItems } = useWorkspace()
  const isAdmin = workspaceRole === 'owner' || workspaceRole === 'admin'
  const { user } = useAuth()
  const { deadlines, hasMore, loadMore, loadingMore } = useDeadlines(workspaceId)
  const [sprints, setSprints] = useState([])
  const [members, setMembers] = useState([])
  const [adminScope, setAdminScope] = useState('team') // 'team' | 'mine'
  const [memberFilter, setMemberFilter] = useState('all') // 'all' | 'in_progress' | 'due_soon'
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState(null)
  const [showTour, setShowTour] = useState(false)
  const [viewMode, setViewMode] = useState('list') // 'list' | 'board'
  const [timeRange, setTimeRange] = useState('7D') // '7D' | '30D' | '90D'
  const [hoveredPointIndex, setHoveredPointIndex] = useState(null)
  const [search, setSearch] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  const [integrationConfig, setIntegrationConfig] = useState({})

  // Subscribe to sprints
  useEffect(() => {
    return subscribeSprints(workspaceId, undefined, setSprints)
  }, [workspaceId])

  // Subscribe to real workspace members
  useEffect(() => {
    if (!workspaceId) return
    return subscribeMembers(workspaceId, setMembers)
  }, [workspaceId])

  // Subscribe to integrations config (GitHub, GCal, etc.)
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

  // Tour check
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

  // Tasks assigned directly to current user
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

  // Scope determines which pool of tasks to display
  const baseTasks = useMemo(() => {
    if (isAdmin) {
      return adminScope === 'mine' ? myTasks : deadlines
    }
    return myTasks
  }, [isAdmin, adminScope, myTasks, deadlines])

  // Filtered tasks considering period filter, search, and member subfilter
  const filteredTasks = useMemo(() => {
    return baseTasks.filter(d => {
      if (selectedPeriodFilter && Array.isArray(selectedPeriodFilter.taskIds)) {
        if (!selectedPeriodFilter.taskIds.includes(d.id)) return false
      }
      if (!isAdmin) {
        if (memberFilter === 'in_progress' && d.status !== 'in_progress') return false
        if (memberFilter === 'due_soon' && !['critical', 'warn', 'overdue'].includes(getUrgency(d.dueDate, d.status))) return false
      }
      if (search.trim() && !d.title?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [baseTasks, search, selectedPeriodFilter, isAdmin, memberFilter])

  // Real Workspace KPI Metrics
  const stats = useMemo(() => {
    const isDone = d => d.status === 'done' || d.status === 'completed' || d.status === 'shipped'
    const active = deadlines.filter(d => !isDone(d))
    const overdue = active.filter(d => getUrgency(d.dueDate, d.status) === 'overdue')
    const dueSoon = active.filter(d => ['critical', 'warn'].includes(getUrgency(d.dueDate, d.status)))
    const done = deadlines.filter(isDone)
    const blocked = deadlines.filter(d => d.status === 'blocked')
    const completionRate = deadlines.length > 0 ? Math.round((done.length / deadlines.length) * 100) : 0

    return {
      total: deadlines.length,
      active: active.length,
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      done: done.length,
      blocked: blocked.length,
      completionRate
    }
  }, [deadlines])

  // Real Personal KPI Metrics (For Member View)
  const myStats = useMemo(() => {
    const isDone = d => d.status === 'done' || d.status === 'completed' || d.status === 'shipped'
    const active = myTasks.filter(d => !isDone(d))
    const overdue = active.filter(d => getUrgency(d.dueDate, d.status) === 'overdue')
    const dueSoon = active.filter(d => ['critical', 'warn'].includes(getUrgency(d.dueDate, d.status)))
    const done = myTasks.filter(isDone)
    const blocked = myTasks.filter(d => d.status === 'blocked')
    const completionRate = myTasks.length > 0 ? Math.round((done.length / myTasks.length) * 100) : 0

    return {
      total: myTasks.length,
      active: active.length,
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      done: done.length,
      blocked: blocked.length,
      completionRate
    }
  }, [myTasks])

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
    const isScheduled = t => !isDone(t)
    const taskPool = baseTasks

    if (timeRange === '7D') {
      const days = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(now.getDate() - i)
        d.setHours(0, 0, 0, 0)
        const dateStr = d.toISOString().slice(0, 10)
        const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' })
        const fullDateFormatted = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

        const doneTasks = taskPool.filter(t => {
          if (!isDone(t)) return false
          const compDate = (t.completedAt || t.completed_at || t.dueDate || t.due_date || t.createdAt || '').slice(0, 10)
          return compDate === dateStr
        })

        const activeTasks = taskPool.filter(t => {
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
          isCurrent: i === 0
        })
      }

      return {
        subtitle: isAdmin ? 'Team completed vs in-flight tasks per day' : 'My daily task output & schedule',
        bars: days,
        totalDone: taskPool.filter(isDone).length,
        totalScope: taskPool.length
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

        const doneTasks = taskPool.filter(t => {
          if (!isDone(t)) return false
          const d = new Date(t.completedAt || t.completed_at || t.dueDate || t.due_date || t.createdAt)
          return d >= start && d <= end
        })

        const activeTasks = taskPool.filter(t => {
          if (!isScheduled(t)) return false
          const d = new Date(t.dueDate || t.due_date || t.createdAt)
          return d >= start && d <= end
        })

        const combinedTasks = [...doneTasks, ...activeTasks]

        weeks.push({
          label: i === 0 ? 'This Wk' : `W${5 - i}`,
          title: `${startFmt} – ${endFmt}`,
          done: doneTasks.length,
          inProgress: activeTasks.length,
          total: combinedTasks.length,
          tasks: combinedTasks,
          taskIds: combinedTasks.map(t => t.id),
          isCurrent: i === 0
        })
      }

      return {
        subtitle: isAdmin ? 'Team weekly throughput over past 30 days' : 'My weekly output pace over past 30 days',
        bars: weeks,
        totalDone: taskPool.filter(isDone).length,
        totalScope: taskPool.length
      }
    }

    // 90D breakdown
    const months = []
    for (let i = 2; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
      const monthLabel = start.toLocaleString('default', { month: 'short' })
      const fullMonthName = start.toLocaleString('default', { month: 'long', year: 'numeric' })

      const doneTasks = taskPool.filter(t => {
        if (!isDone(t)) return false
        const dt = new Date(t.completedAt || t.completed_at || t.dueDate || t.due_date || t.createdAt)
        return dt >= start && dt <= end
      })

      const activeTasks = taskPool.filter(t => {
        if (!isScheduled(t)) return false
        const dt = new Date(t.dueDate || t.due_date || t.createdAt)
        return dt >= start && dt <= end
      })

      const combinedTasks = [...doneTasks, ...activeTasks]

      months.push({
        label: i === 0 ? 'This Mo' : monthLabel,
        title: fullMonthName,
        done: doneTasks.length,
        inProgress: activeTasks.length,
        total: combinedTasks.length,
        tasks: combinedTasks,
        taskIds: combinedTasks.map(t => t.id),
        isCurrent: i === 0
      })
    }

    return {
      subtitle: isAdmin ? 'Quarterly team velocity trends' : 'My quarterly output pace',
      bars: months,
      totalDone: taskPool.filter(isDone).length,
      totalScope: taskPool.length
    }
  }, [baseTasks, timeRange, isAdmin])

  // ── REAL TEAM CONTRIBUTORS (FOR ADMIN DASHBOARD) ──
  const contributors = useMemo(() => {
    const memberList = members.length > 0 ? members : (
      user ? [{
        userId: user.id || user.uid,
        email: user.email,
        fullName: user.displayName || user.user_metadata?.full_name || user.email?.split('@')[0],
        role: workspaceRole || 'owner'
      }] : []
    )

    const isDone = t => t.status === 'done' || t.status === 'completed' || t.status === 'shipped'
    const totalDone = deadlines.filter(isDone).length

    const list = memberList.map(m => {
      const mEmail = (m.email || '').toLowerCase().trim()
      const mId = m.userId || m.id
      const mName = (m.fullName || m.displayLabel || '').toLowerCase().trim()

      const memberTasks = deadlines.filter(d => {
        const dEmail = (d.assigneeEmail || '').toLowerCase().trim()
        const dId = d.assigneeId
        const dName = (d.assigneeName || '').toLowerCase().trim()
        return (dEmail && mEmail && dEmail === mEmail) || (dId && mId && dId === mId) || (dName && mName && dName === mName)
      })

      const doneCount = memberTasks.filter(isDone).length
      const inProgCount = memberTasks.filter(t => t.status === 'in_progress').length
      const share = totalDone > 0
        ? Math.round((doneCount / totalDone) * 100)
        : (memberTasks.length > 0 ? Math.round((doneCount / memberTasks.length) * 100) : 0)

      const rawName = m.fullName || m.displayLabel || m.email?.split('@')[0] || 'Team Member'
      const initials = (rawName.split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2) || m.email?.slice(0, 2) || 'U').toUpperCase()

      return {
        id: mId,
        name: rawName,
        email: m.email || '',
        handle: `@${(m.email?.split('@')[0] || 'member').toLowerCase()}`,
        role: m.role ? (m.role.charAt(0).toUpperCase() + m.role.slice(1)) : 'Member',
        avatarUrl: m.avatarUrl,
        initials,
        total: memberTasks.length,
        done: doneCount,
        inProgress: inProgCount,
        percentage: share
      }
    })

    return list.sort((a, b) => b.done - a.done || b.total - a.total)
  }, [members, deadlines, user, workspaceRole])

  // ── MY PRIORITY TASKS (FOR MEMBER DASHBOARD) ──
  const memberPriorityTasks = useMemo(() => {
    return myTasks
      .filter(t => t.status !== 'done' && t.status !== 'completed' && t.status !== 'shipped')
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 4)
  }, [myTasks])

  // ── SMOOTH BEZIER SPLINE CURVE CALCULATION ──
  const chartWidth = 620
  const chartHeight = 170
  const padLeft = 45
  const padRight = 45
  const padTop = 30
  const baselineY = 135

  const points = useMemo(() => {
    const bars = velocityData.bars
    if (!bars || bars.length === 0) return []
    const maxVal = Math.max(2, ...bars.map(b => b.total))
    const usableW = chartWidth - padLeft - padRight
    const usableH = baselineY - padTop

    return bars.map((bar, i) => {
      const x = bars.length > 1 ? padLeft + i * (usableW / (bars.length - 1)) : chartWidth / 2
      const y = baselineY - (bar.total / maxVal) * usableH
      return { x: Math.round(x), y: Math.round(y), bar, index: i }
    })
  }, [velocityData.bars])

  const curvePath = useMemo(() => {
    if (points.length === 0) return ''
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
    let d = `M ${points[0].x} ${points[0].y}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[Math.min(points.length - 1, i + 2)]

      const cp1x = p1.x + (p2.x - p0.x) * 0.2
      const cp1y = Math.min(baselineY, Math.max(padTop - 10, p1.y + (p2.y - p0.y) * 0.2))

      const cp2x = p2.x - (p3.x - p1.x) * 0.2
      const cp2y = Math.min(baselineY, Math.max(padTop - 10, p2.y - (p3.y - p1.y) * 0.2))

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x} ${p2.y}`
    }
    return d
  }, [points])

  const areaPath = useMemo(() => {
    if (points.length === 0 || !curvePath) return ''
    const first = points[0]
    const last = points[points.length - 1]
    return `${curvePath} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`
  }, [points, curvePath])

  // Current user first name
  const userFirstName = useMemo(() => {
    if (user?.displayName) return user.displayName.split(' ')[0]
    if (user?.email) {
      const prefix = user.email.split('@')[0]
      return prefix.charAt(0).toUpperCase() + prefix.slice(1)
    }
    return 'there'
  }, [user])

  // Active hover point for the chart
  const activeHoverPoint = hoveredPointIndex !== null ? points[hoveredPointIndex] : null
  const chartAccentColor = isAdmin ? '#F59E0B' : '#4F46E5'

  return (
    <div className="dash-root">
      {/* ─────────────────────────────────────────────────────────────
           1. STICKY TOP NAV
      ───────────────────────────────────────────────────────────── */}
      <nav className="dash-sticky-nav">
        <div className="dash-container dash-nav-inner">
          <Link to={`/${workspaceId}`} className="dash-nav-brand">
            <span className="dash-logo-name">Paper5</span>
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

        {/* ── 2. HEADER ROW (DISTINCT FOR ADMIN VS MEMBER) ── */}
        <header className="dash-page-header">
          <div className="dash-header-inner">
            <div className="dash-header-left">
              {isAdmin ? (
                <div className="dash-badge-admin">
                  <AdminCrownIcon /> WORKSPACE ADMIN
                </div>
              ) : (
                <div className="dash-badge-member">
                  <UserIcon /> TEAM MEMBER
                </div>
              )}
              
              <h1 className="dash-greeting">
                Welcome back, <span>{userFirstName}</span>
              </h1>
              
              <p className="dash-subtitle">
                {isAdmin
                  ? 'Executive Workspace Overview • High-velocity sprint operations & team throughput'
                  : 'Personal Mission Center • Your sprint targets, focus queue & deliverables'}
              </p>
            </div>

            {/* Header Right Actions */}
            <div className="dash-header-actions">
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

              {/* Action Buttons */}
              {(isAdmin || canAddKanbanItems) && (
                <button
                  type="button"
                  onClick={() => setShowNewModal(true)}
                  className="dash-btn-accent"
                >
                  <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span> New Task
                </button>
              )}
            </div>
          </div>
        </header>

        {/* ── 3. 4-CARD STAT STRIP (DISTINCT ADMIN VS MEMBER METRICS) ── */}
        <section className="dash-stat-strip">
          {isAdmin ? (
            /* ADMIN KPI TILES */
            <>
              {/* 1. Team Active Tasks */}
              <div className="dash-stat-col">
                <div className="dash-stat-label-row">
                  <span>TEAM ACTIVE</span>
                  <span className="dash-stat-dot" style={{ background: '#3D6FD6' }}></span>
                </div>
                <div className="dash-stat-value">{stats.active}</div>
                <div className="dash-stat-delta">
                  <span>across {members.length || 1} team member{members.length === 1 ? '' : 's'}</span>
                </div>
              </div>

              {/* 2. Overdue & Critical Blockers */}
              <div className="dash-stat-col">
                <div className="dash-stat-label-row">
                  <span>NEEDS ATTENTION</span>
                  <span className="dash-stat-dot" style={{ background: '#D14343' }}></span>
                </div>
                <div className="dash-stat-value">{stats.overdue + stats.blocked}</div>
                <div className="dash-stat-delta">
                  <span style={{ color: (stats.overdue + stats.blocked) === 0 ? '#10B981' : '#D14343' }}>
                    {(stats.overdue + stats.blocked) === 0 ? '✓ 0 blockers or delays' : `${stats.overdue} overdue, ${stats.blocked} blocked`}
                  </span>
                </div>
              </div>

              {/* 3. Sprint Completion Rate */}
              <div className="dash-stat-col">
                <div className="dash-stat-label-row">
                  <span>COMPLETION RATE</span>
                  <span className="dash-stat-dot" style={{ background: '#10B981' }}></span>
                </div>
                <div className="dash-stat-value">{stats.completionRate}%</div>
                <div className="dash-stat-delta">
                  <span style={{ color: '#10B981' }}>{stats.done} of {stats.total} tasks shipped</span>
                </div>
              </div>

              {/* 4. Active Contributors / Seats */}
              <div className="dash-stat-col">
                <div className="dash-stat-label-row">
                  <span>ACTIVE SEATS</span>
                  <span className="dash-stat-dot" style={{ background: '#7C3AED' }}></span>
                </div>
                <div className="dash-stat-value">{capacityDetails?.totalSeatsUsed || (members.length || 1)}</div>
                <div className="dash-stat-delta">
                  <span>of {typeof capacityDetails?.maxAllowedMembers === 'number' ? capacityDetails.maxAllowedMembers : '∞'} seats used</span>
                </div>
              </div>
            </>
          ) : (
            /* MEMBER KPI TILES */
            <>
              {/* 1. My Active Tasks */}
              <div className="dash-stat-col">
                <div className="dash-stat-label-row">
                  <span>MY ACTIVE TASKS</span>
                  <span className="dash-stat-dot" style={{ background: '#3D6FD6' }}></span>
                </div>
                <div className="dash-stat-value">{myStats.active}</div>
                <div className="dash-stat-delta">
                  <span>assigned directly to you</span>
                </div>
              </div>

              {/* 2. Due Soon */}
              <div className="dash-stat-col">
                <div className="dash-stat-label-row">
                  <span>DUE NEXT 48H</span>
                  <span className="dash-stat-dot" style={{ background: '#F59E0B' }}></span>
                </div>
                <div className="dash-stat-value">{myStats.dueSoon}</div>
                <div className="dash-stat-delta">
                  <span style={{ color: myStats.dueSoon > 0 ? '#F59E0B' : '#10B981' }}>
                    {myStats.dueSoon > 0 ? 'Upcoming deadline focus' : '✓ No urgent deadlines'}
                  </span>
                </div>
              </div>

              {/* 3. Blockers on Me */}
              <div className="dash-stat-col">
                <div className="dash-stat-label-row">
                  <span>MY BLOCKERS</span>
                  <span className="dash-stat-dot" style={{ background: '#D14343' }}></span>
                </div>
                <div className="dash-stat-value">{myStats.blocked}</div>
                <div className="dash-stat-delta">
                  <span style={{ color: myStats.blocked > 0 ? '#D14343' : '#10B981' }}>
                    {myStats.blocked > 0 ? 'Action needed to unblock' : '✓ All clear'}
                  </span>
                </div>
              </div>

              {/* 4. Shipped by Me */}
              <div className="dash-stat-col">
                <div className="dash-stat-label-row">
                  <span>SHIPPED BY ME</span>
                  <span className="dash-stat-dot" style={{ background: '#10B981' }}></span>
                </div>
                <div className="dash-stat-value">{myStats.done}</div>
                <div className="dash-stat-delta">
                  <span style={{ color: '#10B981' }}>{myStats.completionRate}% personal velocity</span>
                </div>
              </div>
            </>
          )}
        </section>

        {/* ── 4. TWO-COLUMN ROW: ACTIVITY CURVE & TOP CONTRIBUTORS / MY PRIORITIES ── */}
        <section className="dash-two-col">
          {/* Left: Interactive Bezier Activity Chart Panel */}
          <div className="dash-surface-card dash-chart-panel">
            <div className="dash-panel-header">
              <div>
                <div className="dash-panel-title">
                  {isAdmin ? 'Engineering Velocity & Throughput' : 'Personal Output & Throughput'}
                </div>
                <div className="dash-panel-desc">{velocityData.subtitle}</div>
              </div>

              {/* Time Range Pills */}
              <div className="dash-range-pills">
                <button
                  type="button"
                  className={`dash-range-btn${timeRange === '7D' ? ' active' : ''}`}
                  onClick={() => { setTimeRange('7D'); setHoveredPointIndex(null); }}
                >
                  7D
                </button>
                <button
                  type="button"
                  className={`dash-range-btn${timeRange === '30D' ? ' active' : ''}`}
                  onClick={() => { setTimeRange('30D'); setHoveredPointIndex(null); }}
                >
                  30D
                </button>
                <button
                  type="button"
                  className={`dash-range-btn${timeRange === '90D' ? ' active' : ''}`}
                  onClick={() => { setTimeRange('90D'); setHoveredPointIndex(null); }}
                >
                  90D
                </button>
              </div>
            </div>

            {/* Interactive SVG Chart */}
            <div style={{ position: 'relative', marginTop: '10px' }}>
              {/* Floating Pill Tooltip on Hover */}
              {activeHoverPoint && (
                <div
                  className="dash-activity-pill"
                  style={{
                    left: `${(activeHoverPoint.x / chartWidth) * 100}%`,
                    top: `${activeHoverPoint.y}px`
                  }}
                >
                  <span className="dash-activity-pill-val">
                    {activeHoverPoint.bar.done} Shipped • {activeHoverPoint.bar.inProgress} In Flight
                  </span>
                  <span className="dash-activity-pill-sub">
                    {activeHoverPoint.bar.title} • Click to filter
                  </span>
                </div>
              )}

              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="dash-activity-svg"
                preserveAspectRatio="none"
              >
                <defs>
                  {/* Subtle Gradient Area Fill under the curve */}
                  <linearGradient id="velocityAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartAccentColor} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={chartAccentColor} stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Baseline Guideline */}
                <line
                  x1={padLeft - 10}
                  y1={baselineY}
                  x2={chartWidth - padRight + 10}
                  y2={baselineY}
                  stroke="#E2E8F0"
                  strokeWidth="1.5"
                />

                {/* Mid-height dashed gridline */}
                <line
                  x1={padLeft - 10}
                  y1={padTop + (baselineY - padTop) / 2}
                  x2={chartWidth - padRight + 10}
                  y2={padTop + (baselineY - padTop) / 2}
                  stroke="#F1F5F9"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />

                {/* Hover Vertical Guideline */}
                {activeHoverPoint && (
                  <line
                    x1={activeHoverPoint.x}
                    y1={padTop}
                    x2={activeHoverPoint.x}
                    y2={baselineY}
                    stroke={chartAccentColor}
                    strokeDasharray="3 3"
                    strokeWidth="1.5"
                  />
                )}

                {/* Gradient Area Polygon */}
                {areaPath && (
                  <path
                    d={areaPath}
                    fill="url(#velocityAreaGradient)"
                  />
                )}

                {/* Smooth Bezier Spline Stroke */}
                {curvePath && (
                  <path
                    d={curvePath}
                    fill="none"
                    stroke={chartAccentColor}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Circular Nodes on Data Points */}
                {points.map((pt, idx) => {
                  const isHovered = hoveredPointIndex === idx
                  const isSelected = selectedPeriodFilter?.title === pt.bar.title
                  return (
                    <g key={idx}>
                      {/* Invisible larger hover target */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="14"
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setHoveredPointIndex(idx)}
                        onMouseLeave={() => setHoveredPointIndex(null)}
                        onClick={() => setSelectedPeriodFilter(isSelected ? null : pt.bar)}
                      />
                      {/* Visible Node */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered || isSelected ? 6.5 : 4}
                        fill="#FFFFFF"
                        stroke={isSelected ? '#4F46E5' : chartAccentColor}
                        strokeWidth={isHovered || isSelected ? 3.5 : 2.5}
                        className="dash-chart-node"
                        onMouseEnter={() => setHoveredPointIndex(idx)}
                        onMouseLeave={() => setHoveredPointIndex(null)}
                        onClick={() => setSelectedPeriodFilter(isSelected ? null : pt.bar)}
                      />
                      {/* X-axis labels below the baseline */}
                      <text
                        x={pt.x}
                        y={baselineY + 22}
                        textAnchor="middle"
                        fill={isSelected ? '#4F46E5' : (isHovered ? '#0F172A' : '#94A3B8')}
                        fontSize="11.5"
                        fontWeight={isSelected || isHovered ? '700' : '600'}
                        fontFamily="var(--font-mono, monospace)"
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => setSelectedPeriodFilter(isSelected ? null : pt.bar)}
                      >
                        {pt.bar.label}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>

            {/* Bottom Summary Strip */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #E2E8F0', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: chartAccentColor }} />
                  {velocityData.totalDone} Delivered
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3D6FD6' }} />
                  {velocityData.totalScope - velocityData.totalDone} Scheduled
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#94A3B8', fontWeight: 500 }}>
                Click any point to filter tasks below ↓
              </div>
            </div>
          </div>

          {/* Right Panel: Admin gets "Top Contributors", Member gets "My Sprint Focus" */}
          {isAdmin ? (
            /* ADMIN: TOP CONTRIBUTORS */
            <div className="dash-surface-card dash-performers-panel">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div className="dash-panel-title">Top contributors</div>
                <Link to={`/${workspaceId}/settings`} style={{ fontSize: '12px', color: '#4F46E5', fontWeight: 700, textDecoration: 'none' }}>
                  + Add Member
                </Link>
              </div>
              <div className="dash-panel-desc" style={{ marginBottom: '12px' }}>
                Ranked by delivered tasks this sprint
              </div>

              <div className="dash-performers-list">
                {contributors.slice(0, 5).map((m, idx) => (
                  <div key={m.id || idx} className="dash-performer-row">
                    <div className="dash-performer-user">
                      <div className="dash-performer-avatar">
                        {m.initials}
                      </div>
                      <div className="dash-performer-info">
                        <span className="dash-performer-name">{m.name}</span>
                        <span className="dash-performer-role">{m.handle} • {m.role}</span>
                      </div>
                    </div>

                    <div className="dash-performer-stats">
                      <span className="dash-performer-share">{m.percentage}%</span>
                      <span className="dash-performer-done">{m.done} shipped</span>
                    </div>
                  </div>
                ))}

                {contributors.length === 0 && (
                  <div style={{ padding: '24px 12px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                    No members invited yet. Invite collaborators to track team contributions.
                  </div>
                )}
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link to={`/${workspaceId}/settings`} style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textDecoration: 'none' }}>
                  View All {members.length || 1} Members ›
                </Link>
                <Link to={`/${workspaceId}/integrations`} style={{ fontSize: '12px', color: '#4F46E5', fontWeight: 700, textDecoration: 'none' }}>
                  + Connect GitHub
                </Link>
              </div>
            </div>
          ) : (
            /* MEMBER: MY SPRINT FOCUS & PRIORITIES */
            <div className="dash-surface-card dash-priorities-panel">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div className="dash-panel-title">My sprint focus</div>
                <span style={{ fontSize: '11px', background: '#EEF2FF', color: '#4F46E5', padding: '2px 8px', borderRadius: '100px', fontWeight: 700 }}>
                  Priority Queue
                </span>
              </div>
              <div className="dash-panel-desc" style={{ marginBottom: '12px' }}>
                Your next upcoming deliverables
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {memberPriorityTasks.map(t => {
                  const urg = getUrgency(t.dueDate, t.status)
                  const urgColor = urg === 'overdue' ? '#D14343' : (urg === 'critical' ? '#F59E0B' : '#3D6FD6')
                  const urgLabel = urg === 'overdue' ? 'Overdue' : (urg === 'critical' ? 'Due Soon' : 'Upcoming')

                  return (
                    <div key={t.id} className="dash-priority-card">
                      <div className="dash-priority-left">
                        <span className="dash-priority-dot" style={{ background: urgColor }} />
                        <div style={{ minWidth: 0 }}>
                          <div className="dash-priority-title">{t.title}</div>
                          <div className="dash-priority-meta">
                            {t.dueDate ? `Due ${new Date(t.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'No due date'}
                          </div>
                        </div>
                      </div>

                      <span
                        className="dash-priority-tag"
                        style={{
                          background: urg === 'overdue' ? '#FEF2F2' : '#F1F5F9',
                          color: urgColor
                        }}
                      >
                        {urgLabel}
                      </span>
                    </div>
                  )
                })}

                {memberPriorityTasks.length === 0 && (
                  <div style={{ padding: '32px 12px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                    <div style={{ fontSize: '20px', marginBottom: '6px' }}>🎉</div>
                    <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: '2px' }}>All caught up!</div>
                    <div>No pending deadlines assigned to you right now.</div>
                  </div>
                )}
              </div>

              {/* Personal Sprint Progress Bar */}
              <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#64748B', fontWeight: 600, marginBottom: '6px' }}>
                  <span>Sprint Completion</span>
                  <span>{myStats.done} of {myStats.total} shipped ({myStats.completionRate}%)</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#F1F5F9', borderRadius: '100px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${myStats.completionRate}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #4F46E5 0%, #10B981 100%)',
                      borderRadius: '100px',
                      transition: 'width 0.4s ease'
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── 5. CONNECTED INFRASTRUCTURE / CHANNELS STRIP (INSPIRED BY CROWZ REFERENCE) ── */}
        <section className="dash-channels-container">
          <div className="dash-channels-header">
            <h3 className="dash-channels-title">
              {isAdmin ? 'Connected Infrastructure' : 'My Daily Workflows'}
            </h3>
            <p className="dash-channels-subtitle">
              {isAdmin
                ? 'Real-time integrations, code sync pipelines & sprint capacity'
                : 'Direct shortcuts to your active sprint board, meetings & git sync'}
            </p>
          </div>

          <div className="dash-channels-grid">
            {isAdmin ? (
              /* ADMIN CHANNELS */
              <>
                {/* 1. GitHub */}
                <div className="dash-channel-card">
                  <div className="dash-channel-icon-wrap" style={{ background: '#F3F4F6', color: '#1F2937' }}>
                    <GitHubIcon />
                  </div>
                  <div className="dash-channel-name">GitHub Repos</div>
                  <div className="dash-channel-meta">{githubRepos.length > 0 ? `${githubRepos.length} Connected` : 'Not Linked'}</div>
                  <div className={`dash-channel-badge ${githubRepos.length > 0 ? 'badge-active' : 'badge-idle'}`}>
                    {githubRepos.length > 0 ? '● Active Sync' : '○ Connect'}
                  </div>
                </div>

                {/* 2. Google Calendar */}
                <div className="dash-channel-card">
                  <div className="dash-channel-icon-wrap" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                    <CalendarIcon />
                  </div>
                  <div className="dash-channel-name">Calendar Sync</div>
                  <div className="dash-channel-meta">Google Meet & GIS</div>
                  <div className="dash-channel-badge badge-active">● Active</div>
                </div>

                {/* 3. Sprint Scope */}
                <div className="dash-channel-card">
                  <div className="dash-channel-icon-wrap" style={{ background: '#FEF3C7', color: '#D97706' }}>
                    <SprintIcon />
                  </div>
                  <div className="dash-channel-name">Sprint Scope</div>
                  <div className="dash-channel-meta">{activeSprint ? activeSprint.name : 'Sprint Active'}</div>
                  <div className={`dash-channel-badge ${activeSprint?.locked ? 'badge-locked' : 'badge-active'}`}>
                    {activeSprint?.locked ? '🔒 Locked' : '⚡ Flexible'}
                  </div>
                </div>

                {/* 4. Plan & Capacity */}
                <div className="dash-channel-card">
                  <div className="dash-channel-icon-wrap" style={{ background: '#F5F3FF', color: '#7C3AED' }}>
                    <ShieldIcon />
                  </div>
                  <div className="dash-channel-name">Plan Tier</div>
                  <div className="dash-channel-meta">{workspace?.planId ? `${workspace.planId.toUpperCase()} Plan` : 'Starter'}</div>
                  <div className="dash-channel-badge badge-active">
                    {capacityDetails?.totalSeatsUsed || (members.length || 1)} Seats Used
                  </div>
                </div>

                {/* 5. Action Card */}
                <Link to={`/${workspaceId}/integrations`} className="dash-channel-action-card">
                  <div className="dash-action-card-text">
                    <span className="dash-action-card-title">Full Controls</span>
                    <span className="dash-action-card-sub">Manage Integrations →</span>
                  </div>
                  <div className="dash-action-card-arrow">
                    <ArrowRightIcon />
                  </div>
                </Link>
              </>
            ) : (
              /* MEMBER CHANNELS */
              <>
                {/* 1. Workflow Board */}
                <Link to={`/${workspaceId}/workflow`} className="dash-channel-card dash-channel-card--link">
                  <div className="dash-channel-icon-wrap" style={{ background: '#EEF2FF', color: '#4F46E5' }}>
                    <BoardIcon />
                  </div>
                  <div className="dash-channel-name">Workflow Board</div>
                  <div className="dash-channel-meta">{activeSprint ? activeSprint.name : 'Active Sprint'}</div>
                  <div className="dash-channel-badge badge-active">Open Board →</div>
                </Link>

                {/* 2. Standup / Meetings */}
                <Link to={`/${workspaceId}/meeting`} className="dash-channel-card dash-channel-card--link">
                  <div className="dash-channel-icon-wrap" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                    <CalendarIcon />
                  </div>
                  <div className="dash-channel-name">Daily Standup</div>
                  <div className="dash-channel-meta">Meetings & Sync</div>
                  <div className="dash-channel-badge badge-active">Join Standup →</div>
                </Link>

                {/* 3. Analytics */}
                <Link to={`/${workspaceId}/analytics`} className="dash-channel-card dash-channel-card--link">
                  <div className="dash-channel-icon-wrap" style={{ background: '#ECFDF5', color: '#059669' }}>
                    <ChartIcon />
                  </div>
                  <div className="dash-channel-name">Velocity Metrics</div>
                  <div className="dash-channel-meta">Personal Stats</div>
                  <div className="dash-channel-badge badge-active">View Report →</div>
                </Link>

                {/* 4. GitHub PR Tracker */}
                <div className="dash-channel-card">
                  <div className="dash-channel-icon-wrap" style={{ background: '#F3F4F6', color: '#1F2937' }}>
                    <GitHubIcon />
                  </div>
                  <div className="dash-channel-name">GitHub Tracker</div>
                  <div className="dash-channel-meta">{githubRepos.length > 0 ? `${githubRepos.length} Repos` : 'Git Sync'}</div>
                  <div className="dash-channel-badge badge-idle">PR Tracker</div>
                </div>

                {/* 5. View Switcher Action Card */}
                <div
                  className="dash-channel-action-card"
                  onClick={() => setViewMode(v => v === 'board' ? 'list' : 'board')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="dash-action-card-text">
                    <span className="dash-action-card-title">View Mode</span>
                    <span className="dash-action-card-sub">Switch to {viewMode === 'board' ? 'List' : 'Kanban'}</span>
                  </div>
                  <div className="dash-action-card-arrow">
                    <ArrowRightIcon />
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── 6. DELIVERABLES HEADER, SCOPE TOGGLES & VIEW SWITCHER ── */}
        <section style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
                {isAdmin ? (adminScope === 'team' ? 'Team Deadlines' : 'My Assigned Tasks') : 'My Sprint Deliverables'}
              </h2>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '12.5px', color: '#94A3B8', fontWeight: 600 }}>
                {sortedTasks.length} total
              </span>
            </div>

            {/* Scope / Filter pills */}
            {isAdmin ? (
              <div className="dash-scope-pills">
                <button
                  type="button"
                  className={`dash-scope-btn${adminScope === 'team' ? ' active' : ''}`}
                  onClick={() => setAdminScope('team')}
                >
                  Whole Team ({deadlines.length})
                </button>
                <button
                  type="button"
                  className={`dash-scope-btn${adminScope === 'mine' ? ' active' : ''}`}
                  onClick={() => setAdminScope('mine')}
                >
                  Assigned to Me ({myTasks.length})
                </button>
              </div>
            ) : (
              <div className="dash-scope-pills">
                <button
                  type="button"
                  className={`dash-scope-btn${memberFilter === 'all' ? ' active' : ''}`}
                  onClick={() => setMemberFilter('all')}
                >
                  All Mine ({myTasks.length})
                </button>
                <button
                  type="button"
                  className={`dash-scope-btn${memberFilter === 'in_progress' ? ' active' : ''}`}
                  onClick={() => setMemberFilter('in_progress')}
                >
                  In Flight ({myTasks.filter(t => t.status === 'in_progress').length})
                </button>
                <button
                  type="button"
                  className={`dash-scope-btn${memberFilter === 'due_soon' ? ' active' : ''}`}
                  onClick={() => setMemberFilter('due_soon')}
                >
                  Due Soon ({myTasks.filter(t => ['critical', 'warn', 'overdue'].includes(getUrgency(t.dueDate, t.status))).length})
                </button>
              </div>
            )}
          </div>

          {/* Kanban / List Toggle */}
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

        {/* Active Filter Banner when a date on chart is selected */}
        {selectedPeriodFilter && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(79, 70, 229, 0.08)',
            border: '1px solid rgba(79, 70, 229, 0.25)',
            borderRadius: '12px',
            padding: '10px 16px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#4F46E5',
            fontWeight: 600
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🔍 Filtered by Velocity Timeline:</span>
              <span style={{ color: '#0F172A', fontWeight: 700 }}>{selectedPeriodFilter.title}</span>
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
                color: '#4F46E5',
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

        {/* ── 7. DELIVERABLES (5-COLUMN KANBAN OR LIST VIEW) ── */}
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
                {/* Column Header */}
                <div style={{
                  padding: '16px 18px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #E2E8F0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.dotColor, flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{col.title}</span>
                  </div>
                  <span style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '11px',
                    fontWeight: 600,
                    background: '#F1F5F9',
                    color: '#64748B',
                    padding: '2px 8px',
                    borderRadius: '100px',
                    border: '1px solid #E2E8F0'
                  }}>
                    {col.items.length}
                  </span>
                </div>

                {/* Column Body with real task cards */}
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
                    <div style={{ fontSize: '13px', color: '#94A3B8', fontWeight: 500 }}>
                      {col.emptyText}
                    </div>
                  ) : (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {col.items.map(d => (
                        <DeadlineCard
                          key={d.id}
                          deadline={d}
                          currentUser={user}
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
                {isAdmin && adminScope === 'team'
                  ? 'No deadlines in workspace yet. Create your first task to kick off the sprint.'
                  : 'No tasks found for your selection.'}
              </div>
            ) : (
              sortedTasks.map(d => (
                <DeadlineCard
                  key={d.id}
                  deadline={d}
                  currentUser={user}
                  sprintLocked={!!(d.sprintId && activeSprint?.id === d.sprintId && activeSprint?.locked)}
                />
              ))
            )}
          </section>
        )}

        {hasMore && (
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <button
              className="dash-btn-secondary"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </main>

      {/* New Task Modal */}
      {showNewModal && (
        <NewDeadlineModal
          teamId={workspaceId || 'default-team'}
          members={members}
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
