import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { INTEGRATIONS } from '../lib/integrations'
import { subscribeIntegrationConfig, saveIntegrationConfig, subscribeIntegrationCredentials, saveIntegrationCredentials } from '../lib/integrations/config'
import { loadGis } from '../lib/integrations/googleCalendar'
import { subscribeEventNotes, saveEventNote, deleteEventNote } from '../lib/meetings'
import { subscribeProfile, saveProfile, saveAim, getAimLockStatus, uploadProfilePic, uploadResume, removeResume } from '../lib/profile'
import { subscribeRoles } from '../lib/roles'
import { resetTourSeen } from '../lib/onboarding'
import { getAllowedUsers, addAllowedUser, removeAllowedUser } from '../lib/allowlist'
import NotificationBell from '../components/NotificationBell'
import NavTabs from '../components/NavTabs'
import Breadcrumbs from '../components/Breadcrumbs'
import './Dashboard.css'
import './Integrations.css'

const TEAM_ID = 'default-team'

export default function Integrations() {
  const { user, logout } = useAuth()
  
  const appRoleNormalized = (user?.appRole || '').toLowerCase().replace(/[\s-]/g, '')
  const isAdminRole = ['admin', 'owner', 'founder', 'cofounder'].some(r => appRoleNormalized.includes(r))
  const isAdminEmail = ['erharsh237@gmail.com', 'kanishkaldh@gmail.com', 'shrutisinha2205@gmail.com'].includes(user?.email?.toLowerCase())
  const isAdmin = isAdminRole || isAdminEmail
  
  const [config, setConfig] = useState({})
  const [credentials, setCredentials] = useState({})
  const [formConfig, setFormConfig] = useState({})
  const [formCredentials, setFormCredentials] = useState({})
  const [eventNotes, setEventNotes] = useState({})
  const [selectedEventId, setSelectedEventId] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const debounceRef = useRef(null)
  const [savingId, setSavingId] = useState(null)
  const [testResults, setTestResults] = useState({})
  const [calendarEvents, setCalendarEvents] = useState([])
  const [fetchingCalendar, setFetchingCalendar] = useState(false)
  const [expandedCards, setExpandedCards] = useState({})
  
  const [allowedUsers, setAllowedUsers] = useState([])
  const [newAllowedEmail, setNewAllowedEmail] = useState('')
  const [newAllowedRole, setNewAllowedRole] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(false)
  
  const googleCalendar = INTEGRATIONS.find(i => i.id === 'google_calendar')

  useEffect(() => {
    loadGis().catch(console.error)
    const unsub1 = subscribeIntegrationConfig(TEAM_ID, (c) => { setConfig(c); setFormConfig(prev => ({ ...c, ...prev })) })
    const unsub2 = subscribeIntegrationCredentials(user?.email, (c) => { setCredentials(c); setFormCredentials(prev => ({ ...c, ...prev })) })
    const unsub3 = subscribeEventNotes(TEAM_ID, (notes) => { setEventNotes(notes) })
    
    if (isAdmin) {
      setLoadingUsers(true)
      getAllowedUsers()
        .then(setAllowedUsers)
        .catch(console.error)
        .finally(() => setLoadingUsers(false))
    }

    return () => { unsub1(); unsub2(); unsub3() }
  }, [user?.email, isAdmin])

  useEffect(() => {
    if (googleCalendar.isConfigured(config, credentials) && googleCalendar.actions.hasValidToken()) {
      setFetchingCalendar(true)
      googleCalendar.actions.fetchUpcomingEvents(config, credentials)
        .then(setCalendarEvents)
        .catch(console.error)
        .finally(() => setFetchingCalendar(false))
    }
  }, [config, credentials])

  function handleNotesChange(eventId, updates) {
    if (!eventId) return
    setEventNotes(prev => {
      const current = prev[eventId] || {}
      const nextNotes = { ...current, ...updates }
      const nextAll = { ...prev, [eventId]: nextNotes }
      
      setSavingNotes(true)
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        try {
          await saveEventNote(TEAM_ID, eventId, nextNotes)
        } finally {
          setSavingNotes(false)
        }
      }, 1000)
      
      return nextAll
    })
  }

  async function handleDeleteNote(eventId) {
    if (!window.confirm('Delete this meeting note permanently?')) return
    try {
      await deleteEventNote(TEAM_ID, eventId)
      setSelectedEventId('')
    } catch (err) {
      console.error(err)
      alert('Could not delete note.')
    }
  }

  function toggleCard(id) {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function isEventLocked(eventId) {
    if (!eventId) return false
    const calEvent = calendarEvents.find(e => e.id === eventId)
    let dateStr
    if (calEvent) {
      dateStr = calEvent.start?.dateTime || calEvent.start?.date
    } else {
      dateStr = eventNotes[eventId]?.date
    }
    if (!dateStr) return false
    
    const meetingDate = new Date(dateStr)
    if (isNaN(meetingDate.getTime())) return false
    
    const DAYS_UNTIL_LOCK = 2;
    // Deadline is midnight of meeting date + DAYS_UNTIL_LOCK
    const deadline = new Date(meetingDate.getFullYear(), meetingDate.getMonth(), meetingDate.getDate() + DAYS_UNTIL_LOCK)
    return Date.now() >= deadline.getTime()
  }

  const isLocked = isEventLocked(selectedEventId)
  const canEdit = isAdmin && !isLocked

  function handleSelectCalendarEvent(e) {
    const eventId = e.target.value
    if (!eventId) return
    setSelectedEventId(eventId)

    // Auto-fill title and date if not already set
    const existing = eventNotes[eventId] || {}
    const event = calendarEvents.find(ev => ev.id === eventId)
    if (event && !existing.title && !existing.date) {
      const d = new Date(event.start?.dateTime || event.start?.date)
      if (!isNaN(d.getTime())) {
        const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        handleNotesChange(eventId, { title: event.summary || '(No title)', date: dateString })
      }
    }
  }

  async function handleSave(integration) {
    setSavingId(integration.id)
    try {
      const configPatch = {}
      integration.configFields.forEach(f => { configPatch[f.key] = formConfig[f.key] || '' })
      const credPatch = {}
      integration.credentialFields.forEach(f => { credPatch[f.key] = formCredentials[f.key] || '' })

      await Promise.all([
        Object.keys(configPatch).length ? saveIntegrationConfig(TEAM_ID, configPatch) : Promise.resolve(),
        Object.keys(credPatch).length && user?.email ? saveIntegrationCredentials(user.email, credPatch) : Promise.resolve(),
      ])
      setTestResults(prev => ({ ...prev, [integration.id]: { ok: 'Saved.' } }))
    } catch (err) {
      setTestResults(prev => ({ ...prev, [integration.id]: { error: err.message } }))
    } finally {
      setSavingId(null)
    }
  }

  async function handleAddAllowedUser(e) {
    e.preventDefault()
    if (!newAllowedEmail || !newAllowedEmail.includes('@')) return
    try {
      await addAllowedUser(newAllowedEmail, user?.email, newAllowedRole)
      setNewAllowedEmail('')
      setNewAllowedRole('')
      getAllowedUsers().then(setAllowedUsers)
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleRemoveAllowedUser(email) {
    if (!window.confirm(`Remove ${email} from allowlist? They will immediately lose access.`)) return
    try {
      await removeAllowedUser(email)
      getAllowedUsers().then(setAllowedUsers)
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleTest(integration) {
    setTestResults(prev => ({ ...prev, [integration.id]: { loading: true } }))
    try {
      let ok
      if (integration.id === 'discord' || integration.id === 'slack') {
        await integration.actions.postMessage(formConfig, formCredentials, { text: `Test message from Securiq (${user?.displayName || user?.email})` })
        ok = 'Sent — check the channel.'
      } else if (integration.id === 'github') {
        if (!formConfig.githubOwner || !formConfig.githubRepo) throw new Error('Fill in repo owner/name first.')
        const res = await fetch(`https://api.github.com/repos/${formConfig.githubOwner}/${formConfig.githubRepo}`, {
          headers: formCredentials.githubToken ? { Authorization: `Bearer ${formCredentials.githubToken}` } : {},
        })
        if (!res.ok) throw new Error(res.status === 404 ? 'Repo not found.' : `GitHub API error (${res.status}).`)
        ok = 'Repo reachable.'
      } else if (integration.id === 'vercel') {
        const result = await integration.actions.fetchLatestDeployment(formConfig, formCredentials)
        ok = `Latest deployment: ${result.state}.`
      } else if (integration.id === 'google_calendar') {
        await integration.actions.testConnection(formConfig, formCredentials)
        ok = 'Connected! We just added a test event to your calendar to verify.'
      }
      setTestResults(prev => ({ ...prev, [integration.id]: { ok } }))
    } catch (err) {
      setTestResults(prev => ({ ...prev, [integration.id]: { error: err.message } }))
    }
  }

  return (
    <div className="dash">
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-brand">
            <span className="dash-brand-dot" />
            <span className="mono">SECURIQ <span className="dash-brand-sub">| Integrations</span></span>
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
        <Breadcrumbs trail={[{ label: 'Integrations' }]} />

        <p className="integrations-intro">
          These are live — Discord/Slack actually post, GitHub actually reads your repo, Vercel actually checks
          deployment status. 
          {isAdmin 
            ? ' Config fields (repo names, webhook URLs) are shared with the whole team. Credential fields are private to you only.'
            : ' Only admins can edit shared team config fields, but you can configure your personal integrations (like your Google Calendar) below.'}
        </p>

        <div className="integrations-grid">
          <div className="integration-card" style={{ gridColumn: '1 / -1' }}>
            <div className="integration-card-top">
              <h3>Meeting Notes</h3>
              <span className="integration-status integration-status--ready">
                {savingNotes ? 'Saving...' : 'Auto-saved ✓'}
              </span>
            </div>
            <p className="integration-desc">Select a meeting below to add notes. They will be visible on the Meeting page when that event is clicked.</p>
            
            <div className="integration-fields" style={{ marginTop: '8px' }}>
              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ margin: 0 }}>Select Calendar Meeting</label>
                  {isAdmin && (
                    <button 
                      className="btn-ghost btn-sm" 
                      style={{ fontSize: '12px', padding: '2px 8px' }}
                      onClick={() => {
                        const id = `custom-${Date.now()}`
                        setSelectedEventId(id)
                        handleNotesChange(id, { title: 'New Custom Meeting', date: new Date().toISOString().split('T')[0], notes: '' })
                      }}
                    >
                      + Custom Note
                    </button>
                  )}
                </div>
                {calendarEvents.length > 0 || Object.keys(eventNotes).length > 0 ? (
                  <select 
                    onChange={handleSelectCalendarEvent}
                    value={selectedEventId}
                    style={{ width: '100%', padding: '6px 12px', fontSize: '14px', background: 'var(--bg-layer-2)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer' }}
                  >
                    <option value="" disabled>Choose a meeting...</option>
                    
                    {calendarEvents.length > 0 && (
                      <optgroup label="Calendar Events">
                        {calendarEvents.map(ev => (
                          <option key={ev.id} value={ev.id}>{ev.summary} ({new Date(ev.start?.dateTime || ev.start?.date).toLocaleDateString()})</option>
                        ))}
                      </optgroup>
                    )}

                    {Object.entries(eventNotes).filter(([id]) => !calendarEvents.some(ce => ce.id === id)).length > 0 && (
                      <optgroup label="Custom Notes">
                        {Object.entries(eventNotes)
                          .filter(([id]) => !calendarEvents.some(ce => ce.id === id))
                          .map(([id, note]) => (
                            <option key={id} value={id}>{note.title || '(Untitled)'} {note.date ? `(${note.date})` : ''}</option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                ) : (
                  <div style={{ padding: '8px', background: 'var(--bg-inset)', borderRadius: '4px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Connect Google Calendar below to select an event{isAdmin ? ', or click "+ Custom Note" to add one manually.' : '.'}
                  </div>
                )}
              </div>

              {selectedEventId && (
                <>
                  <div className="field-row">
                    <div className="field" style={{ flex: 2 }}>
                      <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        Meeting Title
                        {isLocked && <span style={{ fontSize: '11px', color: 'var(--accent-warning)', fontWeight: 400, background: 'rgba(234, 179, 8, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>Locked (Time Expired)</span>}
                      </label>
                      <input
                        type="text"
                        value={eventNotes[selectedEventId]?.title || ''}
                        onChange={(e) => canEdit && handleNotesChange(selectedEventId, { title: e.target.value })}
                        placeholder="e.g. Sprint 14 Planning"
                        disabled={!canEdit}
                        style={{ cursor: !canEdit ? 'default' : 'text', background: !canEdit ? 'transparent' : '' }}
                      />
                    </div>
                    <div className="field" style={{ flex: 1 }}>
                      <label>Date</label>
                      <input
                        type="date"
                        value={eventNotes[selectedEventId]?.date || ''}
                        onChange={(e) => canEdit && handleNotesChange(selectedEventId, { date: e.target.value })}
                        disabled={!canEdit}
                        style={{ cursor: !canEdit ? 'default' : 'text', background: !canEdit ? 'transparent' : '' }}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ margin: 0 }}>Notes</label>
                      {canEdit && (
                        <button 
                          className="btn-ghost btn-sm" 
                          style={{ color: 'var(--accent-critical)', fontSize: '12px', padding: '2px 8px' }}
                          onClick={() => handleDeleteNote(selectedEventId)}
                        >
                          Delete Note
                        </button>
                      )}
                    </div>
                    <textarea
                      className="meeting-notes-input"
                      rows={10}
                      style={{ width: '100%', background: !canEdit ? 'transparent' : 'var(--bg-layer-2)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '12px', fontFamily: 'inherit', resize: 'vertical', cursor: !canEdit ? 'default' : 'text' }}
                      value={eventNotes[selectedEventId]?.notes || ''}
                      onChange={(e) => canEdit && handleNotesChange(selectedEventId, { notes: e.target.value })}
                      placeholder="Type or paste meeting notes here..."
                      disabled={!canEdit}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="integration-card" style={{ gridColumn: '1 / -1' }}>
              <div className="integration-card-top">
                <h3>Team Access (Allowlist)</h3>
                <span className="integration-status integration-status--ready">
                  {loadingUsers ? 'Loading...' : 'Admin Only'}
                </span>
              </div>
              <p className="integration-desc">Manage who can log into the tracker. Users must sign in with the exact Google email listed below.</p>
              
              <div className="integration-fields" style={{ marginTop: '8px' }}>
                <form onSubmit={handleAddAllowedUser} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="email"
                    value={newAllowedEmail}
                    onChange={e => setNewAllowedEmail(e.target.value)}
                    placeholder="teammate@gmail.com"
                    style={{ flex: 1.5 }}
                  />
                  <input
                    type="text"
                    value={newAllowedRole}
                    onChange={e => setNewAllowedRole(e.target.value)}
                    placeholder="Role (e.g. Owner)"
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className="btn-primary btn-sm" disabled={!newAllowedEmail || !newAllowedEmail.includes('@')}>
                    Add User
                  </button>
                </form>

                <div 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', marginBottom: '8px', cursor: 'pointer', userSelect: 'none', padding: '4px 8px', background: 'var(--bg-inset)', borderRadius: '4px' }}
                  onClick={() => toggleCard('allowlist-users')}
                >
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Existing Members ({allowedUsers.length})</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', transform: expandedCards['allowlist-users'] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                </div>

                {expandedCards['allowlist-users'] && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {allowedUsers.map(u => (
                      <li key={u.email} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-layer-2)', padding: '6px 12px', borderRadius: '4px', fontSize: '13px' }}>
                        <button 
                          className="btn-ghost btn-sm" 
                          style={{ color: 'var(--accent-critical)', minWidth: 'auto', padding: '2px 8px', marginLeft: '-8px' }}
                          onClick={() => handleRemoveAllowedUser(u.email)}
                        >
                          Remove
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{u.email}</span>
                          {u.Note ? (
                            <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{u.Note}</span>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No role</span>
                          )}
                        </div>
                      </li>
                    ))}
                    {allowedUsers.length === 0 && !loadingUsers && (
                      <li style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>No users found.</li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          )}

          {INTEGRATIONS.map(integration => {
            const configured = integration.isConfigured(formConfig, formCredentials)
            const result = testResults[integration.id]
            return (
              <div key={integration.id} className="integration-card">
                <div 
                  className="integration-card-top" 
                  style={{ cursor: 'pointer', userSelect: 'none' }} 
                  onClick={() => toggleCard(integration.id)}
                >
                  <h3>{integration.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`integration-status${configured ? ' integration-status--ready' : ''}`}>
                      {configured ? 'Configured' : 'Not configured'}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', transform: expandedCards[integration.id] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                  </div>
                </div>

                {expandedCards[integration.id] && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p className="integration-desc">{integration.description}</p>

                    <div className="integration-fields">
                      {integration.configFields.map(f => (
                        <div className="field" key={f.key}>
                          <label>{f.label}</label>
                          <input
                            type="text"
                            value={formConfig[f.key] || ''}
                            placeholder={f.placeholder}
                            onChange={(e) => setFormConfig(prev => ({ ...prev, [f.key]: e.target.value }))}
                            disabled={!isAdmin}
                          />
                        </div>
                      ))}
                      {integration.credentialFields.map(f => (
                        <div className="field" key={f.key}>
                          <label>{f.label} <span className="integration-private-tag">(private to you)</span></label>
                          <input
                            type={f.type || 'text'}
                            value={formCredentials[f.key] || ''}
                            onChange={(e) => setFormCredentials(prev => ({ ...prev, [f.key]: e.target.value }))}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="integration-actions-row" style={{ marginTop: '4px' }}>
                      <button className="btn-primary btn-sm" disabled={savingId === integration.id} onClick={() => handleSave(integration)} style={{ minWidth: '80px' }}>
                        {savingId === integration.id ? 'Saving…' : 'Save'}
                      </button>
                      <button className="btn-ghost btn-sm" disabled={!configured || result?.loading} onClick={() => handleTest(integration)}>
                        {result?.loading ? 'Testing…' : 'Test Connection'}
                      </button>
                    </div>

                    {result?.error && <div className="form-error">{result.error}</div>}
                    {result?.ok && <div className="form-status form-status--ok">{result.ok}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
