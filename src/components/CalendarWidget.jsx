import { useEffect, useState } from 'react'
import { INTEGRATIONS } from '../lib/integrations'
import { subscribeIntegrationConfig, subscribeIntegrationCredentials } from '../lib/integrations/config'
import { loadGis } from '../lib/integrations/googleCalendar'
import { useWorkspace } from '../lib/WorkspaceContext'
import { getPlanLimits } from '../lib/plans'

const googleCalendar = INTEGRATIONS.find(i => i.id === 'google_calendar')

const SAMPLE_DEMO_MEETINGS = [
  { id: 'demo-1', summary: 'Sprint Planning', start: { dateTime: new Date(Date.now() + 2 * 3600000).toISOString() }, end: { dateTime: new Date(Date.now() + 3 * 3600000).toISOString() } },
  { id: 'demo-2', summary: 'Weekly Engineering Sync', start: { dateTime: new Date(Date.now() + 26 * 3600000).toISOString() }, end: { dateTime: new Date(Date.now() + 27 * 3600000).toISOString() } },
  { id: 'demo-3', summary: 'Product Design Review', start: { dateTime: new Date(Date.now() + 50 * 3600000).toISOString() }, end: { dateTime: new Date(Date.now() + 51 * 3600000).toISOString() } },
]

export default function CalendarWidget({ user, onSelectEvent, selectedEventId }) {
  const workspaceContext = useWorkspace()
  const workspaceId = workspaceContext?.workspaceId
  const workspace = workspaceContext?.workspace
  const currentPlan = getPlanLimits(workspace?.plan || workspace?.billing_plan_id || workspace?.subscription_tier || 'pro')
  const isAllowedByPlan = currentPlan.allowedIntegrations ? currentPlan.allowedIntegrations.includes('google_calendar') : true

  if (!isAllowedByPlan) {
    return null
  }

  const [config, setConfig] = useState({})
  const [credentials, setCredentials] = useState({})
  const [calendarEvents, setCalendarEvents] = useState([])
  const [fetchingEvents, setFetchingEvents] = useState(false)
  const [calendarError, setCalendarError] = useState('')
  const [isDemoMode, setIsDemoMode] = useState(false)

  // 1. Subscribe to workspace config and credentials
  useEffect(() => {
    const unsub1 = subscribeIntegrationConfig(workspaceId, setConfig)
    const unsub2 = subscribeIntegrationCredentials(workspaceId, user?.id || user?.uid, setCredentials)
    return () => { unsub1(); unsub2() }
  }, [workspaceId, user?.id, user?.uid])

  // 2. Load GIS script in background
  useEffect(() => {
    loadGis().catch(() => {})
  }, [])

  // 3. Persistent session restore on page refresh
  useEffect(() => {
    const wasConnected = googleCalendar.actions.wasConnected()
    const hasValidToken = googleCalendar.actions.hasValidToken()
    
    try {
      if (sessionStorage.getItem('paper5_gcal_demo') === 'true' && calendarEvents.length === 0) {
        setIsDemoMode(true)
        setCalendarEvents(SAMPLE_DEMO_MEETINGS)
        return
      }
    } catch (e) {}

    if (googleCalendar.isConfigured(config) && (hasValidToken || wasConnected) && calendarEvents.length === 0 && !fetchingEvents) {
      handleSilentRefresh()
    }
  }, [config.googleCalendarClientId, credentials.googleCalendarId])

  async function handleSilentRefresh() {
    setFetchingEvents(true)
    setCalendarError('')
    try {
      await loadGis().catch(() => {})
      const events = await googleCalendar.actions.fetchUpcomingEvents(config, credentials)
      setCalendarEvents(events)
      setIsDemoMode(false)
    } catch (err) {
      console.warn('Silent calendar refresh notice:', err)
      if (!googleCalendar.actions.hasValidToken()) {
        setCalendarEvents([])
      }
    } finally {
      setFetchingEvents(false)
    }
  }

  // 1-Click Connect: Directly open Google OAuth account selection popup
  async function handleConnectClick() {
    setCalendarError('')
    setFetchingEvents(true)
    try {
      await loadGis()
      await googleCalendar.actions.connectCalendar(config, credentials)
      const events = await googleCalendar.actions.fetchUpcomingEvents(config, credentials)
      setCalendarEvents(events)
      setIsDemoMode(false)
      try {
        sessionStorage.removeItem('paper5_gcal_demo')
      } catch (e) {}
    } catch (err) {
      console.error('Google Calendar OAuth error:', err)
      setCalendarError(err.message || 'Could not connect to Google Calendar. Please check popup permissions.')
    } finally {
      setFetchingEvents(false)
    }
  }

  function handleActivateDemo() {
    setIsDemoMode(true)
    setCalendarEvents(SAMPLE_DEMO_MEETINGS)
    try {
      sessionStorage.setItem('paper5_gcal_demo', 'true')
    } catch (e) {}
    setCalendarError('')
  }

  function handleDisconnect() {
    googleCalendar.actions.disconnectCalendar()
    setCalendarEvents([])
    setIsDemoMode(false)
    try {
      sessionStorage.removeItem('paper5_gcal_demo')
    } catch (e) {}
  }

  const isConnected = (googleCalendar.actions.hasValidToken() || isDemoMode) && calendarEvents.length > 0

  return (
    <section className="sprint-overview meeting-panel" style={{ padding: '16px 20px', marginBottom: 0, borderRadius: '12px', background: 'var(--surface, #FFFFFF)', border: '1px solid var(--border-soft, #E2E8F0)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 className="mono" style={{ margin: 0, fontSize: '12px', color: 'var(--muted, #64748B)', letterSpacing: '0.05em' }}>
            GOOGLE CALENDAR
          </h2>
          {isDemoMode && (
            <span style={{ fontSize: '11px', background: 'rgba(234, 179, 8, 0.12)', color: '#b45309', border: '1px solid rgba(234, 179, 8, 0.25)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              Sample Preview
            </span>
          )}
          {!isDemoMode && googleCalendar.actions.hasValidToken() && (
            <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.12)', color: '#047857', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              Connected
            </span>
          )}
        </div>
        {isConnected && (
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            {!isDemoMode && (
              <button 
                className="btn-ghost" 
                onClick={handleSilentRefresh} 
                disabled={fetchingEvents}
                style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--text-secondary, #475569)', fontWeight: 500 }}
                title="Refresh events from Google"
              >
                {fetchingEvents ? 'Refreshing…' : 'Refresh'}
              </button>
            )}
            <button 
              className="btn-ghost" 
              onClick={handleDisconnect} 
              style={{ padding: '4px 8px', fontSize: '12px', color: '#dc2626', fontWeight: 500 }}
              title="Disconnect calendar"
            >
              {isDemoMode ? 'Exit preview' : 'Disconnect'}
            </button>
          </div>
        )}
      </div>
      
      {!isConnected && !fetchingEvents ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 16px', background: 'var(--surface-2, #F8FAFC)', borderRadius: '10px', border: '1px solid var(--border-soft, #E2E8F0)', textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--surface, #FFFFFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px', border: '1px solid var(--border-soft, #E2E8F0)', color: 'var(--text, #0F172A)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text, #0F172A)' }}>
            Connect Google Calendar
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '12.5px', color: 'var(--muted, #64748B)', maxWidth: '320px', lineHeight: 1.5 }}>
            Sync your upcoming meetings, sprint planning, and reviews directly to your workspace.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button 
              type="button"
              className="btn-primary" 
              onClick={handleConnectClick} 
              disabled={fetchingEvents}
              style={{ padding: '8px 20px', fontSize: '13px' }}
            >
              {fetchingEvents ? 'Opening account list…' : 'Connect Google Calendar'}
            </button>
            <button 
              type="button"
              className="btn-ghost" 
              onClick={handleActivateDemo}
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              Sample Preview
            </button>
          </div>
          {calendarError && (
            <div className="form-error" style={{ marginTop: '14px', textAlign: 'center', fontSize: '12.5px', maxWidth: '380px' }}>
              {calendarError}
            </div>
          )}
        </div>
      ) : (
        <div>
          {calendarEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', background: 'var(--surface-2, #F8FAFC)', borderRadius: '10px', border: '1px solid var(--border-soft, #E2E8F0)' }}>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted, #64748B)' }}>
                No upcoming meetings found for this week.
              </p>
            </div>
          ) : (
            <div style={{ position: 'relative', margin: '0 -8px', padding: '0 8px' }}>
              <ul style={{ 
                listStyle: 'none', 
                padding: '4px 0 12px 0', 
                margin: 0, 
                display: 'flex', 
                gap: '14px',
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch'
              }}>
                {calendarEvents.map((event) => {
                  const start = new Date(event.start?.dateTime || event.start?.date || Date.now())
                  const isAllDay = !event.start?.dateTime
                  const meetingLink = event.hangoutLink || (event.location && event.location.startsWith('http') ? event.location : null)
                  return (
                    <li 
                      key={event.id} 
                      onClick={() => onSelectEvent && onSelectEvent(event.id)}
                      style={{ 
                        flex: '0 0 auto',
                        width: '190px',
                        background: selectedEventId === event.id ? 'var(--surface-2, #F8FAFC)' : 'var(--surface, #FFFFFF)', 
                        padding: '14px 16px', 
                        borderRadius: '10px', 
                        border: `1px solid ${selectedEventId === event.id ? 'var(--accent, #4F46E5)' : 'var(--border-soft, #E2E8F0)'}`,
                        boxShadow: selectedEventId === event.id ? '0 0 0 1px var(--accent, #4F46E5)' : 'none',
                        cursor: onSelectEvent ? 'pointer' : 'default',
                        transition: 'all 0.15s ease',
                        scrollSnapAlign: 'start',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: isDemoMode ? '#f59e0b' : '#3b82f6',
                          flexShrink: 0
                        }} />
                        <div className="mono" style={{ fontSize: '11px', color: 'var(--muted, #64748B)', fontWeight: 500 }}>
                          {isAllDay 
                            ? 'ALL DAY' 
                            : start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          }
                        </div>
                      </div>
                      
                      <div style={{ 
                        fontWeight: 600, 
                        fontSize: '13.5px', 
                        color: 'var(--text, #0F172A)', 
                        lineHeight: 1.4,
                        display: '-webkit-box', 
                        WebkitLineClamp: 2, 
                        WebkitBoxOrient: 'vertical', 
                        overflow: 'hidden' 
                      }}>
                        {event.summary || '(No title)'}
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--muted, #64748B)', marginTop: 'auto', paddingTop: '4px' }}>
                        {start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>

                      {meetingLink && (
                        <div style={{ marginTop: '4px' }}>
                          <a 
                            href={meetingLink} 
                            target="_blank" 
                            rel="noreferrer"
                            className="btn-primary"
                            style={{ textDecoration: 'none', display: 'block', width: '100%', textAlign: 'center', fontSize: '11px', padding: '5px 0', minHeight: 'auto', height: 'auto', borderRadius: '6px' }}
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
        </div>
      )}
    </section>
  )
}
