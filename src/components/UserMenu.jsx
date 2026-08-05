import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
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
function AccountIcon() { return <svg {...iconProps({ width: 18, height: 18 })}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" /></svg> }
function FeedbackIcon() { return <svg {...iconProps()}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg> }

export default function UserMenu() {
  const { user, logout } = useAuth()
  const { workspaceId, isAdmin } = useWorkspace()
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

  return (
    <div className="nav-more-wrap" ref={wrapRef} style={{ marginLeft: '4px' }}>
      <button
        type="button"
        className="btn-ghost"
        style={{ padding: '4px', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        title={user?.displayName || user?.email}
      >
        <AccountIcon />
      </button>

      {open && (
        <div className="nav-more-menu" role="menu" style={{ right: 0, minWidth: '200px', zIndex: 50, background: 'var(--bg-layer)' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.displayName || 'User'}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
          </div>
          
          <NavLink to={getPath('/profile')} className={({ isActive }) => `nav-more-item${isActive ? ' nav-more-item--active' : ''}`} onClick={() => setOpen(false)}>
            <ProfileIcon /> Profile
          </NavLink>

          {isAdmin && (
            <>
              <NavLink to={getPath('/settings')} className={({ isActive }) => `nav-more-item${isActive ? ' nav-more-item--active' : ''}`} onClick={() => setOpen(false)}>
                <SettingsIcon /> Settings
              </NavLink>
              <NavLink to={getPath('/integrations')} className={({ isActive }) => `nav-more-item${isActive ? ' nav-more-item--active' : ''}`} onClick={() => setOpen(false)}>
                <IntegrationsIcon /> Integrations
              </NavLink>
            </>
          )}

          {workspaces.length > 1 && (
            <a href="/workspace?picker=true" className="nav-more-item" onClick={() => setOpen(false)}>
              <SwitchIcon /> Switch Workspace
            </a>
          )}

          <button
            type="button"
            className="nav-more-item"
            onClick={() => { setOpen(false); setIsFeedbackOpen(true); }}
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <FeedbackIcon /> Send Feedback
          </button>

          <div style={{ margin: '4px 0', borderTop: '1px solid var(--border-subtle)' }} />

          <button 
            className="nav-more-item" 
            onClick={() => { setOpen(false); logout(); }}
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--accent-critical)' }}
          >
            <LogOutIcon /> Sign out
          </button>
        </div>
      )}

      <button
        type="button"
        className="btn-ghost"
        onClick={() => setIsFeedbackOpen(true)}
        style={{
          padding: '4px 10px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(15, 157, 99, 0.1)',
          border: '1px solid rgba(15, 157, 99, 0.25)',
          color: 'var(--accent-signal, #0f9d63)',
          cursor: 'pointer',
          marginLeft: '6px'
        }}
        title="Send feedback to SprintOS product team"
      >
        💬 Feedback
      </button>

      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </div>
  )
}
