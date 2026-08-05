import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useWorkspace } from '../lib/WorkspaceContext'
import { useAuth } from '../lib/AuthContext'
import { subscribeUserWorkspaces } from '../lib/workspaces'
import './NavTabs.css'

// Two primary destinations stay always visible; everything else collapses
// into a "More" menu. Seven flat tabs never fit a phone width no matter how
// much horizontal scroll you bolt on — this fixes the actual layout problem
// instead of working around it.
const PRIMARY = [
  { to: '/', end: true, label: 'My tasks', icon: HomeIcon },
  { to: '/team', label: 'Team', icon: TeamIcon },
  { to: '/meeting', label: 'Meeting', icon: MeetingIcon },
  { to: '/analytics', label: 'Analytics', icon: AnalyticsIcon },
]

export default function NavTabs() {
  const { workspaceId } = useWorkspace()
  const location = useLocation()
  
  const getPath = (path) => `/${workspaceId}${path === '/' ? '' : path}`

  return (
    <nav className="nav-tabs">
      {PRIMARY.map(item => (
        <NavLink
          key={item.to}
          to={getPath(item.to)}
          end={item.end}
          className={({ isActive }) => `nav-tab${isActive ? ' nav-tab--active' : ''}`}
        >
          <item.icon />
          <span className="nav-tab-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

// Small inline icons — no icon-library dependency, keeps the bundle lean.
function iconProps(extra) { return { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...extra } }

function HomeIcon() { return <svg {...iconProps()}><path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10h14V10" /></svg> }
function TeamIcon() { return <svg {...iconProps()}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M15 14.5c2.6.4 4.5 2.6 4.5 5.5" /></svg> }
function MeetingIcon() { return <svg {...iconProps()}><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg> }
function AnalyticsIcon() { return <svg {...iconProps()}><path d="M4 20V10M12 20V4M20 20v-7" /></svg> }
