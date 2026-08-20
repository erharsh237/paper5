import { useState, useRef, useEffect, useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useWorkspace } from '../lib/WorkspaceContext'
import { subscribeUserWorkspaces } from '../lib/workspaces'
import FeedbackModal from './FeedbackModal'

function iconProps(extra) { return { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...extra } }
function SettingsIcon() { return <svg {...iconProps()}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg> }
function IntegrationsIcon() { return <svg {...iconProps()}><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /><path d="M11 7h4a2 2 0 0 1 2 2v4M7 11v4a2 2 0 0 0 2 2h4" /></svg> }
function ProfileIcon() { return <svg {...iconProps()}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" /></svg> }
function SwitchIcon() { return <svg {...iconProps()}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" x2="4" y1="22" y2="15" /></svg> }
function LogOutIcon() { return <svg {...iconProps()}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg> }

export default function UserMenu() {
  const { user, logout } = useAuth()
  const { workspaceId, isAdmin, canManageSettings } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const wrapRef = useRef(null)
  const [workspaces, setWorkspaces] = useState([])

  useEffect(() => {
    if (!user?.uid) return
    const unsub = subscribeUserWorkspaces(user.uid, setWorkspaces)
    return unsub
  }, [user?.uid])

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const getPath = (path) => `/${workspaceId}${path}`

  // User initials (e.g. "HK")
  const initials = useMemo(() => {
    if (user?.displayName) {
      const parts = user.displayName.trim().split(' ').filter(Boolean)
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase()
    }
    return 'U'
  }, [user])

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      <button
        type="button"
        onClick={() => setIsFeedbackOpen(true)}
        style={{
          padding: '6px 14px',
          borderRadius: '100px',
          fontSize: '12.5px',
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          background: 'var(--surface, #FFFFFF)',
          border: '1px solid var(--border-soft, #EAECF6)',
          color: 'var(--muted, #6E7091)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 3px rgba(30, 32, 80, 0.05)',
          transition: 'all 0.15s ease'
        }}
        title="Send feedback"
      >
        Feedback
      </button>

      <div className="nav-more-wrap" ref={wrapRef} style={{ position: 'relative' }}>
        <button
          type="button"
          style={{
            padding: 0,
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--accent, #4F46E5)',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '11.5px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 0 0 2px var(--surface), 0 0 0 4px rgba(79, 70, 229, 0.2)',
            transition: 'box-shadow 0.2s'
          }}
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          title={user?.displayName || user?.email}
        >
          {initials}
        </button>

        {open && (
          <div className="nav-more-menu" role="menu" style={{ right: 0, minWidth: '200px', zIndex: 50, background: 'var(--surface, #FFFFFF)', borderRadius: '12px', border: '1px solid var(--border-soft)', boxShadow: '0 8px 24px rgba(30, 32, 80, 0.12)', padding: '6px' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-soft)', marginBottom: '4px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text, #1C1D2B)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.displayName || 'User'}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted, #6E7091)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
            </div>
            
            <NavLink to={getPath('/profile')} className={({ isActive }) => `nav-more-item${isActive ? ' nav-more-item--active' : ''}`} onClick={() => setOpen(false)}>
              <ProfileIcon /> Profile
            </NavLink>

            {(isAdmin || canManageSettings) && (
              <NavLink to={getPath('/settings')} className={({ isActive }) => `nav-more-item${isActive ? ' nav-more-item--active' : ''}`} onClick={() => setOpen(false)}>
                <SettingsIcon /> Settings
              </NavLink>
            )}

            {isAdmin && (
              <NavLink to={getPath('/integrations')} className={({ isActive }) => `nav-more-item${isActive ? ' nav-more-item--active' : ''}`} onClick={() => setOpen(false)}>
                <IntegrationsIcon /> Integrations
              </NavLink>
            )}

            {workspaces.length > 1 && (
              <a href="/workspace?picker=true" className="nav-more-item" onClick={() => setOpen(false)}>
                <SwitchIcon /> Switch Workspace
              </a>
            )}

            <div style={{ margin: '4px 0', borderTop: '1px solid var(--border-soft)' }} />

            <button 
              className="nav-more-item" 
              onClick={() => { setOpen(false); logout(); }}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--red, #D14343)' }}
            >
              <LogOutIcon /> Sign out
            </button>
          </div>
        )}
      </div>

      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </div>
  )
}
