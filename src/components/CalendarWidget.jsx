import { useEffect, useState } from 'react'
import { INTEGRATIONS } from '../lib/integrations'
import { subscribeIntegrationConfig, subscribeIntegrationCredentials } from '../lib/integrations/config'
import { loadGis } from '../lib/integrations/googleCalendar'

const TEAM_ID = 'default-team'
const googleCalendar = INTEGRATIONS.find(i => i.id === 'google_calendar')

export default function CalendarWidget({ user, onSelectEvent, selectedEventId }) {
  const [config, setConfig] = useState({})
  const [credentials, setCredentials] = useState({})
  const [calendarEvents, setCalendarEvents] = useState([])
  const [fetchingEvents, setFetchingEvents] = useState(false)
  const [calendarError, setCalendarError] = useState('')

  useEffect(() => {
    loadGis().catch(console.error)
    const unsub1 = subscribeIntegrationConfig(TEAM_ID, setConfig)
    const unsub2 = subscribeIntegrationCredentials(user?.email, setCredentials)
    return () => { unsub1(); unsub2() }
  }, [user?.email])

  useEffect(() => {
    if (googleCalendar.isConfigured(config) && googleCalendar.actions.hasValidToken() && calendarEvents.length === 0 && !fetchingEvents) {
      handleConnectCalendar()
    }
  }, [config, credentials])

  async function handleConnectCalendar() {
    setFetchingEvents(true)
    setCalendarError('')
    try {
      if (!googleCalendar.isConfigured(config)) {
        console.warn('[Calendar Mock] Google Calendar not configured. Returning mock events.')
        await new Promise(r => setTimeout(r, 1000))
        setCalendarEvents([
          { id: 'mock-1', summary: 'Sprint Planning', start: { dateTime: new Date(Date.now() + 2 * 3600000).toISOString() }, end: { dateTime: new Date(Date.now() + 3 * 3600000).toISOString() } },
          { id: 'mock-2', summary: 'Weekly Engineering Sync', start: { dateTime: new Date(Date.now() + 26 * 3600000).toISOString() }, end: { dateTime: new Date(Date.now() + 27 * 3600000).toISOString() } },
          { id: 'mock-3', summary: 'Product Design Review', start: { dateTime: new Date(Date.now() + 50 * 3600000).toISOString() }, end: { dateTime: new Date(Date.now() + 51 * 3600000).toISOString() } },
        ])
        return
      }
      const events = await googleCalendar.actions.fetchUpcomingEvents(config, credentials)
      setCalendarEvents(events)
    } catch (err) {
      console.error(err)
      setCalendarError(err.message || 'Could not connect to Google Calendar.')
    } finally {
      setFetchingEvents(false)
    }
  }

  return (
    <section className="sprint-overview meeting-panel" style={{ padding: '20px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 className="mono" style={{ margin: 0, fontSize: '13px' }}>MY CALENDAR</h2>
        {googleCalendar.actions.hasValidToken() && (
          <div style={{ display: 'flex', gap: '16px' }}>
            <button 
              className="btn-ghost" 
              onClick={handleConnectCalendar} 
              disabled={fetchingEvents}
              style={{ padding: 0, height: 'auto', fontSize: '11px', color: 'var(--accent-signal)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Refresh events"
            >
              <span style={{ fontSize: '14px', marginTop: '-2px' }}>⟳</span> {fetchingEvents ? 'Refreshing...' : 'Refresh'}
            </button>
            <button 
              className="btn-ghost" 
              onClick={() => {
                googleCalendar.actions.disconnectCalendar()
                setCalendarEvents([])
              }} 
              style={{ padding: 0, height: 'auto', fontSize: '11px', color: 'var(--accent-critical)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Disconnect calendar"
            >
              <span style={{ fontSize: '12px' }}>✕</span> Disconnect
            </button>
          </div>
        )}
      </div>
      
      {!googleCalendar.actions.hasValidToken() && !fetchingEvents && calendarEvents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p className="profile-hint" style={{ marginBottom: '16px' }}>
            Connect your personal Google Calendar to view your upcoming meetings.
          </p>
          <button 
            className="btn-primary" 
            onClick={handleConnectCalendar} 
            disabled={fetchingEvents}
            style={{ width: '100%' }}
          >
            {fetchingEvents ? 'Connecting...' : 'Connect with Calendar'}
          </button>
          {calendarError && <div className="form-error" style={{ marginTop: '12px', textAlign: 'left' }}>{calendarError}</div>}
        </div>
      ) : (
        <div>
          {calendarEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', background: 'var(--bg-inset)', borderRadius: '8px', border: '1px dashed var(--border-hair)' }}>
              <p className="profile-hint" style={{ margin: 0 }}>No upcoming meetings.</p>
            </div>
          ) : (
            <div style={{ position: 'relative', margin: '0 -16px', padding: '0 16px' }}>
              <ul style={{ 
                listStyle: 'none', 
                padding: '4px 0 12px 0', 
                margin: 0, 
                display: 'flex', 
                gap: '16px',
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch'
              }}>
                {calendarEvents.map((event) => {
                  const start = new Date(event.start.dateTime || event.start.date)
                  const isAllDay = !event.start.dateTime
                  const meetingLink = event.hangoutLink || (event.location && event.location.startsWith('http') ? event.location : null)
                  return (
                    <li 
                      key={event.id} 
                      onClick={() => onSelectEvent && onSelectEvent(event.id)}
                      style={{ 
                      flex: '0 0 auto',
                      width: '180px',
                      background: selectedEventId === event.id ? 'var(--bg-layer-2)' : 'var(--bg-panel)', 
                      padding: '16px', 
                      borderRadius: '12px', 
                      border: `1px solid ${selectedEventId === event.id ? 'var(--accent-primary)' : 'var(--border-hair)'}`,
                      boxShadow: selectedEventId === event.id ? '0 0 0 1px var(--accent-primary)' : 'var(--shadow-panel)',
                      cursor: onSelectEvent ? 'pointer' : 'default',
                      transition: 'all 0.15s ease',
                      scrollSnapAlign: 'start',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: 'var(--accent-info)',
                          flexShrink: 0
                        }} />
                        <div className="mono" style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                          {isAllDay 
                            ? 'ALL DAY' 
                            : start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          }
                        </div>
                      </div>
                      
                      <div style={{ 
                        fontWeight: 600, 
                        fontSize: '14px', 
                        color: 'var(--text-primary)', 
                        lineHeight: 1.4,
                        display: '-webkit-box', 
                        WebkitLineClamp: 2, 
                        WebkitBoxOrient: 'vertical', 
                        overflow: 'hidden' 
                      }}>
                        {event.summary || '(No title)'}
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 'auto', paddingTop: '4px' }}>
                        {start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>

                      {meetingLink && (
                        <div style={{ marginTop: '4px' }}>
                          <a 
                            href={meetingLink} 
                            target="_blank" 
                            rel="noreferrer"
                            className="btn-primary"
                            style={{ textDecoration: 'none', display: 'block', width: '100%', textAlign: 'center', fontSize: '11px', padding: '4px 0', minHeight: 'auto', height: 'auto', borderRadius: '4px' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Join Meeting
                          </a>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          
          {calendarError && <div className="form-error" style={{ marginTop: '16px', textAlign: 'left' }}>{calendarError}</div>}
        </div>
      )}
    </section>
  )
}
