import { useEffect, useState } from 'react'
import { INTEGRATIONS } from '../lib/integrations'
import { subscribeIntegrationConfig, subscribeIntegrationCredentials, saveIntegrationConfig } from '../lib/integrations/config'
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
  const isAdmin = workspaceContext?.isAdmin || workspaceContext?.isOwner || workspaceContext?.workspaceRole === 'owner' || workspaceContext?.workspaceRole === 'admin'
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
  
  // Modal state for Google Calendar OAuth Setup
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [inputClientId, setInputClientId] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)
  const [configModalError, setConfigModalError] = useState('')
  const [originCopied, setOriginCopied] = useState(false)

  // 1. Subscribe to workspace config and credentials
  useEffect(() => {
    const unsub1 = subscribeIntegrationConfig(workspaceId, setConfig)
    const unsub2 = subscribeIntegrationCredentials(workspaceId, user?.id || user?.uid, setCredentials)
    return () => { unsub1(); unsub2() }
  }, [workspaceId, user?.id, user?.uid])

  // 2. Load GIS script in background if client ID exists
  useEffect(() => {
    if (googleCalendar.isConfigured(config)) {
      loadGis().catch(() => {})
    }
  }, [config.googleCalendarClientId])

  // 3. Persistent session restore on page refresh
  useEffect(() => {
    const wasConnected = googleCalendar.actions.wasConnected()
    const hasValidToken = googleCalendar.actions.hasValidToken()
    
    // Check if demo mode was active in session
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

  // User clicked "Connect Google Calendar"
  async function handleConnectClick() {
    setCalendarError('')
    if (!googleCalendar.isConfigured(config)) {
      // Need OAuth Client ID from Google Cloud Console
      setInputClientId(config.googleCalendarClientId || '')
      setConfigModalError('')
      setShowConfigModal(true)
      return
    }

    await triggerOAuthFlow(config)
  }

  // Trigger Google Identity Services popup with account selection
  async function triggerOAuthFlow(activeConfig) {
    setFetchingEvents(true)
    setCalendarError('')
    try {
      await loadGis()
      await googleCalendar.actions.connectCalendar(activeConfig, credentials)
      const events = await googleCalendar.actions.fetchUpcomingEvents(activeConfig, credentials)
      setCalendarEvents(events)
      setIsDemoMode(false)
      try {
        sessionStorage.removeItem('paper5_gcal_demo')
      } catch (e) {}
      setShowConfigModal(false)
    } catch (err) {
      console.error('Google Calendar OAuth error:', err)
      setCalendarError(err.message || 'Could not connect to Google Calendar. Please check popup permissions.')
    } finally {
      setFetchingEvents(false)
    }
  }

  // Save Client ID and immediately trigger OAuth
  async function handleSaveClientIdAndConnect(e) {
    e?.preventDefault()
    const trimmed = inputClientId.trim()
    if (!trimmed) {
      setConfigModalError('Please enter your Google OAuth Client ID.')
      return
    }
    if (!trimmed.endsWith('.apps.googleusercontent.com') && !trimmed.includes('.google')) {
      setConfigModalError('Invalid format. Google Client IDs end with ".apps.googleusercontent.com".')
      return
    }

    setSavingConfig(true)
    setConfigModalError('')
    try {
      await saveIntegrationConfig(workspaceId, { googleCalendarClientId: trimmed })
      const updatedConfig = { ...config, googleCalendarClientId: trimmed }
      setConfig(updatedConfig)
      await triggerOAuthFlow(updatedConfig)
    } catch (err) {
      setConfigModalError(err.message || 'Failed to save configuration.')
    } finally {
      setSavingConfig(false)
    }
  }

  function handleActivateDemo() {
    setIsDemoMode(true)
    setCalendarEvents(SAMPLE_DEMO_MEETINGS)
    try {
      sessionStorage.setItem('paper5_gcal_demo', 'true')
    } catch (e) {}
    setShowConfigModal(false)
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
    <section className="sprint-overview meeting-panel" style={{ padding: '14px 16px', marginBottom: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 className="mono" style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
            MY CALENDAR
          </h2>
          {isDemoMode && (
            <span style={{ fontSize: '10px', background: 'rgba(234, 179, 8, 0.15)', color: 'var(--accent-warning)', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
              Demo Preview
            </span>
          )}
          {!isDemoMode && googleCalendar.actions.hasValidToken() && (
            <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.12)', color: 'var(--accent-signal)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
              Live Google Sync
            </span>
          )}
        </div>
        {isConnected && (
          <div style={{ display: 'flex', gap: '16px' }}>
            {!isDemoMode && (
              <button 
                className="btn-ghost" 
                onClick={handleSilentRefresh} 
                disabled={fetchingEvents}
                style={{ padding: 0, height: 'auto', fontSize: '11px', color: 'var(--accent-signal)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Refresh events from Google"
              >
                <span style={{ fontSize: '14px', marginTop: '-2px' }}>⟳</span> {fetchingEvents ? 'Refreshing...' : 'Refresh'}
              </button>
            )}
            <button 
              className="btn-ghost" 
              onClick={handleDisconnect} 
              style={{ padding: 0, height: 'auto', fontSize: '11px', color: 'var(--accent-critical)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Disconnect calendar"
            >
              <span style={{ fontSize: '12px' }}>✕</span> {isDemoMode ? 'Exit Demo' : 'Disconnect'}
            </button>
          </div>
        )}
      </div>
      
      {!isConnected && !fetchingEvents ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '18px 14px', background: 'var(--bg-inset)', borderRadius: '8px', border: '1px dashed var(--border-hair)', textAlign: 'center' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          </div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>No calendar connected</h3>
          <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '280px', lineHeight: 1.4 }}>
            Sync your Google Calendar to view upcoming sprint meetings directly on your dashboard.
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button 
              className="btn-primary btn-sm" 
              onClick={handleConnectClick} 
              disabled={fetchingEvents}
              style={{ padding: '7px 16px', fontSize: '12px', borderRadius: '6px' }}
            >
              {fetchingEvents ? 'Opening Google Login...' : 'Connect Google Calendar'}
            </button>
          </div>
          {calendarError && (
            <div className="form-error" style={{ marginTop: '10px', textAlign: 'center', fontSize: '12px', maxWidth: '340px' }}>
              {calendarError}
            </div>
          )}
        </div>
      ) : (
        <div>
          {calendarEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', background: 'var(--bg-inset)', borderRadius: '8px', border: '1px dashed var(--border-hair)' }}>
              <p className="profile-hint" style={{ margin: 0 }}>No upcoming meetings found for this week.</p>
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
                  const start = new Date(event.start?.dateTime || event.start?.date || Date.now())
                  const isAllDay = !event.start?.dateTime
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
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: isDemoMode ? 'var(--accent-warning)' : 'var(--accent-info)',
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

      {/* Google Calendar OAuth Setup Modal */}
      {showConfigModal && (
        <div className="modal-backdrop" onClick={() => !savingConfig && setShowConfigModal(false)} style={{ zIndex: 1200 }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Connect Google Calendar
              </h2>
              <button 
                type="button" 
                className="btn-ghost" 
                onClick={() => setShowConfigModal(false)}
                style={{ fontSize: '18px', padding: '4px 8px', color: 'var(--text-tertiary)' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              To connect your Google account securely via Google Identity Services, provide your workspace Google OAuth 2.0 Client ID.
            </p>

            {isAdmin ? (
              <form onSubmit={handleSaveClientIdAndConnect}>
                <div style={{ background: 'var(--bg-inset)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Quick Google Cloud Setup (1 minute):
                  </div>
                  <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <li>Create an <strong>OAuth Client ID</strong> (Web application) in Google Cloud Console.</li>
                    <li>
                      Add this origin to <strong>Authorized JavaScript origins</strong>:
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <code style={{ background: 'var(--bg-panel)', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-hair)', fontSize: '11px', color: 'var(--text-primary)' }}>
                          {window.location.origin}
                        </code>
                        <button 
                          type="button"
                          className="btn-ghost btn-sm"
                          style={{ fontSize: '11px', padding: '2px 8px' }}
                          onClick={() => {
                            navigator.clipboard.writeText(window.location.origin)
                            setOriginCopied(true)
                            setTimeout(() => setOriginCopied(false), 2000)
                          }}
                        >
                          {originCopied ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                    </li>
                    <li>Paste your Client ID below:</li>
                  </ol>
                </div>

                <div className="field" style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                    Google OAuth Client ID
                  </label>
                  <input
                    type="text"
                    value={inputClientId}
                    onChange={(e) => setInputClientId(e.target.value)}
                    placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com"
                    autoFocus
                    required
                    style={{ width: '100%', fontSize: '13px', padding: '8px 12px', borderRadius: '6px' }}
                  />
                </div>

                {configModalError && (
                  <div className="form-error" style={{ marginBottom: '14px', fontSize: '12px' }}>
                    {configModalError}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
                  <button 
                    type="button" 
                    className="btn-ghost btn-sm"
                    onClick={handleActivateDemo}
                    style={{ fontSize: '12px', color: 'var(--text-secondary)' }}
                  >
                    Preview Sample Meetings
                  </button>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      type="button" 
                      className="btn-secondary btn-sm"
                      onClick={() => setShowConfigModal(false)}
                      disabled={savingConfig}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="btn-primary btn-sm"
                      disabled={savingConfig || !inputClientId.trim()}
                    >
                      {savingConfig ? 'Connecting...' : 'Save & Choose Account'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div>
                <div style={{ padding: '14px', background: 'var(--bg-inset)', borderRadius: '8px', border: '1px solid var(--border-hair)', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Google Calendar has not yet been enabled for this workspace. Please ask a workspace administrator to provide a Google Client ID in Workspace Settings &gt; Integrations.
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button 
                    type="button" 
                    className="btn-ghost btn-sm"
                    onClick={handleActivateDemo}
                  >
                    Preview Sample Meetings
                  </button>
                  <button 
                    type="button" 
                    className="btn-secondary btn-sm"
                    onClick={() => setShowConfigModal(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
