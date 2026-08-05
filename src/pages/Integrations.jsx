import { useEffect, useState, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { INTEGRATIONS } from '../lib/integrations'
import { subscribeIntegrationConfig, saveIntegrationConfig, subscribeIntegrationCredentials, saveIntegrationCredentials } from '../lib/integrations/config'
import { loadGis } from '../lib/integrations/googleCalendar'
import { subscribeEventNotes, saveEventNote, deleteEventNote } from '../lib/meetings'

import NavTabs from '../components/NavTabs'
import UserMenu from '../components/UserMenu'
import Breadcrumbs from '../components/Breadcrumbs'
import { useWorkspace } from '../lib/WorkspaceContext'
import './Dashboard.css'
import './Integrations.css'
import { Eye, EyeOff } from 'lucide-react'
import AlertModal from '../components/ui/AlertModal'
import ConfirmModal from '../components/ui/ConfirmModal'

export default function Integrations() {
  const [alertMessage, setAlertMessage] = useState(null)
  const { workspaceId, workspace, isAdmin } = useWorkspace();
  const { user } = useAuth()
  
  const [confirmModal, setConfirmModal] = useState({ isOpen: false })
  const openConfirm = (opts) => setConfirmModal({ isOpen: true, ...opts })
  const closeConfirm = () => setConfirmModal({ isOpen: false })

  const [showSecrets, setShowSecrets] = useState({})
  const toggleShowSecret = (key) => setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }))
  
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
  
  if (isAdmin === false) {
    return <Navigate to={`/${workspaceId}`} replace />
  }
  
  const googleCalendar = INTEGRATIONS.find(i => i.id === 'google_calendar')

  useEffect(() => {
    loadGis().catch(() => {}) // GIS script loads silently; errors shown when user actually tries to connect
    const unsub1 = subscribeIntegrationConfig(workspaceId, (c) => { setConfig(c); setFormConfig(prev => ({ ...c, ...prev })) })
    const unsub2 = subscribeIntegrationCredentials(workspaceId, user?.uid, (c) => { setCredentials(c); setFormCredentials(prev => ({ ...c, ...prev })) })
    const unsub3 = subscribeEventNotes(workspaceId, undefined, (notes) => { setEventNotes(notes) })
    
    return () => {
      clearTimeout(debounceRef.current) // flush any pending debounced save on unmount
      unsub1(); unsub2(); unsub3()
    }
  }, [workspaceId, user?.uid, isAdmin])

  useEffect(() => {
    if (googleCalendar.isConfigured(config, credentials) && googleCalendar.actions.hasValidToken()) {
      setFetchingCalendar(true)
      googleCalendar.actions.fetchUpcomingEvents(config, credentials)
        .then(setCalendarEvents)
        .catch(() => setAlertMessage('Failed to load calendar events. Please reconnect Google Calendar.'))
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
          await saveEventNote(workspaceId, undefined, eventId, nextNotes)
        } finally {
          setSavingNotes(false)
        }
      }, 1000)
      
      return nextAll
    })
  }

  function handleDeleteNote(eventId) {
    openConfirm({
      title: 'Delete Meeting Note',
      message: 'Are you sure you want to permanently delete this meeting note? This cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        closeConfirm()
        try {
          await deleteEventNote(workspaceId, undefined, eventId)
          setSelectedEventId('')
        } catch (err) {
          setAlertMessage('Failed to permanently delete the note. Please check your connection and try again.')
        }
      }
    })
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
        Object.keys(configPatch).length ? saveIntegrationConfig(workspaceId, configPatch) : Promise.resolve(),
        Object.keys(credPatch).length && user?.uid ? saveIntegrationCredentials(workspaceId, user.uid, credPatch) : Promise.resolve(),
      ])
      setTestResults(prev => ({ ...prev, [integration.id]: { ok: 'Saved.' } }))
    } catch (err) {
      setTestResults(prev => ({ ...prev, [integration.id]: { error: 'Connection failed. Please check your credentials.' } }))
    } finally {
      setSavingId(null)
    }
  }

  async function handleTest(integration) {
    setTestResults(prev => ({ ...prev, [integration.id]: { loading: true } }))
    try {
      let ok
      if (integration.id === 'discord' || integration.id === 'slack') {
        await integration.actions.postMessage(formConfig, formCredentials, { text: `Test message from Paper5 (${user?.displayName || user?.email})` })
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
      setTestResults(prev => ({ ...prev, [integration.id]: { error: 'Connection failed. Please check your credentials.' } }))
    }
  }

  return (
    <div className="dash">
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-brand">
            <span className="dash-brand-dot" />
            <span className="mono">Paper5 <span className="dash-brand-sub" style={{ whiteSpace: "nowrap" }}>{workspace?.name ? `| ${workspace.name}` : ''}</span></span>
          </div>
          <div className="dash-header-actions">
            <NavTabs />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="dash-body">
        <p className="integrations-intro">
          These are live — Discord/Slack actually post, GitHub actually reads your repo, Vercel actually checks
          deployment status. 
          {isAdmin 
            ? ' Config fields (repo names, webhook URLs) are shared with the whole workspace. Credential fields are private to you only.'
            : ' Only admins can edit shared workspace config fields, but you can configure your personal integrations (like your Google Calendar) below.'}
          <br /><br />
          <strong>Privacy Note:</strong> By providing personal access tokens, you consent to us processing them on your behalf in accordance with our <a href="/legal/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Privacy Policy</a> and DPA.
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
                      {integration.configFields.map(f => {
                        const isPassword = f.type === 'password'
                        const isShown = showSecrets[f.key]
                        const inputType = isPassword ? (isShown ? 'text' : 'password') : 'text'

                        return (
                          <div className="field" key={f.key}>
                            <label>{f.label}</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <input
                                type={inputType}
                                value={formConfig[f.key] || ''}
                                placeholder={f.placeholder}
                                onChange={(e) => setFormConfig(prev => ({ ...prev, [f.key]: e.target.value }))}
                                disabled={!isAdmin}
                                style={{ width: '100%', paddingRight: isPassword ? '36px' : '12px' }}
                              />
                              {isPassword && (
                                <button
                                  type="button"
                                  className="btn-ghost"
                                  onClick={() => toggleShowSecret(f.key)}
                                  style={{
                                    position: 'absolute', right: '6px', padding: '4px 6px',
                                    color: 'var(--text-tertiary)', background: 'transparent',
                                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center'
                                  }}
                                  title={isShown ? 'Hide secret key' : 'Show secret key'}
                                >
                                  {isShown ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {integration.credentialFields.map(f => {
                        const isShown = showSecrets[f.key]
                        const inputType = isShown ? 'text' : 'password'

                        return (
                          <div className="field" key={f.key}>
                            <label>{f.label} <span className="integration-private-tag">(private to you)</span></label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <input
                                type={inputType}
                                value={formCredentials[f.key] || ''}
                                onChange={(e) => setFormCredentials(prev => ({ ...prev, [f.key]: e.target.value }))}
                                style={{ width: '100%', paddingRight: '36px' }}
                              />
                              <button
                                type="button"
                                className="btn-ghost"
                                onClick={() => toggleShowSecret(f.key)}
                                style={{
                                  position: 'absolute', right: '6px', padding: '4px 6px',
                                  color: 'var(--text-tertiary)', background: 'transparent',
                                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center'
                                }}
                                title={isShown ? 'Hide secret key' : 'Show secret key'}
                              >
                                {isShown ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>
                        )
                      })}
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
      <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText || 'Confirm'}
        cancelText={confirmModal.cancelText || 'Cancel'}
        variant={confirmModal.variant || 'default'}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirm}
      />
    </div>
  )
}
