import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useWorkspace } from '../lib/WorkspaceContext'
import { prefetchRoute, scheduleBackgroundPrefetch } from '../lib/routePrefetch'
import './NavTabs.css'

function iconProps(extra) {
  return {
    width: 15,
    height: 15,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ...extra
  }
}

function GridIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function WorkflowIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="3" width="6" height="6" rx="1.5" />
      <rect x="15" y="15" width="6" height="6" rx="1.5" />
      <path d="M6 9v3a3 3 0 0 0 3 3h6" />
    </svg>
  )
}

function BoardIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18M15 3v18" />
    </svg>
  )
}

function MeetingIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function AnalyticsIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

const PRIMARY = [
  { to: '/', end: true, label: 'Overview', tooltip: 'Command Center & Telemetry', icon: GridIcon },
  { to: '/workflow', label: 'Workflow', tooltip: 'Agile Methodology & Workflows', icon: WorkflowIcon },
  { to: '/team', label: 'Board', tooltip: 'Sprint Kanban Board & Tasks', icon: BoardIcon },
  { to: '/meeting', label: 'Meetings', tooltip: 'Standups & Sync Notes', icon: MeetingIcon },
  { to: '/analytics', label: 'Analytics', tooltip: 'Velocity & Burn-down Telemetry', icon: AnalyticsIcon },
]

export default function NavTabs() {
  const { workspaceId, isAdmin, onlineCount } = useWorkspace()

  const getPath = (path) => `/${workspaceId}${path === '/' ? '' : path}`

  useEffect(() => {
    scheduleBackgroundPrefetch(true)
  }, [])

  return (
    <div className="nav-tabs-wrapper">
      <nav className="nav-tabs" aria-label="Main Navigation">
        {PRIMARY.map((item) => (
          <NavLink
            key={item.to}
            to={getPath(item.to)}
            end={item.end}
            onMouseEnter={() => prefetchRoute(item.to)}
            onFocus={() => prefetchRoute(item.to)}
            onTouchStart={() => prefetchRoute(item.to)}
            className={({ isActive }) => `nav-tab${isActive ? ' nav-tab--active' : ''}`}
            data-tooltip={item.tooltip}
          >
            <item.icon />
            <span className="nav-tab-label">{item.label}</span>
            <span className="nav-tab-floating-tooltip">{item.tooltip}</span>
          </NavLink>
        ))}

        {isAdmin && (
          <NavLink
            to={getPath('/settings')}
            onMouseEnter={() => prefetchRoute('/settings')}
            onFocus={() => prefetchRoute('/settings')}
            onTouchStart={() => prefetchRoute('/settings')}
            className={({ isActive }) => `nav-tab${isActive ? ' nav-tab--active' : ''}`}
            data-tooltip="Workspace Settings & Roles"
          >
            <SettingsIcon />
            <span className="nav-tab-label">Settings</span>
            <span className="nav-tab-floating-tooltip">Workspace Settings & Roles</span>
          </NavLink>
        )}
      </nav>

      {/* Real-time Presence Pulse Badge */}
      <div className="nav-presence-badge" title={`${onlineCount} team member${onlineCount === 1 ? '' : 's'} online now`}>
        <span className="nav-presence-dot" />
        <span className="nav-presence-text">{onlineCount} online</span>
      </div>
    </div>
  )
}
