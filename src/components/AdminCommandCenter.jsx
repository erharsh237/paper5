import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '../lib/WorkspaceContext'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
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
  AlertCircle,
  UserCheck,
  CheckCircle2,
  Calendar,
  Trash2,
  Archive,
  ArchiveRestore,
  Shield,
  ArrowUpRight,
  UserPlus
} from 'lucide-react'
import './AdminCommandCenter.css'

export default function AdminCommandCenter({ onSwitchToPersonal }) {
  const { workspaceId, workspace, isAdmin, isOwner } = useWorkspace()
  const { user } = useAuth()

  // State
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'tasks' | 'projects' | 'team' | 'audit'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('all')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all')
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState('all')
  const [quickFilter, setQuickFilter] = useState('all') // 'all' | 'overdue' | 'stalled' | 'unassigned' | 'high'
  const [auditResourceFilter, setAuditResourceFilter] = useState('all')

  // Real-time Team Online Presence (Supabase Realtime Channel)
  const [onlineUserIds, setOnlineUserIds] = useState(new Set())

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

  // Track & subscribe to live workspace presence
  useEffect(() => {
    if (!supabase || !workspaceId || !user) return

    const channelName = `p5-workspace-presence-${workspaceId}`
    const channel = supabase.channel(channelName, {
      config: { presence: { key: user.id } }
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const userIds = new Set()
        Object.keys(state).forEach((key) => {
          ;(state[key] || []).forEach((p) => {
            if (p.userId) userIds.add(p.userId)
            if (p.email) userIds.add(p.email.toLowerCase().trim())
          })
        })
        setOnlineUserIds(userIds)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channel.track({
              userId: user.id,
              email: (user.email || '').toLowerCase().trim(),
              name: user.displayName || user.email?.split('@')[0] || 'Member',
              onlineAt: new Date().toISOString()
            })
          } catch (e) {
            console.warn('Workspace presence track error:', e)
          }
        }
      })

    return () => {
      try {
        channel.untrack()
        supabase.removeChannel(channel)
      } catch (_) {}
    }
  }, [workspaceId, user])

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

  // Count online members
  const onlineCount = useMemo(() => {
    if (teamWorkload.length === 0) return 1
    return teamWorkload.filter(isMemberOnline).length
  }, [teamWorkload, isMemberOnline])

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
    if (!window.confirm(`Delete task "${title}"?`)) return
    try {
      await deleteDeadline(workspaceId, taskId)
      setActionSuccess(`Deleted task "${title}".`)
      fetchOverview()
    } catch (err) {
      console.error('Failed to delete task:', err)
      setActionError(err?.message || 'Failed to delete task.')
    }
  }

  // Archive / Restore Project
  const handleToggleArchiveProject = async (sprintId, currentlyArchived) => {
    try {
      if (currentlyArchived) {
        await unarchiveSprint(workspaceId, sprintId)
        setActionSuccess('Project restored.')
      } else {
        await archiveSprint(workspaceId, sprintId)
        setActionSuccess('Project archived.')
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
      setActionSuccess(`Member updated to ${newRole}.`)
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
      if (quickFilter === 'overdue' && !t.isOverdue) return false
      if (quickFilter === 'stalled' && !t.isStalled) return false
      if (quickFilter === 'unassigned' && t.assigneeId) return false
      if (quickFilter === 'high' && !['urgent', 'high'].includes(t.priority)) return false

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

  return (
    <div className="admin-root-fullscreen">
      {/* ─────────────────────────────────────────────────────────────
           1. MINIMAL EXECUTIVE HEADER
      ───────────────────────────────────────────────────────────── */}
      <header className="admin-nav-header">
        <div className="admin-nav-left">
          <Link to={`/${workspaceId}`} className="admin-logo-link">
            <Paper5Logo size={20} decorative />
            <span className="admin-logo-text">Paper5</span>
            <span className="admin-ws-divider">/</span>
            <span className="admin-ws-name">{workspace?.name || 'Workspace'}</span>
          </Link>
          <span className="admin-pill-tag admin-tag-role">Admin</span>
        </div>

        {/* Center Live Online Presence Summary */}
        <div className="admin-presence-summary">
          <span className="status-live-dot" />
          <span className="presence-label">
            {onlineCount} of {teamWorkload.length || 1} team members online
          </span>
        </div>

        {/* Right Action Controls */}
        <div className="admin-nav-right">
          <button
            type="button"
            className="admin-btn-action"
            onClick={fetchOverview}
            title="Refresh workspace telemetry"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="admin-btn-action"
            onClick={handleExportCSV}
            title="Export workspace tasks to CSV"
          >
            <Download size={13} />
            <span>Export</span>
          </button>

          <button
            type="button"
            className="admin-btn-action primary"
            onClick={() => setIsNewProjectOpen(true)}
          >
            <Plus size={13} />
            <span>New Project</span>
          </button>

          <button
            type="button"
            className="admin-btn-action dark"
            onClick={() => setIsNewTaskOpen(true)}
          >
            <CheckSquare size={13} />
            <span>New Task</span>
          </button>

          <button
            type="button"
            className="admin-btn-action subtle"
            onClick={onSwitchToPersonal}
            title="Switch to personal task focus"
          >
            <span>Personal View &rarr;</span>
          </button>
        </div>
      </header>

      {/* Action Notices */}
      {actionSuccess && (
        <div className="admin-notice success">
          <CheckCircle2 size={14} />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="admin-notice error">
          <AlertCircle size={14} />
          <span>{actionError}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
           2. HIGH-DENSITY EXECUTIVE TELEMETRY ROW (NO EMOJIS, PURE DATA)
      ───────────────────────────────────────────────────────────── */}
      <section className="admin-telemetry-row">
        <div className="telemetry-cell">
          <span className="telemetry-label">Active Projects</span>
          <div className="telemetry-val-row">
            <span className="telemetry-number">{overview.activeProjectsCount ?? 0}</span>
            <span className="telemetry-sub">of {overview.totalProjects ?? 0}</span>
          </div>
          <span className="telemetry-detail">
            {overview.attentionProjectsCount > 0 ? `${overview.attentionProjectsCount} require attention` : 'All projects on track'}
          </span>
        </div>

        <div className="telemetry-cell">
          <span className="telemetry-label">Task Throughput</span>
          <div className="telemetry-val-row">
            <span className="telemetry-number">{overview.overallProductivity ?? 100}%</span>
            <span className="telemetry-sub">{overview.completedTasksCount || 0} / {overview.totalTasks || 0} done</span>
          </div>
          <span className="telemetry-detail">
            {overview.inProgressTasksCount || 0} in progress &bull; {overview.reviewTasksCount || 0} in review
          </span>
        </div>

        <div className="telemetry-cell">
          <span className="telemetry-label">Critical Queue</span>
          <div className="telemetry-val-row">
            <span className="telemetry-number" style={{ color: overview.overdueTasksCount > 0 ? '#b91c1c' : undefined }}>
              {overview.overdueTasksCount || 0}
            </span>
            <span className="telemetry-sub">overdue</span>
          </div>
          <span className="telemetry-detail">
            {overview.stalledTasksCount || 0} inactive &gt;7d &bull; {overview.unassignedTasksCount || 0} unassigned
          </span>
        </div>

        <div className="telemetry-cell">
          <span className="telemetry-label">Team Presence &amp; Load</span>
          <div className="telemetry-val-row">
            <span className="telemetry-number">{onlineCount}</span>
            <span className="telemetry-sub">online now</span>
          </div>
          <span className="telemetry-detail">
            {teamWorkload.filter((m) => m.workloadStatus === 'Overloaded').length > 0
              ? `${teamWorkload.filter((m) => m.workloadStatus === 'Overloaded').length} team members overloaded`
              : 'Workloads distributed'}
          </span>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
           3. WHO IS ONLINE TEAM STRIP (REAL-TIME LIVE PRESENCE)
      ───────────────────────────────────────────────────────────── */}
      <section className="admin-presence-strip">
        <div className="presence-strip-header">
          <span className="presence-strip-title">Team Roster</span>
          <span className="presence-strip-count">
            {onlineCount} online &bull; {teamWorkload.length} total members
          </span>
        </div>

        <div className="presence-members-scroll">
          {teamWorkload.map((m) => {
            const online = isMemberOnline(m)
            return (
              <div key={m.userId} className={`presence-member-pill ${online ? 'is-online' : 'is-offline'}`}>
                <span className={`presence-indicator-dot ${online ? 'online' : 'offline'}`} />
                <span className="presence-member-name">{m.name}</span>
                <span className="presence-member-role">{m.role}</span>
                <span className="presence-member-tasks">{m.activeTasksCount} active</span>
              </div>
            )
          })}
          {invites.map((inv) => (
            <div key={inv.id} className="presence-member-pill is-pending">
              <span className="presence-indicator-dot pending" />
              <span className="presence-member-name">{inv.email}</span>
              <span className="presence-member-role">Pending Invite</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
           4. NAVIGATION TABS (Tasks, Projects, Team, Audit)
      ───────────────────────────────────────────────────────────── */}
      <nav className="admin-section-nav">
        <div className="admin-nav-tabs">
          <button
            type="button"
            className={`admin-section-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            Overview
          </button>
          <button
            type="button"
            className={`admin-section-tab ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            Master Task Grid ({overview.totalTasks || 0})
          </button>
          <button
            type="button"
            className={`admin-section-tab ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            Projects ({overview.totalProjects || 0})
          </button>
          <button
            type="button"
            className={`admin-section-tab ${activeTab === 'team' ? 'active' : ''}`}
            onClick={() => setActiveTab('team')}
          >
            Team Workload ({teamWorkload.length})
          </button>
          <button
            type="button"
            className={`admin-section-tab ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            Audit Log
          </button>
        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────────────
           5. MAIN DATA STAGE (HIGH DENSITY, NO SLOP)
      ───────────────────────────────────────────────────────────── */}
      {/* VIEW: ALL (OVERVIEW DUAL-COLUMN HIGH DENSITY) */}
      {(activeTab === 'all' || activeTab === 'tasks') && (
        <section className="admin-content-stage">
          {/* Filter Bar (Pure text, zero emojis) */}
          <div className="admin-filter-bar">
            <div className="admin-search-wrapper">
              <Search size={14} color="#71717a" />
              <input
                type="text"
                placeholder="Filter tasks by name, assignee, or sprint..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="admin-search-field"
              />
            </div>

            <select
              className="admin-filter-select"
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
              className="admin-filter-select"
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
              className="admin-filter-select"
              value={selectedPriorityFilter}
              onChange={(e) => setSelectedPriorityFilter(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Quick text filter tabs (Clean text, no emojis) */}
            <div className="admin-text-filters">
              <button
                type="button"
                className={`filter-text-btn ${quickFilter === 'all' ? 'active' : ''}`}
                onClick={() => setQuickFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`filter-text-btn ${quickFilter === 'overdue' ? 'active' : ''}`}
                onClick={() => setQuickFilter('overdue')}
              >
                Overdue ({overview.overdueTasksCount || 0})
              </button>
              <button
                type="button"
                className={`filter-text-btn ${quickFilter === 'stalled' ? 'active' : ''}`}
                onClick={() => setQuickFilter('stalled')}
              >
                Inactive &gt;7d ({overview.stalledTasksCount || 0})
              </button>
              <button
                type="button"
                className={`filter-text-btn ${quickFilter === 'unassigned' ? 'active' : ''}`}
                onClick={() => setQuickFilter('unassigned')}
              >
                Unassigned ({overview.unassignedTasksCount || 0})
              </button>
              <button
                type="button"
                className={`filter-text-btn ${quickFilter === 'high' ? 'active' : ''}`}
                onClick={() => setQuickFilter('high')}
              >
                High Priority
              </button>
            </div>
          </div>

          {/* Master Tasks Table (High Data Density, Clean Typography) */}
          <div className="admin-table-wrapper">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Task Description</th>
                  <th style={{ width: '16%' }}>Project</th>
                  <th style={{ width: '16%' }}>Assignee</th>
                  <th style={{ width: '10%' }}>Priority</th>
                  <th style={{ width: '10%' }}>Due Date</th>
                  <th style={{ width: '8%' }}>Status</th>
                  <th style={{ width: '8%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="admin-empty-row">
                      No tasks found matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((t) => (
                    <tr key={t.id} className={t.isOverdue ? 'is-overdue-row' : ''}>
                      <td>
                        <div className="task-title-group">
                          <span className="task-primary-title">{t.title}</span>
                          <div className="task-flags">
                            {t.isOverdue && <span className="clean-flag flag-overdue">Overdue</span>}
                            {t.isStalled && <span className="clean-flag flag-stalled">Inactive &gt;7d</span>}
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="clean-project-name">{t.sprintName}</span>
                      </td>

                      <td>
                        {t.assigneeId ? (
                          <div className="assignee-identity">
                            <span className="assignee-text">{t.assigneeName}</span>
                          </div>
                        ) : (
                          <span className="assignee-unassigned">Unassigned</span>
                        )}
                      </td>

                      <td>
                        <span className={`priority-text priority-${t.priority}`}>
                          {t.priority}
                        </span>
                      </td>

                      <td>
                        <span className={`due-date-text ${t.isOverdue ? 'date-alert' : ''}`}>
                          {formatDate(t.dueDate)}
                        </span>
                      </td>

                      <td>
                        <select
                          className={`status-select-clean status-${t.status}`}
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
                        <div className="table-actions-group">
                          <button
                            type="button"
                            className="clean-action-btn"
                            title="Reassign or edit deadline"
                            onClick={() => setTaskToReassign(t)}
                          >
                            <UserCheck size={13} />
                          </button>
                          <button
                            type="button"
                            className="clean-action-btn danger"
                            title="Delete task"
                            onClick={() => handleDeleteTask(t.id, t.title)}
                          >
                            <Trash2 size={13} />
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

      {/* VIEW: PROJECTS */}
      {(activeTab === 'all' || activeTab === 'projects') && (
        <section className="admin-content-stage" style={{ marginTop: activeTab === 'all' ? '24px' : '0' }}>
          <div className="stage-section-header">
            <div>
              <h2 className="stage-title">Projects &amp; Sprints</h2>
              <span className="stage-sub">{projects.length} total projects</span>
            </div>
            <button
              type="button"
              className="admin-btn-action primary"
              onClick={() => setIsNewProjectOpen(true)}
            >
              <Plus size={13} />
              <span>New Project</span>
            </button>
          </div>

          <div className="admin-projects-table-wrap">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Project Name &amp; Goal</th>
                  <th style={{ width: '15%' }}>Health Status</th>
                  <th style={{ width: '25%' }}>Progress &amp; Completion</th>
                  <th style={{ width: '20%' }}>Schedule</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div>
                        <strong className="proj-name-text">{p.name}</strong>
                        {p.goal && <p className="proj-goal-text">{p.goal}</p>}
                      </div>
                    </td>

                    <td>
                      <span className={`clean-health-tag health-${p.health}`}>
                        {p.health.replace('_', ' ')}
                      </span>
                    </td>

                    <td>
                      <div className="proj-progress-row">
                        <div className="clean-progress-track">
                          <div
                            className="clean-progress-bar"
                            style={{
                              width: `${p.progress}%`,
                              background: p.health === 'critical' ? '#dc2626' : p.health === 'at_risk' ? '#d97706' : '#10b981'
                            }}
                          />
                        </div>
                        <span className="progress-fraction">{p.progress}% ({p.completedTasks}/{p.totalTasks})</span>
                      </div>
                    </td>

                    <td>
                      <span className="schedule-dates">
                        {formatDate(p.startDate)} &rarr; {formatDate(p.endDate)}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="clean-action-btn"
                        title={p.archived ? 'Restore project' : 'Archive project'}
                        onClick={() => handleToggleArchiveProject(p.id, p.archived)}
                      >
                        {p.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* VIEW: TEAM WORKLOAD */}
      {(activeTab === 'all' || activeTab === 'team') && (
        <section className="admin-content-stage" style={{ marginTop: activeTab === 'all' ? '24px' : '0' }}>
          <div className="stage-section-header">
            <div>
              <h2 className="stage-title">Team Workload &amp; Members</h2>
              <span className="stage-sub">{teamWorkload.length} workspace members</span>
            </div>
            <Link to={`/${workspaceId}/settings`} className="admin-btn-action" style={{ textDecoration: 'none' }}>
              <UserPlus size={13} />
              <span>Invite Members</span>
            </Link>
          </div>

          <div className="admin-team-table-wrap">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>Member Identity</th>
                  <th style={{ width: '12%' }}>Live Status</th>
                  <th style={{ width: '12%' }}>Role</th>
                  <th style={{ width: '14%' }}>Workload Status</th>
                  <th style={{ width: '20%' }}>Task Counters</th>
                  <th style={{ width: '14%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teamWorkload.map((m) => {
                  const online = isMemberOnline(m)
                  return (
                    <tr key={m.userId}>
                      <td>
                        <div className="team-member-cell">
                          <strong className="member-name-text">{m.name}</strong>
                          <span className="member-email-text">{m.email}</span>
                        </div>
                      </td>

                      <td>
                        <span className={`clean-presence-badge ${online ? 'online' : 'offline'}`}>
                          <span className={`status-dot ${online ? 'online' : 'offline'}`} />
                          {online ? 'Online now' : 'Offline'}
                        </span>
                      </td>

                      <td>
                        <span className="clean-role-text">{m.role}</span>
                      </td>

                      <td>
                        <span className={`workload-text-tag workload-${m.workloadStatus.toLowerCase()}`}>
                          {m.workloadStatus}
                        </span>
                      </td>

                      <td>
                        <span className="member-task-stats">
                          <strong>{m.activeTasksCount}</strong> active &bull; <strong>{m.completedTasksCount}</strong> done
                          {m.overdueTasksCount > 0 && (
                            <span style={{ color: '#dc2626', marginLeft: '6px' }}>({m.overdueTasksCount} overdue)</span>
                          )}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        {m.role !== 'owner' ? (
                          <div className="table-actions-group">
                            <button
                              type="button"
                              className="clean-text-action"
                              onClick={() => handleToggleMemberRole(m.userId, m.role)}
                            >
                              {m.role === 'admin' ? 'Demote' : 'Promote'}
                            </button>
                            <button
                              type="button"
                              className="clean-text-action danger"
                              onClick={() => handleRemoveMember(m.userId, m.name, m.role)}
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <span className="owner-protect-label">Owner</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* VIEW: AUDIT LOG */}
      {(activeTab === 'all' || activeTab === 'audit') && (
        <section className="admin-content-stage" style={{ marginTop: activeTab === 'all' ? '24px' : '0' }}>
          <div className="stage-section-header">
            <div>
              <h2 className="stage-title">Activity &amp; Audit Trail</h2>
              <span className="stage-sub">Recent workspace modifications</span>
            </div>

            <div className="admin-text-filters">
              <button
                type="button"
                className={`filter-text-btn ${auditResourceFilter === 'all' ? 'active' : ''}`}
                onClick={() => setAuditResourceFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`filter-text-btn ${auditResourceFilter === 'task' ? 'active' : ''}`}
                onClick={() => setAuditResourceFilter('task')}
              >
                Tasks
              </button>
              <button
                type="button"
                className={`filter-text-btn ${auditResourceFilter === 'project' ? 'active' : ''}`}
                onClick={() => setAuditResourceFilter('project')}
              >
                Projects
              </button>
              <button
                type="button"
                className={`filter-text-btn ${auditResourceFilter === 'member' ? 'active' : ''}`}
                onClick={() => setAuditResourceFilter('member')}
              >
                Team
              </button>
            </div>
          </div>

          <div className="admin-audit-table-wrap">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Action</th>
                  <th style={{ width: '16%' }}>Resource</th>
                  <th style={{ width: '48%' }}>Context &amp; Details</th>
                  <th style={{ width: '14%', textAlign: 'right' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="admin-empty-row">No audit records found.</td>
                  </tr>
                ) : (
                  filteredAuditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <code className="audit-action-code">{log.action}</code>
                      </td>
                      <td>
                        <span className="audit-resource-text">{log.resource}</span>
                      </td>
                      <td>
                        <span className="audit-detail-text">
                          {log.metadata?.title ? `"${log.metadata.title}"` : log.metadata?.name ? `"${log.metadata.name}"` : 'Workspace modification'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="audit-time-text">{formatRelativeTime(log.createdAt)}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
    </div>
  )
}
