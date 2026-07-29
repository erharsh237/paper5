import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { subscribeSprints } from '../lib/sprints'
import { subscribeMembers } from '../lib/deadlines'
import { subscribeEventNotes } from '../lib/meetings'
import NotificationBell from '../components/NotificationBell'
import NavTabs from '../components/NavTabs'
import ReflectionPanel from '../components/ReflectionPanel'
import Breadcrumbs from '../components/Breadcrumbs'
import CalendarWidget from '../components/CalendarWidget'
import './Dashboard.css'
import './Meeting.css'

const TEAM_ID = 'default-team'

export default function Meeting() {
  const { user, logout } = useAuth()
  const [sprints, setSprints] = useState([])
  const [members, setMembers] = useState([])
  
  // Notes state
  const [eventNotes, setEventNotes] = useState({})
  const [selectedEventId, setSelectedEventId] = useState('')

  useEffect(() => {
    const unsub1 = subscribeSprints(TEAM_ID, setSprints)
    const unsub2 = subscribeMembers(TEAM_ID, setMembers)
    const unsub3 = subscribeEventNotes(TEAM_ID, setEventNotes)
    return () => { unsub1(); unsub2(); unsub3() }
  }, [user?.email])

  const activeSprint = sprints.find(s => s.status === 'active')

  return (
    <div className="dash">
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-brand">
            <span className="dash-brand-dot" />
            <span className="mono">SECURIQ <span className="dash-brand-sub">| Meeting</span></span>
          </div>
          <div className="dash-header-actions">
            <NavTabs />
            <NotificationBell teamId={TEAM_ID} currentUser={user} />
            <span className="dash-user">{user?.displayName || user?.email}</span>
            <button className="btn-ghost btn-sm" onClick={logout}>Sign out</button>
          </div>
        </div>
      </header>

      <main className="dash-body">
        <Breadcrumbs trail={[{ label: 'Meeting' }]} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'stretch' }}>
          {/* Calendar Top Area */}
          <div>
            <CalendarWidget 
              user={user} 
              onSelectEvent={setSelectedEventId} 
              selectedEventId={selectedEventId} 
            />
          </div>

          {/* Main Notes Area */}
          <section className="sprint-overview meeting-panel" style={{ minHeight: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 className="mono" style={{ margin: 0 }}>MEETING NOTES</h2>
            </div>
            
            {selectedEventId ? (
              eventNotes[selectedEventId] && (eventNotes[selectedEventId].title || eventNotes[selectedEventId].date || eventNotes[selectedEventId].notes) ? (
                <div style={{ background: 'var(--bg-layer-2)', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '24px' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', color: 'var(--text-primary)' }}>
                    {eventNotes[selectedEventId].title || 'Untitled Meeting'}
                  </h3>
                  {eventNotes[selectedEventId].date && (
                    <div className="mono" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                      {eventNotes[selectedEventId].date}
                    </div>
                  )}
                  
                  <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.6' }}>
                    {eventNotes[selectedEventId].notes || 'No detailed notes provided.'}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '40px 0', textAlign: 'center', background: 'var(--bg-layer-2)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  <p className="profile-hint">No meeting notes have been added for this calendar event yet.</p>
                </div>
              )
            ) : (
              <div style={{ padding: '40px 0', textAlign: 'center', background: 'var(--bg-layer-2)', borderRadius: '4px', border: '1px dashed var(--border-subtle)' }}>
                <p className="profile-hint">Select a meeting from the calendar above to view its notes.</p>
              </div>
            )}
          </section>
        </div>

        {activeSprint && (
          <ReflectionPanel teamId={TEAM_ID} sprint={activeSprint} currentUser={user} members={members} />
        )}
      </main>
    </div>
  )
}
