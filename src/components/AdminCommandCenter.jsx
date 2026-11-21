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
  LayoutDashboard,
  CheckSquare,
  FolderGit2,
  Users2,
  Activity,
  BarChart3,
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
  ArrowUpDown,
  TrendingUp,
  Inbox
} from 'lucide-react'
import './AdminCommandCenter.css'

export default function AdminCommandCenter({ onSwitchToPersonal }) {
  const { workspaceId, workspace, isAdmin, isOwner } = useWorkspace()
  const { user } = useAuth()

  // State
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [activeTab, setActiveTab] = useState('tasks') // 'tasks' | 'projects' | 'team' | 'audit' | 'analytics'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('all')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all')
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState('all')
  const [quickFilter, setQuickFilter] = useState('all') // 'all' | 'overdue' | 'stalled' | 'unassigned' | 'urgent'
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
    return () => {
      window.removeEventListener('sprintos:data-sync', handleSync)
      window.removeEventListener('sprintos:deadlines-updated', handleSync)
      window.removeEventListener('sprintos:sprints-updated', handleSync)
    }
  }, [fetchOverview])

  const overview = data?.overview || {}
  const projects = data?.projects || []
  const tasks = data?.tasks || []
  const teamWorkload = data?.teamWorkload || []
  const recentActivity = data?.recentActivity || []
  const invites = data?.invites || []

  // Direct CSV Export
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
    // Safeguard: verify at least one other admin exists if demoting
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
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesTitle = (t.title || '').toLowerCase().includes(q)
        const matchesAssignee = (t.assigneeName || '').toLowerCase().includes(q) || (t.assigneeEmail || '').toLowerCase().includes(q)
        const matchesSprint = (t.sprintName || '').toLowerCase().includes(q)
        if (!matchesTitle && !matchesAssignee && !matchesSprint) return false
      }
      // Project filter
      if (selectedProjectFilter !== 'all' && t.sprintId !== selectedProjectFilter) return false
      // Status filter
      if (selectedStatusFilter !== 'all' && t.status !== selectedStatusFilter) return false
      // Priority filter
      if (selectedPriorityFilter !== 'all' && t.priority !== selectedPriorityFilter) return false
      // Quick filter
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

  // Format Date Helper
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

  return (
    <div className="admin-command-root">
      {/* ─────────────────────────────────────────────────────────────
           1. TOP COMMAND HEADER
      ───────────────────────────────────────────────────────────── */}
      <header className="admin-header">
        <div className="admin-header-left">
          <div className="admin-header-brand">
            <Paper5Logo size={24} decorative />
            <div>
              <div className="admin-header-title-row">
                <h1 className="admin-workspace-name">{workspace?.name || 'Workspace'}</h1>
                <span className="admin-badge-plan">{(workspace?.plan || 'STARTER').toUpperCase()}</span>
                <span className="admin-badge-role">WORKSPACE ADMIN</span>
              </div>
              <p className="admin-header-sub">
                Executive Command Center &bull; Real-time operations, team workload, project health &amp; governance
              </p>
            </div>
          </div>
        </div>

        <div className="admin-header-actions">
          <button
            type="button"
            className="admin-btn-secondary"
            onClick={fetchOverview}
            title="Refresh workspace telemetry"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="admin-btn-secondary"
            onClick={handleExportCSV}
            title="Export all tasks to CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            className="admin-btn-primary"
            onClick={() => setIsNewProjectOpen(true)}
          >
            <Plus size={14} />
            <span>New Project</span>
          </button>

          <button
            type="button"
            className="admin-btn-primary"
            onClick={() => setIsNewTaskOpen(true)}
          >
            <CheckSquare size={14} />
            <span>New Task</span>
          </button>

          <button
            type="button"
            className="admin-btn-focus"
            onClick={onSwitchToPersonal}
            title="Switch to your personal task list"
          >
            <span>Personal View &rarr;</span>
          </button>
        </div>
      </header>

      {/* Alert Notices */}
      {actionSuccess && (
        <div className="admin-toast-success">
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="admin-toast-error">
          <AlertTriangle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
           2. EXECUTIVE KPI SUMMARY RIBBON
      ───────────────────────────────────────────────────────────── */}
      <section className="admin-kpi-grid">
        {/* KPI 1: Active Projects */}
        <div className="admin-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-title">Active Projects</span>
            <div className="admin-kpi-icon-wrap" style={{ background: '#e0e7ff', color: '#4338ca' }}>
              <FolderGit2 size={18} />
            </div>
          </div>
          <div className="admin-kpi-value-row">
            <span className="admin-kpi-number">{overview.activeProjectsCount ?? '—'}</span>
            <span className="admin-kpi-subdetail">of {overview.totalProjects ?? 0} total</span>
          </div>
          <div className="admin-kpi-footer">
            <span className="admin-status-pill on-track">{overview.activeProjectsCount ? `${overview.activeProjectsCount - (overview.attentionProjectsCount || 0)} On Track` : '0 Active'}</span>
            {overview.attentionProjectsCount > 0 && (
              <span className="admin-status-pill at-risk">{overview.attentionProjectsCount} Needs Attention</span>
            )}
          </div>
        </div>

        {/* KPI 2: Overall Task Velocity */}
        <div className="admin-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-title">Workspace Output</span>
            <div className="admin-kpi-icon-wrap" style={{ background: '#ecfdf5', color: '#047857' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="admin-kpi-value-row">
            <span className="admin-kpi-number">{overview.overallProductivity ?? 100}%</span>
            <span className="admin-kpi-subdetail">{overview.completedTasksCount || 0} / {overview.totalTasks || 0} completed</span>
          </div>
          <div className="admin-kpi-progress-bar">
            <div className="admin-kpi-progress-fill" style={{ width: `${overview.overallProductivity || 0}%` }} />
          </div>
        </div>

        {/* KPI 3: Urgent Attention Queue */}
        <div className="admin-kpi-card" style={{ borderColor: overview.overdueTasksCount > 0 ? '#fecaca' : undefined }}>
          <div className="admin-kpi-header">
            <span className="admin-kpi-title">Critical Attention Queue</span>
            <div className="admin-kpi-icon-wrap" style={{ background: '#fee2e2', color: '#b91c1c' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="admin-kpi-value-row">
            <span className="admin-kpi-number" style={{ color: overview.overdueTasksCount > 0 ? '#b91c1c' : '#0f172a' }}>
              {overview.overdueTasksCount || 0}
            </span>
            <span className="admin-kpi-subdetail">Overdue tasks</span>
          </div>
          <div className="admin-kpi-footer">
            <button
              type="button"
              className="admin-link-pill"
              onClick={() => { setActiveTab('tasks'); setQuickFilter('stalled'); }}
            >
              {overview.stalledTasksCount || 0} Stalled (&gt;7d)
            </button>
            <button
              type="button"
              className="admin-link-pill"
              onClick={() => { setActiveTab('tasks'); setQuickFilter('unassigned'); }}
            >
              {overview.unassignedTasksCount || 0} Unassigned
            </button>
          </div>
        </div>

        {/* KPI 4: Team Capacity & Workload */}
        <div className="admin-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-title">Team Workload</span>
            <div className="admin-kpi-icon-wrap" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
              <Users2 size={18} />
            </div>
          </div>
          <div className="admin-kpi-value-row">
            <span className="admin-kpi-number">{overview.totalMembers || 1}</span>
            <span className="admin-kpi-subdetail">Team members</span>
          </div>
          <div className="admin-kpi-footer">
            {teamWorkload.filter((m) => m.workloadStatus === 'Overloaded').length > 0 ? (
              <span className="admin-status-pill at-risk">
                {teamWorkload.filter((m) => m.workloadStatus === 'Overloaded').length} Overloaded
              </span>
            ) : (
              <span className="admin-status-pill on-track">Workload Balanced</span>
            )}
            {overview.pendingInvites > 0 && (
              <span className="admin-status-pill-neutral">{overview.pendingInvites} Pending Invites</span>
            )}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
           3. MAIN OPERATIONAL NAVIGATION TABS
      ───────────────────────────────────────────────────────────── */}
      <nav className="admin-tabs-nav">
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          <CheckSquare size={16} />
          <span>Master Task Grid ({overview.totalTasks || 0})</span>
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          <FolderGit2 size={16} />
          <span>Project Command Deck ({overview.totalProjects || 0})</span>
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'team' ? 'active' : ''}`}
          onClick={() => setActiveTab('team')}
        >
          <Users2 size={16} />
          <span>Team Workload &amp; Members ({teamWorkload.length})</span>
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <Activity size={16} />
          <span>Activity &amp; Audit Trail</span>
        </button>
      </nav>

      {/* ─────────────────────────────────────────────────────────────
           TAB 1: MASTER TASK GRID (WORKSPACE-WIDE VISIBILITY)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'tasks' && (
        <section className="admin-stage-panel">
          {/* Filter Bar */}
          <div className="admin-filter-bar">
            {/* Search Input */}
            <div className="admin-search-wrap">
              <Search size={15} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search all tasks by title, assignee, or sprint..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="admin-search-input"
              />
            </div>

            {/* Project Filter Dropdown */}
            <select
              className="admin-select"
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

            {/* Status Filter Dropdown */}
            <select
              className="admin-select"
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="review">In Review</option>
              <option value="completed">Completed</option>
            </select>

            {/* Priority Filter Dropdown */}
            <select
              className="admin-select"
              value={selectedPriorityFilter}
              onChange={(e) => setSelectedPriorityFilter(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Quick Pills */}
            <div className="admin-quick-pills">
              <button
                type="button"
                className={`admin-pill-btn ${quickFilter === 'all' ? 'active' : ''}`}
                onClick={() => setQuickFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`admin-pill-btn ${quickFilter === 'overdue' ? 'active' : ''}`}
                onClick={() => setQuickFilter('overdue')}
              >
                🔥 Overdue ({overview.overdueTasksCount || 0})
              </button>
              <button
                type="button"
                className={`admin-pill-btn ${quickFilter === 'stalled' ? 'active' : ''}`}
                onClick={() => setQuickFilter('stalled')}
              >
                ⏳ Stalled (&gt;7d) ({overview.stalledTasksCount || 0})
              </button>
              <button
                type="button"
                className={`admin-pill-btn ${quickFilter === 'unassigned' ? 'active' : ''}`}
                onClick={() => setQuickFilter('unassigned')}
              >
                👤 Unassigned ({overview.unassignedTasksCount || 0})
              </button>
              <button
                type="button"
                className={`admin-pill-btn ${quickFilter === 'urgent' ? 'active' : ''}`}
                onClick={() => setQuickFilter('urgent')}
              >
                ⚡ High/Urgent
              </button>
            </div>
          </div>

          {/* Master Tasks Table */}
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '35%' }}>Task Description</th>
                  <th style={{ width: '15%' }}>Project</th>
                  <th style={{ width: '16%' }}>Assignee</th>
                  <th style={{ width: '10%' }}>Priority</th>
                  <th style={{ width: '12%' }}>Due Date</th>
                  <th style={{ width: '12%' }}>Status</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="admin-table-empty">
                      <Inbox size={32} color="#cbd5e1" style={{ margin: '0 auto 12px' }} />
                      <p>No tasks match your current filter parameters.</p>
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => (
                    <tr key={task.id} className={task.isOverdue ? 'row-overdue' : ''}>
                      <td>
                        <div className="admin-task-cell">
                          <span className="admin-task-title">{task.title}</span>
                          {task.isOverdue && <span className="admin-mini-tag overdue">OVERDUE</span>}
                          {task.isStalled && <span className="admin-mini-tag stalled">INACTIVE &gt;7D</span>}
                        </div>
                      </td>

                      <td>
                        <span className="admin-project-tag">{task.sprintName}</span>
                      </td>

                      <td>
                        {task.assigneeId ? (
                          <div className="admin-assignee-cell">
                            <span className="admin-avatar-small">
                              {task.assigneeName.charAt(0).toUpperCase()}
                            </span>
                            <span className="admin-assignee-name">{task.assigneeName}</span>
                          </div>
                        ) : (
                          <span className="admin-unassigned-tag">Unassigned</span>
                        )}
                      </td>

                      <td>
                        <span className={`admin-priority-badge ${task.priority}`}>
                          {task.priority.toUpperCase()}
                        </span>
                      </td>

                      <td>
                        <span className={`admin-date-cell ${task.isOverdue ? 'date-overdue' : ''}`}>
                          {formatDate(task.dueDate)}
                        </span>
                      </td>

                      <td>
                        <select
                          className={`admin-status-dropdown ${task.status}`}
                          value={task.status}
                          onChange={(e) => handleTaskStatusChange(task.id, e.target.value)}
                        >
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="review">In Review</option>
                          <option value="completed">Completed</option>
                        </select>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div className="admin-actions-cell">
                          <button
                            type="button"
                            className="admin-action-btn"
                            title="Reassign or edit deadline"
                            onClick={() => setTaskToReassign(task)}
                          >
                            <UserCheck size={14} />
                          </button>

                          <button
                            type="button"
                            className="admin-action-btn delete"
                            title="Delete task"
                            onClick={() => handleDeleteTask(task.id, task.title)}
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
        <section className="admin-stage-panel">
          <div className="admin-deck-header">
            <div>
              <h2 className="admin-section-title">Workspace Projects &amp; Sprints</h2>
              <p className="admin-section-desc">Manage project deadlines, health status, leads, and archived sprints.</p>
            </div>
            <button
              type="button"
              className="admin-btn-primary"
              onClick={() => setIsNewProjectOpen(true)}
            >
              <Plus size={14} />
              <span>Create New Project</span>
            </button>
          </div>

          <div className="admin-projects-grid">
            {projects.map((proj) => (
              <div key={proj.id} className={`admin-project-card ${proj.archived ? 'card-archived' : ''}`}>
                <div className="admin-proj-card-top">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <h3 className="admin-proj-card-title">{proj.name}</h3>
                      <span className={`admin-health-badge ${proj.health}`}>
                        {proj.health.replace('_', ' ').toUpperCase()}
                      </span>
                      {proj.archived && <span className="admin-mini-tag stalled">ARCHIVED</span>}
                    </div>
                    {proj.goal && <p className="admin-proj-goal">{proj.goal}</p>}
                  </div>

                  <button
                    type="button"
                    className="admin-proj-archive-btn"
                    title={proj.archived ? 'Restore project' : 'Archive project'}
                    onClick={() => handleToggleArchiveProject(proj.id, proj.archived)}
                  >
                    {proj.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                  </button>
                </div>

                <div className="admin-proj-progress-section">
                  <div className="admin-proj-progress-labels">
                    <span>Progress</span>
                    <span><strong>{proj.progress}%</strong> ({proj.completedTasks} / {proj.totalTasks} tasks)</span>
                  </div>
                  <div className="admin-kpi-progress-bar">
                    <div
                      className="admin-kpi-progress-fill"
                      style={{
                        width: `${proj.progress}%`,
                        background: proj.health === 'critical' ? '#dc2626' : proj.health === 'at_risk' ? '#f59e0b' : '#10b981'
                      }}
                    />
                  </div>
                </div>

                <div className="admin-proj-meta-grid">
                  <div>
                    <span className="admin-meta-label">Schedule</span>
                    <span className="admin-meta-val">
                      {formatDate(proj.startDate)} &rarr; {formatDate(proj.endDate)}
                    </span>
                  </div>
                  <div>
                    <span className="admin-meta-label">Overdue</span>
                    <span className="admin-meta-val" style={{ color: proj.overdueTasks > 0 ? '#dc2626' : undefined }}>
                      {proj.overdueTasks} tasks
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
           TAB 3: TEAM WORKLOAD & MEMBERSHIP GOVERNANCE
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'team' && (
        <section className="admin-stage-panel">
          <div className="admin-deck-header">
            <div>
              <h2 className="admin-section-title">Team Workload Distribution</h2>
              <p className="admin-section-desc">Monitor member workload balance, assignments, roles, and pending invitations.</p>
            </div>
            <Link to={`/${workspaceId}/settings`} className="admin-btn-secondary" style={{ textDecoration: 'none' }}>
              <UserPlus size={14} />
              <span>Invite New Members</span>
            </Link>
          </div>

          <div className="admin-members-grid">
            {teamWorkload.map((member) => (
              <div key={member.userId} className="admin-member-card">
                <div className="admin-member-card-top">
                  <div className="admin-member-avatar-large">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4 className="admin-member-name">{member.name}</h4>
                      <span className={`admin-member-role-badge ${member.role}`}>
                        {member.role.toUpperCase()}
                      </span>
                    </div>
                    <span className="admin-member-email">{member.email}</span>
                  </div>

                  <span className={`admin-workload-badge ${member.workloadStatus.toLowerCase()}`}>
                    {member.workloadStatus}
                  </span>
                </div>

                <div className="admin-member-stats-row">
                  <div className="admin-member-stat-box">
                    <span className="admin-stat-num">{member.activeTasksCount}</span>
                    <span className="admin-stat-lbl">Active Tasks</span>
                  </div>
                  <div className="admin-member-stat-box">
                    <span className="admin-stat-num">{member.completedTasksCount}</span>
                    <span className="admin-stat-lbl">Completed</span>
                  </div>
                  <div className="admin-member-stat-box">
                    <span className="admin-stat-num" style={{ color: member.overdueTasksCount > 0 ? '#dc2626' : undefined }}>
                      {member.overdueTasksCount}
                    </span>
                    <span className="admin-stat-lbl">Overdue</span>
                  </div>
                </div>

                {/* Member Recent Pipeline */}
                {member.recentActiveTasks?.length > 0 && (
                  <div className="admin-member-tasks-preview">
                    <span className="admin-preview-title">Current Focus Queue:</span>
                    {member.recentActiveTasks.map((t) => (
                      <div key={t.id} className="admin-preview-task-item">
                        <span className="admin-preview-task-title">{t.title}</span>
                        <span className={`admin-priority-dot ${t.priority}`} title={t.priority} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Governance Actions (Safeguards enforced) */}
                <div className="admin-member-actions-footer">
                  {member.role !== 'owner' && (
                    <>
                      <button
                        type="button"
                        className="admin-btn-xs"
                        onClick={() => handleToggleMemberRole(member.userId, member.role)}
                        title={member.role === 'admin' ? 'Demote to regular member' : 'Promote to workspace admin'}
                      >
                        {member.role === 'admin' ? 'Demote to Member' : 'Promote to Admin'}
                      </button>

                      <button
                        type="button"
                        className="admin-btn-xs danger"
                        onClick={() => handleRemoveMember(member.userId, member.name, member.role)}
                        title="Remove member from workspace"
                      >
                        Remove
                      </button>
                    </>
                  )}
                  {member.role === 'owner' && (
                    <span className="admin-owner-protect-label">Protected Primary Owner</span>
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
        <section className="admin-stage-panel">
          <div className="admin-deck-header">
            <div>
              <h2 className="admin-section-title">Workspace Activity &amp; Audit Trail</h2>
              <p className="admin-section-desc">Chronological log of sensitive operations, role updates, project actions, and task events.</p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={`admin-pill-btn ${auditResourceFilter === 'all' ? 'active' : ''}`}
                onClick={() => setAuditResourceFilter('all')}
              >
                All Events
              </button>
              <button
                type="button"
                className={`admin-pill-btn ${auditResourceFilter === 'task' ? 'active' : ''}`}
                onClick={() => setAuditResourceFilter('task')}
              >
                Tasks
              </button>
              <button
                type="button"
                className={`admin-pill-btn ${auditResourceFilter === 'project' ? 'active' : ''}`}
                onClick={() => setAuditResourceFilter('project')}
              >
                Projects
              </button>
              <button
                type="button"
                className={`admin-pill-btn ${auditResourceFilter === 'member' ? 'active' : ''}`}
                onClick={() => setAuditResourceFilter('member')}
              >
                Team
              </button>
            </div>
          </div>

          <div className="admin-audit-stream">
            {filteredAuditLogs.length === 0 ? (
              <div className="admin-table-empty">
                <Activity size={32} color="#cbd5e1" style={{ margin: '0 auto 12px' }} />
                <p>No recent activity recorded for this selection.</p>
              </div>
            ) : (
              filteredAuditLogs.map((log) => (
                <div key={log.id} className="admin-audit-row">
                  <div className="admin-audit-indicator" />
                  <div className="admin-audit-body">
                    <div className="admin-audit-top">
                      <span className="admin-audit-action">{log.action}</span>
                      <span className="admin-audit-time">{formatRelativeTime(log.createdAt)}</span>
                    </div>
                    <p className="admin-audit-desc">
                      Resource: <strong>{log.resource}</strong> &bull; {log.metadata?.title ? `"${log.metadata.title}"` : log.metadata?.name ? `"${log.metadata.name}"` : 'System action'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
           MODALS
      ───────────────────────────────────────────────────────────── */}
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
    </div>
  )
}
