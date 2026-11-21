import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '../lib/WorkspaceContext'
import { useAuth } from '../lib/AuthContext'
import { updateDeadline, deleteDeadline } from '../lib/deadlines'
import { archiveSprint, unarchiveSprint } from '../lib/sprints'
import { changeMemberRole, removeMember } from '../lib/workspaces'
import CreateProjectModal from './CreateProjectModal'
import ReassignTaskModal from './ReassignTaskModal'
import NewDeadlineModal from './NewDeadlineModal'
import Paper5Logo from './Paper5Logo'
import {
  LayoutGrid,
  CheckSquare,
  FolderGit2,
  Users2,
  Activity,
  Search,
  Plus,
  RefreshCw,
  Download,
  AlertTriangle,
  Clock,
  UserCheck,
  CheckCircle2,
  Calendar,
  Flag,
  ArrowRight,
  UserPlus,
  Shield,
  ShieldAlert,
  Archive,
  ArchiveRestore,
  ExternalLink,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  Inbox,
  Bell,
  ArrowUpRight,
  MoreVertical,
  CheckCircle,
  HelpCircle,
  LogOut,
  ChevronRight,
  Sparkles
} from 'lucide-react'
import { useWorkspaceBento } from './WorkspaceBentoLayout'
import './AdminCommandCenter.css'

