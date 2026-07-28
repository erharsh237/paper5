import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import './NavTabs.css'

// Two primary destinations stay always visible; everything else collapses
// into a "More" menu. Seven flat tabs never fit a phone width no matter how
// much horizontal scroll you bolt on — this fixes the actual layout problem
// instead of working around it.
const PRIMARY = [
  { to: '/', end: true, label: 'My tasks', icon: HomeIcon },
  { to: '/team', label: 'Team', icon: TeamIcon },
]

const SECONDARY = [
  { to: '/meeting', label: 'Meeting', icon: MeetingIcon },
  { to: '/analytics', label: 'Analytics', icon: AnalyticsIcon },
  { to: '/integrations', label: 'Integrations', icon: IntegrationsIcon },
  { to: '/ai', label: 'AI Assistant', icon: AIIcon },
  { to: '/profile', label: 'Profile', icon: ProfileIcon },
]

export default function NavTabs() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const wrapRef = useRef(null)

  const isSecondaryActive = SECONDARY.some(item => location.pathname === item.to)

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // Close the dropdown automatically after navigating to one of its items.
  useEffect(() => { setOpen(false) }, [location.pathname])

  return (
    <nav className="nav-tabs">
      {PRIMARY.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `nav-tab${isActive ? ' nav-tab--active' : ''}`}
        >
          <item.icon />
          <span className="nav-tab-label">{item.label}</span>
        </NavLink>
      ))}

      <div className="nav-more-wrap" ref={wrapRef}>
        <button
          type="button"
          className={`nav-tab nav-more-btn${isSecondaryActive ? ' nav-tab--active' : ''}`}
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <MoreIcon />
          <span className="nav-tab-label">More</span>
          <ChevronIcon className={open ? 'nav-chevron nav-chevron--open' : 'nav-chevron'} />
        </button>

        {open && (
          <div className="nav-more-menu" role="menu">
            {SECONDARY.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-more-item${isActive ? ' nav-more-item--active' : ''}`}
                role="menuitem"
              >
                <item.icon />
                {item.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}

// Small inline icons — no icon-library dependency, keeps the bundle lean.
function iconProps(extra) { return { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...extra } }

function HomeIcon() { return <svg {...iconProps()}><path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10h14V10" /></svg> }
function TeamIcon() { return <svg {...iconProps()}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M15 14.5c2.6.4 4.5 2.6 4.5 5.5" /></svg> }
function MeetingIcon() { return <svg {...iconProps()}><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg> }
function AnalyticsIcon() { return <svg {...iconProps()}><path d="M4 20V10M12 20V4M20 20v-7" /></svg> }
function IntegrationsIcon() { return <svg {...iconProps()}><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /><path d="M11 7h4a2 2 0 0 1 2 2v4M7 11v4a2 2 0 0 0 2 2h4" /></svg> }
function AIIcon() { return <svg {...iconProps()}><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" /><circle cx="12" cy="12" r="3" /></svg> }
function ProfileIcon() { return <svg {...iconProps()}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" /></svg> }
function MoreIcon() { return <svg {...iconProps()}><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" /></svg> }
function ChevronIcon({ className }) { return <svg className={className} {...iconProps({ width: 11, height: 11 })}><path d="m6 9 6 6 6-6" /></svg> }
