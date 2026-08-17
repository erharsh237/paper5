import { useEffect, useState, useRef, useMemo } from 'react'
import { 
  subscribeNotifications, 
  markNotificationRead, 
  markAllNotificationsRead,
  playBellChimeSound, 
  triggerChromeNotification,
  requestNotificationPermission 
} from '../lib/notifications'
import { useWorkspace } from '../lib/WorkspaceContext'
import './NotificationBell.css'

export default function NotificationBell({ currentUser }) {
  const { workspaceId } = useWorkspace();
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const isInitialFetchRef = useRef(true)
  const prevCountRef = useRef(0)

  useEffect(() => {
    requestNotificationPermission()
  }, [])

  useEffect(() => {
    if (!currentUser?.email) return
    isInitialFetchRef.current = true

    return subscribeNotifications(workspaceId, undefined, currentUser.email, (items) => {
      setNotifications(items)

      const email = (currentUser?.email || '').toLowerCase()
      const unreadItems = items.filter(n => !n.readBy?.includes(email))
      const currentUnread = unreadItems.length

      if (!isInitialFetchRef.current && currentUnread > prevCountRef.current) {
        playBellChimeSound()
        const latestNotif = unreadItems[0]
        if (latestNotif?.message) {
          triggerChromeNotification('SprintOS Notification 🔔', {
            body: latestNotif.message,
            tag: `notif-${latestNotif.id || Date.now()}`
          })
        }
      }

      prevCountRef.current = currentUnread
      isInitialFetchRef.current = false
    })
  }, [workspaceId, currentUser?.email])

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const unreadCount = useMemo(() => {
    const email = (currentUser?.email || '').toLowerCase()
    return notifications.filter(n => !n.readBy?.includes(email)).length
  }, [notifications, currentUser?.email])

  function handleDismiss(id) {
    const email = (currentUser?.email || '').toLowerCase()
    
    // 1. Optimistic instant local update
    setNotifications(prev => prev.map(n => {
      if (n.id === id) {
        const currentRead = Array.isArray(n.readBy) ? n.readBy : []
        return { ...n, readBy: [...currentRead, email] }
      }
      return n
    }))

    // 2. Persist to DB
    markNotificationRead(workspaceId, id, currentUser?.email)
  }

  function handleDismissAll() {
    const email = (currentUser?.email || '').toLowerCase()
    setNotifications(prev => prev.map(n => {
      const currentRead = Array.isArray(n.readBy) ? n.readBy : []
      return currentRead.includes(email) ? n : { ...n, readBy: [...currentRead, email] }
    }))
    markAllNotificationsRead(workspaceId, currentUser?.email)
  }

  return (
    <div className="notif-bell-wrap" ref={ref}>
      <button className="notif-bell-btn" onClick={() => setOpen(!open)} aria-label="Notifications">
        🔔
        {unreadCount > 0 && <span className="notif-bell-badge mono">{unreadCount}</span>}
      </button>
      {open && (
        <div className="notif-bell-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div className="notif-bell-header mono" style={{ margin: 0 }}>NOTIFICATIONS</div>
            {unreadCount > 0 && (
              <button 
                type="button" 
                onClick={handleDismissAll}
                style={{ background: 'transparent', border: 'none', color: 'var(--accent, #4F46E5)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="notif-bell-empty">Nothing yet.</div>
          ) : (
            notifications.slice(0, 20).map(n => {
              const email = (currentUser?.email || '').toLowerCase()
              const isRead = n.readBy?.includes(email)
              return (
                <div key={n.id} className={`notif-bell-item${isRead ? ' notif-bell-item--read' : ''}`}>
                  <p>{n.message}</p>
                  {!isRead && (
                    <button className="notif-bell-dismiss" onClick={() => handleDismiss(n.id)}>Dismiss</button>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