export default function AdminCommandCenter({ onSwitchToPersonal }) {
  const bentoLayout = useWorkspaceBento()
  const {
    workspaceId,
    workspace,
    isAdmin,
    isOwner,
    onlineUsers: contextOnlineUsers = [],
    onlineUserIds: contextOnlineUserIds,
    onlineCount: contextOnlineCount
  } = useWorkspace()
  const { user } = useAuth()

  // Real-time Presence
  const onlineUserIds = contextOnlineUserIds || new Set()

  // State
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [activeTab, setActiveTab] = useState('tasks') // 'tasks' | 'projects' | 'team' | 'audit'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('all')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all')
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState('all')
  const [quickFilter, setQuickFilter] = useState('all') // 'all' | 'mine' | 'overdue' | 'stalled' | 'unassigned' | 'urgent'
  const [auditResourceFilter, setAuditResourceFilter] = useState('all')

  // Modals
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false)
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false)
  const [taskToReassign, setTaskToReassign] = useState(null)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  // Auto-dismiss alerts
  useEffect(() => {
    if (actionError || actionSuccess) {
      const timer = setTimeout(() => {
        setActionError('')
        setActionSuccess('')
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [actionError, actionSuccess])

  // Fetch Admin Overview Data
  const fetchOverview = useCallback(async () => {
    if (!workspaceId) return
    try {
      const res = await fetch(`/api/admin-overview?workspaceId=${encodeURIComponent(workspaceId)}`, {
        credentials: 'same-origin'
      })
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) {
      console.error('Failed to load admin overview:', err)
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  // Realtime updates
  useEffect(() => {
    const handleSync = () => fetchOverview()
    window.addEventListener('sprintos:data-sync', handleSync)
    window.addEventListener('sprintos:deadlines-updated', handleSync)
    window.addEventListener('sprintos:sprints-updated', handleSync)
    window.addEventListener('p5:workspace-updated', handleSync)
    return () => {
      window.removeEventListener('sprintos:data-sync', handleSync)
      window.removeEventListener('sprintos:deadlines-updated', handleSync)
      window.removeEventListener('sprintos:sprints-updated', handleSync)
      window.removeEventListener('p5:workspace-updated', handleSync)
    }
  }, [fetchOverview])

  const overview = data?.overview || {}
  const projects = data?.projects || []
  const tasks = data?.tasks || []
  const teamWorkload = data?.teamWorkload || []
  const recentActivity = data?.recentActivity || []
  const invites = data?.invites || []

  // Current Admin First Name
  const adminFirstName = useMemo(() => {
    if (user?.displayName) return user.displayName.split(' ')[0]
    if (user?.email) {
      const prefix = user.email.split('@')[0]
      return prefix.charAt(0).toUpperCase() + prefix.slice(1)
    }
    return 'Admin'
  }, [user])

  // Check if member is online
  const isMemberOnline = useCallback((member) => {
    if (!member) return false
    const memberId = member.userId || member.id
    const memberEmail = (member.email || '').toLowerCase().trim()
    const currentUserId = user?.id
    const currentUserEmail = (user?.email || '').toLowerCase().trim()

    if (currentUserId && (memberId === currentUserId || memberEmail === currentUserEmail)) return true
    return onlineUserIds.has(memberId) || onlineUserIds.has(memberEmail)
  }, [onlineUserIds, user])

  const onlineList = useMemo(() => {
    if (contextOnlineUsers && contextOnlineUsers.length > 0) return contextOnlineUsers
    if (user) {
      return [{
        userId: user.id,
        email: user.email,
        name: user.displayName || user.email?.split('@')[0] || 'You',
        role: workspace?.role || 'Owner',
        isCurrent: true
      }]
    }
    return []
  }, [contextOnlineUsers, user, workspace])

  const onlineCount = onlineList.length
  const handleExportCSV = () => {
    window.location.href = `/api/admin?workspaceId=${encodeURIComponent(workspaceId)}&action=export&type=tasks`
  }

  // Inline Status Change for Tasks
  const handleTaskStatusChange = async (taskId, newStatus) => {
    try {
      await updateDeadline(workspaceId, taskId, { status: newStatus })
      setActionSuccess('Task status updated.')
      fetchOverview()
    } catch (err) {
      console.error('Failed to update task status:', err)
      setActionError(err?.message || 'Failed to update task.')
    }
  }

  // Delete Task
  const handleDeleteTask = async (taskId, title) => {
    if (!window.confirm(`Are you sure you want to delete task "${title}"?`)) return
    try {
      await deleteDeadline(workspaceId, taskId)
      setActionSuccess(`Deleted task "${title}".`)
      fetchOverview()
    } catch (err) {
      console.error('Failed to delete task:', err)
      setActionError(err?.message || 'Failed to delete task.')
    }
  }

  // Archive / Unarchive Project
  const handleToggleArchiveProject = async (sprintId, currentlyArchived) => {
    try {
      if (currentlyArchived) {
        await unarchiveSprint(workspaceId, sprintId)
        setActionSuccess('Project restored from archive.')
      } else {
        await archiveSprint(workspaceId, sprintId)
        setActionSuccess('Project archived successfully.')
      }
      fetchOverview()
    } catch (err) {
      console.error('Failed to toggle project archive:', err)
      setActionError(err?.message || 'Failed to update project.')
    }
  }

  // Promote / Demote Member Role
  const handleToggleMemberRole = async (targetUserId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin'
    if (currentRole === 'admin') {
      const adminCount = teamWorkload.filter((m) => m.role === 'admin' || m.role === 'owner').length
      if (adminCount <= 1) {
        return setActionError('Cannot demote the last remaining administrator in this workspace.')
      }
    }

    try {
      await changeMemberRole(workspaceId, targetUserId, newRole)
      setActionSuccess(`Member updated to ${newRole.toUpperCase()}.`)
      fetchOverview()
    } catch (err) {
      console.error('Failed to update role:', err)
      setActionError(err?.message || 'Failed to change member role.')
    }
  }

  // Remove Member
  const handleRemoveMember = async (targetUserId, memberName, memberRole) => {
    if (memberRole === 'owner') {
      return setActionError('The workspace owner cannot be removed.')
    }
    if (!window.confirm(`Remove ${memberName} from this workspace?`)) return

    try {
      await removeMember(workspaceId, targetUserId)
      setActionSuccess(`Removed ${memberName} from workspace.`)
      fetchOverview()
    } catch (err) {
      console.error('Failed to remove member:', err)
      setActionError(err?.message || 'Failed to remove member.')
    }
  }

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesTitle = (t.title || '').toLowerCase().includes(q)
        const matchesAssignee = (t.assigneeName || '').toLowerCase().includes(q) || (t.assigneeEmail || '').toLowerCase().includes(q)
        const matchesSprint = (t.sprintName || '').toLowerCase().includes(q)
        if (!matchesTitle && !matchesAssignee && !matchesSprint) return false
      }
      if (selectedProjectFilter !== 'all' && t.sprintId !== selectedProjectFilter) return false
      if (selectedStatusFilter !== 'all' && t.status !== selectedStatusFilter) return false
      if (selectedPriorityFilter !== 'all' && t.priority !== selectedPriorityFilter) return false
      if (quickFilter === 'mine') {
        const myUid = user?.id || user?.uid
        const myEmail = (user?.email || '').toLowerCase().trim()
        const isMine = (t.assigneeId && t.assigneeId === myUid) ||
                       (t.assigneeEmail && t.assigneeEmail.toLowerCase().trim() === myEmail)
        if (!isMine) return false
      }
      if (quickFilter === 'overdue' && !t.isOverdue) return false
      if (quickFilter === 'stalled' && !t.isStalled) return false
      if (quickFilter === 'unassigned' && t.assigneeId) return false
      if (quickFilter === 'urgent' && !['urgent', 'high'].includes(t.priority)) return false

      return true
    })
  }, [tasks, searchQuery, selectedProjectFilter, selectedStatusFilter, selectedPriorityFilter, quickFilter])

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    if (auditResourceFilter === 'all') return recentActivity
    return recentActivity.filter((l) => l.resource === auditResourceFilter)
  }, [recentActivity, auditResourceFilter])

  const formatDate = (isoString) => {
    if (!isoString) return '—'
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return '—'
    }
  }

  const formatRelativeTime = (isoString) => {
    if (!isoString) return '—'
    try {
      const diffMs = Date.now() - new Date(isoString).getTime()
      const diffMins = Math.floor(diffMs / 60000)
      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `${diffHours}h ago`
      const diffDays = Math.floor(diffHours / 24)
      return `${diffDays}d ago`
    } catch {
      return '—'
    }
  }

  // Keyboard Shortcuts (⌘1, ⌘2, ⌘3, ⌘4)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        if (e.key === '1') { e.preventDefault(); setActiveTab('tasks') }
        if (e.key === '2') { e.preventDefault(); setActiveTab('projects') }
        if (e.key === '3') { e.preventDefault(); setActiveTab('team') }
        if (e.key === '4') { e.preventDefault(); setActiveTab('audit') }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Computed Velocity Rate
  const completedRate = overview.overallProductivity || 0

  const renderDashboardStage = () => (
    <>
      {/* Feedback Notices */}
      {actionSuccess && (
        <div className="bento-alert success">
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="bento-alert error">
          <AlertTriangle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
           ROW 1: BENTO TELEMETRY CARDS (Direct from Fenco & Quixotic Mocks)
      ───────────────────────────────────────────────────────────── */}
          <section className="bento-kpi-row">
            {/* Card 1: Workspace Output / Task Statistics */}
            <div className="bento-card">
              <div className="bento-card-top">
                <span className="bento-card-title">Task Velocity</span>
                <span className="bento-card-tag">All Projects</span>
              </div>
              <div className="bento-stat-hero-row">
                <span className="bento-stat-hero-number">{overview.completedTasksCount || 0}</span>
                <span className="bento-stat-hero-label">/ {overview.totalTasks || 0} Tasks Done</span>
              </div>

              {/* Visual Output Bar Meter */}
              <div className="bento-task-meter-section">
                <div className="bento-meter-bar">
                  <div
                    className="bento-meter-fill"
                    style={{ width: `${completedRate}%` }}
                  />
                </div>
                <div className="bento-meter-labels">
                  <span>{completedRate}% workspace completion</span>
                  <span>{overview.activeTasksCount || 0} in progress</span>
                </div>
              </div>
            </div>

            {/* Card 2: Emerald Green Project Deck Card (Direct from Quixotic Mock #3) */}
            <div className="bento-card bento-card--emerald">
              <div className="bento-emerald-top">
                <div>
                  <span className="bento-emerald-eyebrow">ACTIVE PROJECTS</span>
                  <h3 className="bento-emerald-number">{overview.activeProjectsCount ?? 0} Sprints</h3>
                </div>
                <div className="bento-emerald-icon-box">
                  <FolderGit2 size={20} />
                </div>
              </div>

              <div className="bento-emerald-subrow">
                <span>{overview.completedProjectsCount || 0} Delivered</span>
                <span className="bento-emerald-badge">
                  {overview.attentionProjectsCount > 0
                    ? `${overview.attentionProjectsCount} Needs Attention`
                    : '100% On Track'}
                </span>
              </div>
            </div>

            {/* Card 3: Analytics Radial Gauge (Direct from Fenco Mock #1) */}
            <div className="bento-card">
              <div className="bento-card-top">
                <span className="bento-card-title">Analytics</span>
                <button
                  type="button"
                  className="bento-card-dots"
                  onClick={() => (window.location.href = `/${workspaceId}/analytics`)}
                  title="View Analytics"
                >
                  <ArrowUpRight size={15} />
                </button>
              </div>

              <div className="bento-gauge-wrap">
                <div className="bento-gauge-semi">
                  <div
                    className="bento-gauge-arc"
                    style={{ transform: `rotate(${Math.min(180, (completedRate / 100) * 180)}deg)` }}
                  />
                  <div className="bento-gauge-inner">
                    <span className="bento-gauge-percent">{completedRate}%</span>
                    <span className="bento-gauge-sub">Done</span>
                  </div>
                </div>

                <div className="bento-gauge-legend">
                  <div className="legend-item">
                    <span className="legend-dot done" />
                    <span>Done ({overview.completedTasksCount || 0})</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot in-progress" />
                    <span>In Flight ({overview.inProgressTasksCount || 0})</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot todo" />
                    <span>To do ({overview.todoTasksCount || 0})</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 4: Urgent Attention Alert Card */}
            <div className="bento-card bento-card--alert">
              <div className="bento-card-top">
                <span className="bento-card-title" style={{ color: overview.overdueTasksCount > 0 ? '#b91c1c' : '#475569' }}>
                  Critical Queue
                </span>
                <AlertTriangle size={16} color={overview.overdueTasksCount > 0 ? '#dc2626' : '#94a3b8'} />
              </div>

              <div className="bento-stat-hero-row">
                <span className="bento-stat-hero-number" style={{ color: overview.overdueTasksCount > 0 ? '#dc2626' : '#0f172a' }}>
                  {overview.overdueTasksCount || 0}
                </span>
                <span className="bento-stat-hero-label">Overdue</span>
              </div>

              <div className="bento-alert-tags-row">
                <button
                  type="button"
                  className="bento-tag-btn"
                  onClick={() => { setActiveTab('tasks'); setQuickFilter('stalled'); }}
                >
                  {overview.stalledTasksCount || 0} Stalled (&gt;7d)
                </button>
                <button
                  type="button"
                  className="bento-tag-btn"
                  onClick={() => { setActiveTab('tasks'); setQuickFilter('unassigned'); }}
                >
                  {overview.unassignedTasksCount || 0} Unassigned
                </button>
              </div>
            </div>

            {/* Card 5: Live Team Presence (Scrollable Bento Card) */}
            <div className="bento-card bento-card--presence">
              <div className="bento-card-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="bento-live-pulse-dot" />
                  <span className="bento-card-title">Live Team</span>
                </div>
                <span className="bento-online-pill-tag">
                  {onlineCount} {onlineCount === 1 ? 'Online' : 'Online'}
                </span>
              </div>

              <div className="bento-card-online-scroll">
                {onlineList.map((m) => (
                  <div key={m.userId || m.email} className="bento-presence-user-row">
                    <div className="bento-presence-avatar-wrap">
                      <div
                        className="bento-presence-avatar"
                        style={{
                          background: m.avatarUrl ? `url(${m.avatarUrl}) center/cover` : '#18181b'
                        }}
                      >
                        {!m.avatarUrl && (m.name || m.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <span className="bento-presence-dot" />
                    </div>
                    <div className="bento-presence-meta">
                      <div className="bento-presence-name-row">
                        <span className="bento-presence-name">
                          {m.name || m.email} {m.userId === user?.id ? '(You)' : ''}
                        </span>
                        <span className="bento-presence-role">{m.role || 'Member'}</span>
                      </div>
                      <span className="bento-presence-status">Online now</span>
                    </div>
                  </div>
                ))}

                {/* Show offline workspace members */}
                {teamWorkload
                  .filter((tm) => !isMemberOnline(tm))
                  .map((m) => (
                    <div key={m.userId || m.id || m.email} className="bento-presence-user-row offline">
                      <div className="bento-presence-avatar-wrap">
                        <div
                          className="bento-presence-avatar offline"
                          style={{
                            background: m.avatarUrl ? `url(${m.avatarUrl}) center/cover` : '#71717a'
                          }}
                        >
                          {!m.avatarUrl && (m.name || m.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span className="bento-presence-dot offline" />
                      </div>
                      <div className="bento-presence-meta">
                        <div className="bento-presence-name-row">
                          <span className="bento-presence-name offline">{m.name || m.email}</span>
                          <span className="bento-presence-role">{m.role || 'Member'}</span>
                        </div>
                        <span className="bento-presence-status offline">Offline</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </section>

          {/* ─────────────────────────────────────────────────────────────
               ROW 2: OPERATIONAL TABS & FILTER BAR
          ───────────────────────────────────────────────────────────── */}
          <div className="bento-tab-strip">
            <div className="bento-tabs-left">
              <button
                type="button"
                className={`bento-nav-tab ${activeTab === 'tasks' ? 'active' : ''}`}
                onClick={() => setActiveTab('tasks')}
              >
                <CheckSquare size={15} />
                <span>Master Task Grid ({overview.totalTasks || 0})</span>
              </button>

              <button
                type="button"
                className={`bento-nav-tab ${activeTab === 'projects' ? 'active' : ''}`}
                onClick={() => setActiveTab('projects')}
              >
                <FolderGit2 size={15} />
                <span>Projects Command ({overview.totalProjects || 0})</span>
              </button>

              <button
                type="button"
                className={`bento-nav-tab ${activeTab === 'team' ? 'active' : ''}`}
                onClick={() => setActiveTab('team')}
              >
                <Users2 size={15} />
                <span>Team Workload ({teamWorkload.length})</span>
              </button>

              <button
                type="button"
                className={`bento-nav-tab ${activeTab === 'audit' ? 'active' : ''}`}
                onClick={() => setActiveTab('audit')}
              >
                <Activity size={15} />
                <span>Audit Trail</span>
              </button>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
               TAB 1: MASTER TASK GRID (CROSS-PROJECT VISIBILITY)
          ───────────────────────────────────────────────────────────── */}
          {activeTab === 'tasks' && (
            <section className="bento-stage-card">
              {/* Filter Controls */}
              <div className="bento-filter-row">
                <div className="bento-search-box">
                  <Search size={14} color="#94a3b8" />
                  <input
                    type="text"
                    placeholder="Search tasks across workspace..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bento-search-field"
                  />
                </div>

                <select
                  className="bento-select-pill"
                  value={selectedProjectFilter}
                  onChange={(e) => setSelectedProjectFilter(e.target.value)}
                >
                  <option value="all">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <select
                  className="bento-select-pill"
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">In Review</option>
                  <option value="completed">Completed</option>
                </select>

                <select
                  className="bento-select-pill"
                  value={selectedPriorityFilter}
                  onChange={(e) => setSelectedPriorityFilter(e.target.value)}
                >
                  <option value="all">All Priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>

                <div className="bento-filter-pills-group">
                  <button
                    type="button"
                    className={`bento-chip ${quickFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setQuickFilter('all')}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`bento-chip ${quickFilter === 'mine' ? 'active' : ''}`}
                    onClick={() => setQuickFilter('mine')}
                  >
                    My Tasks
                  </button>
                  <button
                    type="button"
                    className={`bento-chip ${quickFilter === 'overdue' ? 'active' : ''}`}
                    onClick={() => setQuickFilter('overdue')}
                  >
                    Overdue ({overview.overdueTasksCount || 0})
                  </button>
                  <button
                    type="button"
                    className={`bento-chip ${quickFilter === 'stalled' ? 'active' : ''}`}
                    onClick={() => setQuickFilter('stalled')}
                  >
                    Inactive &gt;7d ({overview.stalledTasksCount || 0})
                  </button>
                  <button
                    type="button"
                    className={`bento-chip ${quickFilter === 'unassigned' ? 'active' : ''}`}
                    onClick={() => setQuickFilter('unassigned')}
                  >
                    Unassigned ({overview.unassignedTasksCount || 0})
                  </button>
                  <button
                    type="button"
                    className={`bento-chip ${quickFilter === 'urgent' ? 'active' : ''}`}
                    onClick={() => setQuickFilter('urgent')}
                  >
                    Urgent / High
                  </button>
                </div>
              </div>

              {/* Master Task List */}
              <div className="bento-table-wrap">
                <table className="bento-table">
                  <thead>
                    <tr>
                      <th style={{ width: '38%' }}>Task</th>
                      <th style={{ width: '15%' }}>Project</th>
                      <th style={{ width: '16%' }}>Assignee</th>
                      <th style={{ width: '10%' }}>Priority</th>
                      <th style={{ width: '11%' }}>Due Date</th>
                      <th style={{ width: '10%' }}>Status</th>
                      <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="bento-empty-cell">
                          <Inbox size={32} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
                          <p>No workspace tasks match your selected filters.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredTasks.map((t) => (
                        <tr key={t.id} className={t.isOverdue ? 'row-alert' : ''}>
                          <td>
                            <div className="bento-task-title-cell">
                              <span className="bento-task-title">{t.title}</span>
                              <div className="bento-task-tags">
                                {t.isOverdue && <span className="bento-micro-badge overdue">OVERDUE</span>}
                                {t.isStalled && <span className="bento-micro-badge stalled">STALLED &gt;7D</span>}
                              </div>
                            </div>
                          </td>

                          <td>
                            <span className="bento-project-pill">{t.sprintName}</span>
                          </td>

                          <td>
                            {t.assigneeId ? (
                              <div className="bento-assignee-item">
                                <span className="bento-avatar-xs">
                                  {t.assigneeName.charAt(0).toUpperCase()}
                                </span>
                                <span className="bento-assignee-text">{t.assigneeName}</span>
                              </div>
                            ) : (
                              <span className="bento-unassigned-text">Unassigned</span>
                            )}
                          </td>

                          <td>
                            <span className={`bento-priority-badge ${t.priority}`}>
                              {t.priority.toUpperCase()}
                            </span>
                          </td>

                          <td>
                            <span className={`bento-date-text ${t.isOverdue ? 'overdue' : ''}`}>
                              {formatDate(t.dueDate)}
                            </span>
                          </td>

                          <td>
                            <select
                              className={`bento-status-dropdown ${t.status}`}
                              value={t.status}
                              onChange={(e) => handleTaskStatusChange(t.id, e.target.value)}
                            >
                              <option value="todo">To Do</option>
                              <option value="in_progress">In Progress</option>
                              <option value="review">In Review</option>
                              <option value="completed">Completed</option>
                            </select>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <div className="bento-row-actions">
                              <button
                                type="button"
                                className="bento-icon-btn"
                                title="Reassign task or edit"
                                onClick={() => setTaskToReassign(t)}
                              >
                                <UserCheck size={14} />
                              </button>
                              <button
                                type="button"
                                className="bento-icon-btn danger"
                                title="Delete task"
                                onClick={() => handleDeleteTask(t.id, t.title)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ─────────────────────────────────────────────────────────────
               TAB 2: PROJECT COMMAND DECK
          ───────────────────────────────────────────────────────────── */}
          {activeTab === 'projects' && (
            <section className="bento-stage-card">
              <div className="bento-stage-header">
                <div>
                  <h2 className="bento-section-title">Workspace Projects &amp; Sprints</h2>
                  <p className="bento-section-sub">Overview of active sprints, goals, schedules, and deliverables.</p>
                </div>
                <button
                  type="button"
                  className="bento-pill-action-btn primary"
                  onClick={() => setIsNewProjectOpen(true)}
                >
                  <Plus size={14} />
                  <span>Create Project</span>
                </button>
              </div>

              <div className="bento-projects-grid">
                {projects.map((p) => (
                  <div key={p.id} className={`bento-proj-card ${p.archived ? 'archived' : ''}`}>
                    <div className="bento-proj-card-top">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <h3 className="bento-proj-title">{p.name}</h3>
                          <span className={`bento-health-badge ${p.health}`}>
                            {p.health.replace('_', ' ').toUpperCase()}
                          </span>
                          {p.archived && <span className="bento-micro-badge stalled">ARCHIVED</span>}
                        </div>
                        {p.goal && <p className="bento-proj-goal">{p.goal}</p>}
                      </div>

                      <button
                        type="button"
                        className="bento-icon-btn"
                        title={p.archived ? 'Restore project' : 'Archive project'}
                        onClick={() => handleToggleArchiveProject(p.id, p.archived)}
                      >
                        {p.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                      </button>
                    </div>

                    <div className="bento-proj-meter-wrap">
                      <div className="bento-meter-bar">
                        <div
                          className="bento-meter-fill"
                          style={{
                            width: `${p.progress}%`,
                            background: p.health === 'critical' ? '#dc2626' : p.health === 'at_risk' ? '#f59e0b' : '#10b981'
                          }}
                        />
                      </div>
                      <div className="bento-meter-labels">
                        <span><strong>{p.progress}%</strong> Done</span>
                        <span>{p.completedTasks} / {p.totalTasks} tasks</span>
                      </div>
                    </div>

                    <div className="bento-proj-meta-row">
                      <div>
                        <span className="bento-meta-lbl">Duration</span>
                        <span className="bento-meta-val">
                          {formatDate(p.startDate)} &rarr; {formatDate(p.endDate)}
                        </span>
                      </div>
                      <div>
                        <span className="bento-meta-lbl">Overdue</span>
                        <span className="bento-meta-val" style={{ color: p.overdueTasks > 0 ? '#dc2626' : undefined }}>
                          {p.overdueTasks} tasks
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ─────────────────────────────────────────────────────────────
               TAB 3: TEAM WORKLOAD & GOVERNANCE
          ───────────────────────────────────────────────────────────── */}
          {activeTab === 'team' && (
            <section className="bento-stage-card">
              <div className="bento-stage-header">
                <div>
                  <h2 className="bento-section-title">Team Workload Distribution</h2>
                  <p className="bento-section-sub">Balanced resource allocation, assigned focus queues, and membership controls.</p>
                </div>
                <Link to={`/${workspaceId}/settings`} className="bento-pill-action-btn" style={{ textDecoration: 'none' }}>
                  <UserPlus size={14} />
                  <span>Invite Member</span>
                </Link>
              </div>

              <div className="bento-team-grid">
                {teamWorkload.map((m) => (
                  <div key={m.userId} className="bento-member-card">
                    <div className="bento-member-card-top">
                      <div className="bento-member-avatar-box">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <h4 className="bento-member-name">{m.name}</h4>
                          <span className={`bento-role-pill ${m.role}`}>
                            {m.role.toUpperCase()}
                          </span>
                        </div>
                        <span className="bento-member-email">{m.email}</span>
                      </div>

                      <span className={`bento-workload-chip ${m.workloadStatus.toLowerCase()}`}>
                        {m.workloadStatus}
                      </span>
                    </div>

                    <div className="bento-member-stats-strip">
                      <div>
                        <span className="stat-v">{m.activeTasksCount}</span>
                        <span className="stat-l">Active</span>
                      </div>
                      <div>
                        <span className="stat-v">{m.completedTasksCount}</span>
                        <span className="stat-l">Done</span>
                      </div>
                      <div>
                        <span className="stat-v" style={{ color: m.overdueTasksCount > 0 ? '#dc2626' : undefined }}>
                          {m.overdueTasksCount}
                        </span>
                        <span className="stat-l">Overdue</span>
                      </div>
                    </div>

                    {/* Member Focus Tasks */}
                    {m.recentActiveTasks?.length > 0 && (
                      <div className="bento-member-pipeline">
                        <span className="pipeline-title">Active Assignments</span>
                        {m.recentActiveTasks.map((t) => (
                          <div key={t.id} className="pipeline-item">
                            <span className="pipeline-item-name">{t.title}</span>
                            <span className={`bento-dot ${t.priority}`} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Safeguarded Actions */}
                    <div className="bento-member-card-footer">
                      {m.role !== 'owner' ? (
                        <>
                          <button
                            type="button"
                            className="bento-btn-text"
                            onClick={() => handleToggleMemberRole(m.userId, m.role)}
                          >
                            {m.role === 'admin' ? 'Demote to Member' : 'Promote to Admin'}
                          </button>
                          <button
                            type="button"
                            className="bento-btn-text danger"
                            onClick={() => handleRemoveMember(m.userId, m.name, m.role)}
                          >
                            Remove
                          </button>
                        </>
                      ) : (
                        <span className="bento-owner-shield">Primary Workspace Owner</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ─────────────────────────────────────────────────────────────
               TAB 4: LIVE ACTIVITY & AUDIT TRAIL
          ───────────────────────────────────────────────────────────── */}
          {activeTab === 'audit' && (
            <section className="bento-stage-card">
              <div className="bento-stage-header">
                <div>
                  <h2 className="bento-section-title">Workspace Audit Log</h2>
                  <p className="bento-section-sub">Chronological governance history of all task, sprint, and membership events.</p>
                </div>

                <div className="bento-filter-pills-group">
                  <button
                    type="button"
                    className={`bento-chip ${auditResourceFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setAuditResourceFilter('all')}
                  >
                    All Events
                  </button>
                  <button
                    type="button"
                    className={`bento-chip ${auditResourceFilter === 'task' ? 'active' : ''}`}
                    onClick={() => setAuditResourceFilter('task')}
                  >
                    Tasks
                  </button>
                  <button
                    type="button"
                    className={`bento-chip ${auditResourceFilter === 'project' ? 'active' : ''}`}
                    onClick={() => setAuditResourceFilter('project')}
                  >
                    Projects
                  </button>
                  <button
                    type="button"
                    className={`bento-chip ${auditResourceFilter === 'member' ? 'active' : ''}`}
                    onClick={() => setAuditResourceFilter('member')}
                  >
                    Team
                  </button>
                </div>
              </div>

              <div className="bento-audit-stream">
                {filteredAuditLogs.length === 0 ? (
                  <div className="bento-empty-cell">
                    <Activity size={32} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
                    <p>No activity logged for this selection.</p>
                  </div>
                ) : (
                  filteredAuditLogs.map((log) => (
                    <div key={log.id} className="bento-audit-item">
                      <div className="bento-audit-dot" />
                      <div className="bento-audit-content">
                        <div className="bento-audit-top-row">
                          <span className="bento-audit-action-tag">{log.action}</span>
                          <span className="bento-audit-time">{formatRelativeTime(log.createdAt)}</span>
                        </div>
                        <p className="bento-audit-desc">
                          Resource: <strong>{log.resource}</strong> &bull; {log.metadata?.title ? `"${log.metadata.title}"` : log.metadata?.name ? `"${log.metadata.name}"` : 'Workspace modification'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {/* Modals */}
          {isNewTaskOpen && (
            <NewDeadlineModal
              members={teamWorkload}
              currentUser={user}
              activeSprint={projects.find((p) => p.status === 'active')}
              sprints={projects}
              onClose={() => setIsNewTaskOpen(false)}
              onCreated={() => fetchOverview()}
            />
          )}

          {isNewProjectOpen && (
            <CreateProjectModal
              existingCount={projects.length}
              members={teamWorkload}
              onClose={() => setIsNewProjectOpen(false)}
              onCreated={() => fetchOverview()}
            />
          )}

          {taskToReassign && (
            <ReassignTaskModal
              task={taskToReassign}
              members={teamWorkload}
              onClose={() => setTaskToReassign(null)}
              onUpdated={() => fetchOverview()}
            />
          )}
    </>
  )

  if (bentoLayout) {
    return (
      <div className="bento-overview-content" style={{ display: 'flex', flexDirection: 'column', gap: '28px', width: '100%' }}>
        {renderDashboardStage()}
      </div>
    )
  }

  return (
    <div className="bento-canvas">
      <div className="bento-shell">
        <aside className="bento-left-dock">
          <div className="dock-top-group">
            <div className="dock-brand-icon" title="Paper5 Workspace">
              <Paper5Logo size={22} decorative />
            </div>

            <nav className="dock-nav-items">
              <button
                type="button"
                className={`dock-btn ${activeTab === 'tasks' ? 'active' : ''}`}
                onClick={() => setActiveTab('tasks')}
                aria-label="Master Task Grid"
              >
                <LayoutGrid size={19} />
                <span className="dock-tooltip">Master Tasks (⌘1)</span>
              </button>

              <button
                type="button"
                className={`dock-btn ${activeTab === 'projects' ? 'active' : ''}`}
                onClick={() => setActiveTab('projects')}
                aria-label="Projects & Sprints"
              >
                <FolderGit2 size={19} />
                <span className="dock-tooltip">Projects &amp; Sprints (⌘2)</span>
              </button>

              <button
                type="button"
                className={`dock-btn ${activeTab === 'team' ? 'active' : ''}`}
                onClick={() => setActiveTab('team')}
                aria-label="Team Workload"
              >
                <Users2 size={19} />
                <span className="dock-tooltip">Team Workload (⌘3)</span>
              </button>

              <button
                type="button"
                className={`dock-btn ${activeTab === 'audit' ? 'active' : ''}`}
                onClick={() => setActiveTab('audit')}
                aria-label="Activity & Audit Logs"
              >
                <Activity size={19} />
                <span className="dock-tooltip">Activity &amp; Audit (⌘4)</span>
              </button>

              <button
                type="button"
                className="dock-btn"
                onClick={() => (window.location.href = `/${workspaceId}/settings`)}
                aria-label="Workspace Settings"
              >
                <Shield size={19} />
                <span className="dock-tooltip">Workspace Settings</span>
              </button>
            </nav>
          </div>

          <div className="dock-bottom-group">
            <button
              type="button"
              className="dock-btn"
              onClick={onSwitchToPersonal}
              aria-label="Personal Focus View"
            >
              <CheckSquare size={19} />
              <span className="dock-tooltip">Personal Focus View</span>
            </button>
            <button
              type="button"
              className="dock-btn"
              onClick={fetchOverview}
              aria-label="Refresh Workspace Telemetry"
            >
              <RefreshCw size={18} className={loading ? 'spin' : ''} />
              <span className="dock-tooltip">Refresh Telemetry</span>
            </button>
          </div>
        </aside>

        <main className="bento-main-stage">
          <header className="bento-top-header">
            <div>
              <div className="bento-workspace-tag-row">
                <span className="bento-workspace-badge">
                  {(workspace?.name || 'WORKSPACE').toUpperCase()}
                </span>
                <span className="bento-plan-badge">
                  {(workspace?.plan || 'PRO').toUpperCase()}
                </span>
              </div>
              <h1 className="bento-greeting">
                Hello, <span>{adminFirstName}</span>
              </h1>
              <p className="bento-subtext">
                View and govern your workspace operations, projects &amp; team deliverables.
              </p>
            </div>

            <div className="bento-topbar-right">
              {teamWorkload.length > 0 && (
                <div
                  className="bento-team-capsule"
                  onClick={() => setActiveTab('team')}
                  title="View Team Workload & Live Presence"
                >
                  <span className="bento-live-pulse-dot" />
                  <span className="bento-online-count-lbl">{onlineCount} Online</span>
                  <div className="bento-team-avatars-row">
                    {teamWorkload.slice(0, 6).map((m, idx) => {
                      const isOnline = isMemberOnline(m)
                      return (
                        <div
                          key={m.userId || idx}
                          className={`bento-member-circle-avatar ${isOnline ? 'online' : ''}`}
                          title={`${m.name} (${m.role}) — ${isOnline ? 'Online now' : 'Offline'}`}
                          style={{
                            background: m.avatarUrl ? `url(${m.avatarUrl}) center/cover` : ['#4f46e5', '#0284c7', '#10b981', '#f59e0b', '#8b5cf6'][idx % 5]
                          }}
                        >
                          {!m.avatarUrl && m.name.charAt(0).toUpperCase()}
                        </div>
                      )
                    })}
                    {teamWorkload.length > 6 && (
                      <span className="bento-team-overflow">+{teamWorkload.length - 6}</span>
                    )}
                  </div>
                  <ChevronRight size={14} color="#94a3b8" />
                </div>
              )}

              <button
                type="button"
                className="bento-pill-action-btn"
                onClick={handleExportCSV}
                title="Export Tasks to CSV"
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                className="bento-pill-action-btn primary"
                onClick={() => setIsNewProjectOpen(true)}
              >
                <Plus size={14} />
                <span>New Project</span>
              </button>

              <button
                type="button"
                className="bento-pill-action-btn dark"
                onClick={() => setIsNewTaskOpen(true)}
              >
                <CheckSquare size={14} />
                <span>New Task</span>
              </button>

              <button
                type="button"
                className="bento-pill-action-btn personal"
                onClick={onSwitchToPersonal}
                title="Switch to Personal View"
              >
                <span>Personal View &rarr;</span>
              </button>
            </div>
          </header>

          {renderDashboardStage()}
        </main>
      </div>
    </div>
  )
}
