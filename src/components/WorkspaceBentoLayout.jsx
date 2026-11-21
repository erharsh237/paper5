import React, { useState, useEffect, useMemo, useCallback, createContext, useContext } from 'react'
import { NavLink, useLocation, useNavigate, Link } from 'react-router-dom'
import { useWorkspace } from '../lib/WorkspaceContext'
import { useAuth } from '../lib/AuthContext'
import Paper5Logo from './Paper5Logo'
import NotificationBell from './NotificationBell'
import UserMenu from './UserMenu'
import NewDeadlineModal from './NewDeadlineModal'
import CreateProjectModal from './CreateProjectModal'
import {
  LayoutGrid,
  Kanban,
  GitBranch,
  Calendar,
  TrendingUp,
  Shield,
  Plug,
  HelpCircle,
  RefreshCw,
  Plus,
  Download,
  ChevronRight,
  SlidersHorizontal,
  CheckSquare
} from 'lucide-react'
import './AdminCommandCenter.css'
import './WorkspaceBentoLayout.css'

export const WorkspaceBentoContext = createContext(null)
export const useWorkspaceBento = () => useContext(WorkspaceBentoContext)

export default function WorkspaceBentoLayout({ children }) {
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
  const location = useLocation()
  const navigate = useNavigate()

  // Modals & Popovers
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false)
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false)
  const [isOnlinePopoverOpen, setIsOnlinePopoverOpen] = useState(false)

  // Real-time Presence
  const onlineUserIds = contextOnlineUserIds || new Set()

  // Workspace cached data for topbar modals and presence
  const [teamMembers, setTeamMembers] = useState([])
  const [projects, setProjects] = useState([])

  const fetchWorkspaceData = useCallback(async () => {
    if (!workspaceId) return
    try {
      const resp = await fetch(`/api/admin?workspaceId=${encodeURIComponent(workspaceId)}&action=overview`)
      if (resp.ok) {
        const json = await resp.json()
        setTeamMembers(json.members || [])
        setProjects(json.sprints || [])
      }
    } catch (_) {}
  }, [workspaceId])

  useEffect(() => {
    fetchWorkspaceData()
  }, [fetchWorkspaceData])

  // Listen for cross-component workspace updates
  useEffect(() => {
    const handleWorkspaceUpdated = () => {
      fetchWorkspaceData()
    }
    window.addEventListener('p5:workspace-updated', handleWorkspaceUpdated)
    return () => window.removeEventListener('p5:workspace-updated', handleWorkspaceUpdated)
  }, [fetchWorkspaceData])

  // Member online check
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

  // Keyboard navigation shortcuts (⌘1 - ⌘5)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        if (e.key === '1') { e.preventDefault(); navigate(`/${workspaceId}`) }
        if (e.key === '2') { e.preventDefault(); navigate(`/${workspaceId}/team`) }
        if (e.key === '3') { e.preventDefault(); navigate(`/${workspaceId}/workflow`) }
        if (e.key === '4') { e.preventDefault(); navigate(`/${workspaceId}/meeting`) }
        if (e.key === '5') { e.preventDefault(); navigate(`/${workspaceId}/analytics`) }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [workspaceId, navigate])

  // Dynamic header metadata based on current sub-path
  const headerMeta = useMemo(() => {
    const p = location.pathname.replace(new RegExp(`^/${workspaceId}`), '') || '/'
    if (p === '/' || p === '') {
      const name = user?.user_metadata?.first_name || (user?.email ? user.email.split('@')[0] : 'Admin')
      const formatted = name.charAt(0).toUpperCase() + name.slice(1)
      return {
        isOverview: true,
        title: `Hello, ${formatted}`,
        sub: 'View and govern your workspace operations, projects & team deliverables.'
      }
    }
    if (p.startsWith('/team')) {
      return {
        isOverview: false,
        title: 'Sprint Board',
        sub: 'Manage sprints, columns, and task workflows across teams.'
      }
    }
    if (p.startsWith('/workflow')) {
      return {
        isOverview: false,
        title: 'Agile Workflows',
        sub: 'Visual agile lifecycle and stage transitions.'
      }
    }
    if (p.startsWith('/meeting')) {
      return {
        isOverview: false,
        title: 'Sync Meetings',
        sub: 'Schedule, run, and review team syncs & action items.'
      }
    }
    if (p.startsWith('/analytics')) {
      return {
        isOverview: false,
        title: 'Telemetry & Analytics',
        sub: 'Velocity tracking, burn-down telemetry, and project health.'
      }
    }
    if (p.startsWith('/settings')) {
      return {
        isOverview: false,
        title: 'Workspace Governance',
        sub: 'Configure workspace members, roles, security, and billing.'
      }
    }
    if (p.startsWith('/integrations')) {
      return {
        isOverview: false,
        title: 'API Studio & Integrations',
        sub: 'Manage API tokens, webhook subscriptions, and external apps.'
      }
    }
    if (p.startsWith('/profile')) {
      return {
        isOverview: false,
        title: 'Account Profile',
        sub: 'Manage your credentials, preferences, and notifications.'
      }
    }
    return {
      isOverview: false,
      title: workspace?.name || 'Workspace',
      sub: 'Centralized workspace deliverables and operations.'
    }
  }, [location.pathname, workspaceId, user, workspace])

  const handleExportCSV = () => {
    window.location.href = `/api/admin?workspaceId=${encodeURIComponent(workspaceId)}&action=export&type=tasks`
  }

  const contextValue = useMemo(() => ({
    openNewTask: () => setIsNewTaskOpen(true),
    openNewProject: () => setIsNewProjectOpen(true),
    refreshWorkspace: fetchWorkspaceData,
    teamMembers,
    projects
  }), [fetchWorkspaceData, teamMembers, projects])

  return (
    <WorkspaceBentoContext.Provider value={contextValue}>
      <div className="bento-canvas">
        <div className="bento-shell">
          {/* ─────────────────────────────────────────────────────────────
               LEFT VERTICAL ICON DOCK (Identical to Fenco & Quixotic Mocks)
          ───────────────────────────────────────────────────────────── */}
          <aside className="bento-left-dock">
            <div className="dock-top-group">
              <Link to={`/${workspaceId}`} className="dock-brand-icon" title="Paper5 Workspace">
                <Paper5Logo size={22} decorative />
              </Link>

              <nav className="dock-nav-items">
                <NavLink
                  to={`/${workspaceId}`}
                  end
                  className={({ isActive }) => `dock-btn ${isActive ? 'active' : ''}`}
                  aria-label="Overview & Telemetry"
                >
                  <LayoutGrid size={19} />
                  <span className="dock-label">Overview</span>
                  <span className="dock-tooltip">Overview &amp; Telemetry (⌘1)</span>
                </NavLink>

                <NavLink
                  to={`/${workspaceId}/team`}
                  className={({ isActive }) => `dock-btn ${isActive ? 'active' : ''}`}
                  aria-label="Sprint Board & Tasks"
                >
                  <Kanban size={19} />
                  <span className="dock-label">Sprint Board</span>
                  <span className="dock-tooltip">Sprint Board (⌘2)</span>
                </NavLink>

                <NavLink
                  to={`/${workspaceId}/workflow`}
                  className={({ isActive }) => `dock-btn ${isActive ? 'active' : ''}`}
                  aria-label="Agile Workflows"
                >
                  <GitBranch size={19} />
                  <span className="dock-label">Workflows</span>
                  <span className="dock-tooltip">Agile Workflows (⌘3)</span>
                </NavLink>

                <NavLink
                  to={`/${workspaceId}/meeting`}
                  className={({ isActive }) => `dock-btn ${isActive ? 'active' : ''}`}
                  aria-label="Sync Meetings"
                >
                  <Calendar size={19} />
                  <span className="dock-label">Meetings</span>
                  <span className="dock-tooltip">Sync Meetings (⌘4)</span>
                </NavLink>

                <NavLink
                  to={`/${workspaceId}/analytics`}
                  className={({ isActive }) => `dock-btn ${isActive ? 'active' : ''}`}
                  aria-label="Velocity & Analytics"
                >
                  <TrendingUp size={19} />
                  <span className="dock-label">Velocity</span>
                  <span className="dock-tooltip">Velocity &amp; Analytics (⌘5)</span>
                </NavLink>

                <NavLink
                  to={`/${workspaceId}/settings`}
                  className={({ isActive }) => `dock-btn ${isActive ? 'active' : ''}`}
                  aria-label="Workspace Settings"
                >
                  <Shield size={19} />
                  <span className="dock-label">Settings</span>
                  <span className="dock-tooltip">Workspace Settings</span>
                </NavLink>

                <NavLink
                  to={`/${workspaceId}/integrations`}
                  className={({ isActive }) => `dock-btn ${isActive ? 'active' : ''}`}
                  aria-label="API Studio & Integrations"
                >
                  <Plug size={19} />
                  <span className="dock-label">API Studio</span>
                  <span className="dock-tooltip">API &amp; Integrations</span>
                </NavLink>
              </nav>
            </div>

            <div className="dock-bottom-group">
              <Link
                to="/docs/api"
                className="dock-btn"
                aria-label="Help & Documentation"
              >
                <HelpCircle size={19} />
                <span className="dock-label">Docs &amp; Help</span>
                <span className="dock-tooltip">Help &amp; Documentation</span>
              </Link>

              <button
                type="button"
                className="dock-btn"
                onClick={() => {
                  fetchWorkspaceData()
                  window.dispatchEvent(new CustomEvent('p5:workspace-updated'))
                }}
                aria-label="Refresh Workspace"
              >
                <RefreshCw size={18} />
                <span className="dock-label">Refresh</span>
                <span className="dock-tooltip">Refresh Workspace</span>
              </button>
            </div>
          </aside>

          {/* ─────────────────────────────────────────────────────────────
               MAIN STAGE
          ───────────────────────────────────────────────────────────── */}
          <main className="bento-main-stage">
            {/* ── TOP HEADER ── */}
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
                  {headerMeta.title}
                </h1>
                <p className="bento-subtext">
                  {headerMeta.sub}
                </p>
              </div>

              {/* Right Topbar Tools: Team Capsule, Actions, User */}
              <div className="bento-topbar-right">
                {/* Team Members Horizontal Capsule with Interactive Popover */}
                <div style={{ position: 'relative' }}>
                  <div
                    className="bento-team-capsule"
                    onClick={() => setIsOnlinePopoverOpen(prev => !prev)}
                    title="Click to view online team members"
                  >
                    <span className="bento-live-pulse-dot" />
                    <span className="bento-online-count-lbl">{onlineCount} Online</span>
                    <div className="bento-team-avatars-row">
                      {onlineList.slice(0, 6).map((m, idx) => (
                        <div
                          key={m.userId || m.email || idx}
                          className="bento-member-circle-avatar online"
                          title={`${m.name || m.email} (${m.role || 'Member'}) — Online now`}
                          style={{
                            background: m.avatarUrl ? `url(${m.avatarUrl}) center/cover` : ['#18181b', '#27272a', '#3f3f46'][idx % 3]
                          }}
                        >
                          {!m.avatarUrl && (m.name || m.email || 'M').charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {onlineList.length > 6 && (
                        <span className="bento-team-overflow">+{onlineList.length - 6}</span>
                      )}
                    </div>
                    <ChevronRight size={14} color="#94a3b8" />
                  </div>

                  {/* Dropdown Scrollable Bento Card */}
                  {isOnlinePopoverOpen && (
                    <div className="bento-online-popover-card">
                      <div className="bento-online-popover-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="bento-live-pulse-dot" />
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#18181b' }}>
                            Online Team ({onlineCount})
                          </span>
                        </div>
                        <button
                          type="button"
                          className="bento-popover-close-btn"
                          onClick={(e) => { e.stopPropagation(); setIsOnlinePopoverOpen(false); }}
                        >
                          &times;
                        </button>
                      </div>

                      <div className="bento-online-popover-scroll">
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
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
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
                  className="bento-pill-action-btn secondary"
                  onClick={() => setIsNewProjectOpen(true)}
                >
                  <Plus size={14} />
                  <span>New Project</span>
                </button>

                <button
                  type="button"
                  className="bento-pill-action-btn primary"
                  onClick={() => setIsNewTaskOpen(true)}
                >
                  <CheckSquare size={14} />
                  <span>New Task</span>
                </button>

                {/* Notifications & User Menu */}
                <div className="bento-topbar-user-group">
                  <NotificationBell currentUser={user} />
                  <UserMenu />
                </div>
              </div>
            </header>

            {/* ── ROUTE BODY ── */}
            <div className="bento-route-body">
              {children}
            </div>
          </main>
        </div>

        {/* Global Modals */}
        {isNewTaskOpen && (
          <NewDeadlineModal
            members={teamMembers}
            currentUser={user}
            activeSprint={projects.find((p) => p.status === 'active') || projects[0] || null}
            sprints={projects}
            onClose={() => setIsNewTaskOpen(false)}
            onCreated={() => {
              fetchWorkspaceData()
              window.dispatchEvent(new CustomEvent('p5:workspace-updated'))
            }}
          />
        )}

        {isNewProjectOpen && (
          <CreateProjectModal
            existingCount={projects.length}
            members={teamMembers}
            onClose={() => setIsNewProjectOpen(false)}
            onCreated={() => {
              fetchWorkspaceData()
              window.dispatchEvent(new CustomEvent('p5:workspace-updated'))
            }}
          />
        )}
      </div>
    </WorkspaceBentoContext.Provider>
  )
}
