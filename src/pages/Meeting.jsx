import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { subscribeSprints } from '../lib/sprints'
import { subscribeMembers } from '../lib/deadlines'
import { subscribeEventNotes } from '../lib/meetings'
import NotificationBell from '../components/NotificationBell'
import NavTabs from '../components/NavTabs'
import ReflectionPanel from '../components/ReflectionPanel'
import Breadcrumbs from '../components/Breadcrumbs'
import UserMenu from '../components/UserMenu'
import CalendarWidget from '../components/CalendarWidget'
import { useWorkspace } from '../lib/WorkspaceContext'
import './Dashboard.css'
import './Meeting.css'

export default function Meeting() {
  const { workspaceId, workspace } = useWorkspace();
  const { user, logout } = useAuth()
  const [sprints, setSprints] = useState([])
  const [members, setMembers] = useState([])
  
  // Notes state
  const [eventNotes, setEventNotes] = useState({})
  const [selectedEventId, setSelectedEventId] = useState('')

  useEffect(() => {
    const unsub1 = subscribeSprints(workspaceId, undefined, setSprints)
    const unsub2 = subscribeMembers(workspaceId, undefined, setMembers)
    const unsub3 = subscribeEventNotes(workspaceId, setEventNotes)
    return () => { unsub1(); unsub2(); unsub3() }
  }, [workspaceId])

  const activeSprint = sprints.find(s => s.status === 'active')

  return (
    <div className="dash">
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-brand">
            <span className="dash-brand-dot" />
            <span className="mono">SprintOS <span className="dash-brand-sub" style={{ whiteSpace: "nowrap" }}>{workspace?.name ? `| ${workspace.name}` : ''}</span></span>
          </div>
          <div className="dash-header-actions">
            <NavTabs />
            <NotificationBell currentUser={user} />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="dash-body">
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
            
            {(() => {
              const savedNoteList = Object.entries(eventNotes).filter(([id, n]) => n && (n.title || n.notes || n.date))

              if (selectedEventId) {
                const note = eventNotes[selectedEventId]
                if (note && (note.title || note.date || note.notes)) {
                  return (
                    <div style={{ background: 'var(--bg-layer-2)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '20px', color: 'var(--text-primary)' }}>
                          {note.title || 'Untitled Meeting'}
                        </h3>
                        <button className="btn-ghost" style={{ fontSize: '12px', padding: '4px 8px' }} onClick={() => setSelectedEventId('')}>Show all notes</button>
                      </div>
                      {note.date && (
                        <div className="mono" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                          {note.date}
                        </div>
                      )}
                      <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.6' }}>
                        {note.notes || 'No detailed notes provided.'}
                      </div>
                    </div>
                  )
                }
                return (
                  <div style={{ padding: '40px 0', textAlign: 'center', background: 'var(--bg-layer-2)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <p className="profile-hint">No meeting notes added for this event yet.</p>
                    <button className="btn-ghost" style={{ fontSize: '12px', marginTop: '8px' }} onClick={() => setSelectedEventId('')}>Show all notes</button>
                  </div>
                )
              }

              if (savedNoteList.length > 0) {
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {savedNoteList.map(([id, note]) => (
                      <div key={id} style={{ background: 'var(--bg-layer-2)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>
                            {note.title || 'Untitled Meeting'}
                          </h3>
                          {note.date && (
                            <span className="mono" style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                              {note.date}
                            </span>
                          )}
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
                          {note.notes || 'No detailed notes provided.'}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }

              return (
                <div style={{ padding: '40px 0', textAlign: 'center', background: 'var(--bg-layer-2)', borderRadius: '8px', border: '1px dashed var(--border-subtle)' }}>
                  <p className="profile-hint">No meeting notes have been created yet. Create notes in the Integrations tab or click a meeting in the calendar above.</p>
                </div>
              )
            })()}
          </section>
        </div>

        {activeSprint && (
          <ReflectionPanel teamId={TEAM_ID} sprint={activeSprint} currentUser={user} members={members} />
        )}
      </main>
    </div>
  )
}
