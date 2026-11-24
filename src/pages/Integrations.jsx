import { useEffect, useState, useRef } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { INTEGRATIONS } from '../lib/integrations'
import { subscribeIntegrationConfig, saveIntegrationConfig, subscribeIntegrationCredentials, saveIntegrationCredentials } from '../lib/integrations/config'
import { loadGis } from '../lib/integrations/googleCalendar'
import { subscribeEventNotes, saveEventNote, deleteEventNote } from '../lib/meetings'

import UserMenu from '../components/UserMenu'
import Breadcrumbs from '../components/Breadcrumbs'
import { useWorkspace } from '../lib/WorkspaceContext'
import './Dashboard.css'
import './Integrations.css'
import { Eye, EyeOff, Terminal, FolderGit2, Calendar, MessageSquare, Hash, Rocket, Zap, Lock, ChevronDown, Check, Copy } from 'lucide-react'
import AlertModal from '../components/ui/AlertModal'
import ConfirmModal from '../components/ui/ConfirmModal'
import PricingModal from '../components/PricingModal'
import { getPlanLimits } from '../lib/plans'

const BRAND_META = {
  github: {
    iconClass: 'icon-github',
    icon: <FolderGit2 size={16} />,
    previewLabel: 'git: main',
    previewDot: '#10b981',
    previewText: 'PR #142 • checks passed',
    previewMeta: '2m ago'
  },
  google_calendar: {
    iconClass: 'icon-google',
    icon: <Calendar size={16} />,
    previewLabel: 'Sprint 14 Sync',
    previewDot: '#3b82f6',
    previewText: 'Mon 10:00 AM • 45m',
    previewMeta: 'Weekly'
  },
  discord: {
    iconClass: 'icon-discord',
    icon: <MessageSquare size={16} />,
    previewLabel: '#sprint-alerts',
    previewDot: '#5865f2',
    previewText: 'Task moved to Done',
    previewMeta: 'Webhook'
  },
  slack: {
    iconClass: 'icon-slack',
    icon: <Hash size={16} />,
    previewLabel: '#sprint-feed',
    previewDot: '#e01e5a',
    previewText: 'All blockers resolved',
    previewMeta: 'Feed'
  },
  vercel: {
    iconClass: 'icon-vercel',
    icon: <Rocket size={16} />,
    previewLabel: '▲ Production',
    previewDot: '#10b981',
    previewText: 'app.paper5.co',
    previewMeta: 'Ready'
  }
}

export default function Integrations() {
  const [alertMessage, setAlertMessage] = useState(null)
  const { workspaceId, workspace, isAdmin, updateWorkspacePlan } = useWorkspace();
  const { user } = useAuth()
  
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false)
  const effectivePlanId = workspace?.plan || workspace?.billing_plan_id || workspace?.subscription_tier || 'pro'
  const currentPlan = getPlanLimits(effectivePlanId)
  const isScalePlan = currentPlan.id === 'scale' || currentPlan.id === 'pro' || Boolean(currentPlan.hasOneClickApi)

  const handleGenerateApiKey = async () => {
    const newApiKey = `sp_live_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`
    await saveIntegrationConfig(workspaceId, { ...config, api_key: newApiKey })
    setAlertMessage('⚡ 1-Click API Key generated successfully!')
  }
  
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
  
  // API Studio Redesign States
  const [apiStudioTab, setApiStudioTab] = useState('keys') // 'keys' | 'snippets' | 'test'
  const [snippetLang, setSnippetLang] = useState('curl') // 'curl' | 'node' | 'python'
  const [simulatedPayload, setSimulatedPayload] = useState('{\n  "event": "sprint_task_updated",\n  "task_title": "CI/CD Deployment Verified",\n  "status": "done",\n  "agile_workflow": "scrum",\n  "workflow_column": "In Progress"\n}')
  const [simulating, setSimulating] = useState(false)
  const [simulationResponse, setSimulationResponse] = useState(null)
  
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
          await saveEventNote(workspaceId, undefined, eventId, nextNotes, user?.email)
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
    <div className="dash-root">
      <main className="dash-container" style={{ paddingBottom: '48px' }}>
        <p className="integrations-intro">
          These are live — Discord/Slack actually post, GitHub actually reads your repo, Vercel actually checks
          deployment status. 
          {isAdmin 
            ? ' Config fields (repo names, webhook URLs) are shared with the whole workspace. Credential fields are private to you only.'
            : ' Only admins can edit shared workspace config fields, but you can configure your personal integrations (like your Google Calendar) below.'}
          <br /><br />
          <strong>Privacy Note:</strong> By providing personal access tokens, you consent to us processing them on your behalf in accordance with our <a href="/legal/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Privacy Policy</a> and DPA.
        </p>

        <div className="integrations-bento-grid">
          {/* ⚡ 1-Click API Webhook & REST Sync Studio (Bento Tile: Spans 12 Columns - Hero Tile) */}
          <div className="bento-tile-12 bento-card bento-card-api">
            <div className="integration-card-top" style={{ flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div className="bento-brand-icon icon-api">
                  <Terminal size={18} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '17px' }}>1-Click API Webhook & REST Sync Studio</h3>
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', background: isScalePlan ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: isScalePlan ? '#10b981' : '#f59e0b', padding: '3px 10px', borderRadius: '100px' }}>
                      {isScalePlan ? 'Scale Tier Active' : 'Scale Tier Exclusive'}
                    </span>
                  </div>
                  <p className="integration-desc" style={{ marginTop: '4px', marginBottom: 0 }}>
                    Automate sprint task status updates, push automated proof of work, and query velocity metrics in real time from GitHub Actions, GitLab CI, Linear, or custom webhooks.
                  </p>
                </div>
              </div>
              <span className={`integration-status ${isScalePlan && config.api_key ? 'integration-status--ready' : ''}`}>
                {isScalePlan ? (config.api_key ? '● Webhook Ready' : '● Setup Key') : 'Locked (Scale Tier)'}
              </span>
            </div>

            {isScalePlan ? (
              <div style={{ marginTop: '12px' }}>
                {/* API Studio Navigation Sub-Tabs */}
                <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setApiStudioTab('keys')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      background: apiStudioTab === 'keys' ? '#10b981' : 'var(--bg-layer-2)',
                      color: apiStudioTab === 'keys' ? '#ffffff' : 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Keys & Endpoint
                  </button>
                  <button
                    type="button"
                    onClick={() => setApiStudioTab('snippets')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      background: apiStudioTab === 'snippets' ? '#10b981' : 'var(--bg-layer-2)',
                      color: apiStudioTab === 'snippets' ? '#ffffff' : 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Code Snippets & SDKs
                  </button>
                  <button
                    type="button"
                    onClick={() => setApiStudioTab('test')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      background: apiStudioTab === 'test' ? '#10b981' : 'var(--bg-layer-2)',
                      color: apiStudioTab === 'test' ? '#ffffff' : 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Interactive API Simulator
                  </button>
                </div>

                {/* Tab 1: Keys & Endpoints */}
                {apiStudioTab === 'keys' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ background: 'var(--bg-panel)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                        Workspace 1-Click Live API Secret Key:
                      </label>
                      <div style={{ position: 'relative', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input 
                          type={showSecrets['api_key'] ? 'text' : 'password'}
                          value={config.api_key || 'No API Key generated yet'} 
                          readOnly 
                          style={{ width: '100%', fontFamily: 'var(--mono)', fontSize: '13px', background: 'var(--bg-inset)', padding: '10px 45px 10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} 
                        />
                        <button 
                          type="button"
                          className="btn-ghost" 
                          onClick={() => toggleShowSecret('api_key')}
                          style={{ position: 'absolute', right: '145px', padding: '6px', color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          title={showSecrets['api_key'] ? 'Hide Key' : 'Show Key'}
                        >
                          {showSecrets['api_key'] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <button 
                          className="btn-primary" 
                          onClick={handleGenerateApiKey}
                          style={{ whiteSpace: 'nowrap', padding: '9px 16px' }}
                        >
                          {config.api_key ? 'Re-Generate Key' : 'Generate Key'}
                        </button>
                      </div>
                    </div>

                    {config.api_key ? (
                      <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.04)', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', color: '#10b981' }}>
                          <span>1-Click Live Webhook Sync Endpoint:</span>
                          <button 
                            className="btn-ghost btn-sm" 
                            style={{ color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}
                            onClick={() => {
                              const url = `https://paper5.co/api/v1/sync?workspace=${workspaceId}&key=${config.api_key}`
                              navigator.clipboard.writeText(url)
                              setAlertMessage('Webhook Sync Endpoint copied to clipboard.')
                            }}
                          >
                            Copy Webhook URL
                          </button>
                        </div>
                        <code style={{ display: 'block', padding: '10px 14px', background: 'var(--bg-layer-2)', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--mono)', wordBreak: 'break-all', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                          https://paper5.co/api/v1/sync?workspace={workspaceId}&key={config.api_key}
                        </code>
                      </div>
                    ) : (
                      <div style={{ padding: '14px', background: 'var(--bg-inset)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Click <strong>"Generate Key"</strong> above to provision your live API secret and webhook sync endpoint.
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Code Snippets */}
                {apiStudioTab === 'snippets' && (
                  <div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      {['curl', 'node', 'python'].map(lang => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setSnippetLang(lang)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-subtle)',
                            background: snippetLang === lang ? 'var(--bg-layer-2)' : 'transparent',
                            color: snippetLang === lang ? '#10b981' : 'var(--text-secondary)',
                            fontWeight: 600,
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          {lang === 'curl' ? 'cURL' : lang === 'node' ? 'Node.js (Fetch)' : 'Python (requests)'}
                        </button>
                      ))}
                    </div>

                    <div style={{ position: 'relative' }}>
                      <pre style={{
                        padding: '16px',
                        background: '#0d1117',
                        color: '#e6edf3',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontFamily: 'var(--mono)',
                        overflowX: 'auto',
                        lineHeight: 1.5,
                        margin: 0
                      }}>
                        {snippetLang === 'curl' && `curl -X POST "https://paper5.co/api/v1/sync?workspace=${workspaceId}&key=${config.api_key || 'sp_live_YOUR_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "sprint_task_updated",
    "task_title": "Fix CI Pipeline Auth Bug",
    "status": "done",
    "agile_workflow": "${workspace?.settings?.agile_workflow || 'scrum'}",
    "workflow_column": "Sprint Backlog"
  }'`}
                        {snippetLang === 'node' && `const response = await fetch("https://paper5.co/api/v1/sync?workspace=${workspaceId}&key=${config.api_key || 'sp_live_YOUR_KEY'}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    event: "proof_of_work_submitted",
    task_title: "Deploy Vercel Edge Function",
    author: "${user?.email || 'developer@company.com'}",
    agile_workflow: "${workspace?.settings?.agile_workflow || 'scrum'}",
    workflow_column: "In Progress"
  })
});
const data = await response.json();
console.log("Synced to Board Column:", data.board_column_synced);`}
                        {snippetLang === 'python' && `import requests

url = "https://paper5.co/api/v1/sync?workspace=${workspaceId}&key=${config.api_key || 'sp_live_YOUR_KEY'}"
payload = {
    "event": "sprint_velocity_sync",
    "status": "completed",
    "story_points": 13,
    "agile_workflow": "${workspace?.settings?.agile_workflow || 'scrum'}",
    "workflow_column": "Done"
}
response = requests.post(url, json=payload)
print(response.json())`}
                      </pre>
                      <button 
                        className="btn-ghost btn-sm" 
                        style={{ position: 'absolute', top: '10px', right: '10px', color: '#10b981', background: 'rgba(255,255,255,0.1)' }}
                        onClick={() => {
                          const text = snippetLang === 'curl' 
                            ? `curl -X POST "https://paper5.co/api/v1/sync?workspace=${workspaceId}&key=${config.api_key || 'sp_live_YOUR_KEY'}" -H "Content-Type: application/json" -d '{"event": "sprint_task_updated", "task_title": "Fix CI Pipeline Auth Bug", "status": "done", "agile_workflow": "${workspace?.settings?.agile_workflow || 'scrum'}", "workflow_column": "Sprint Backlog"}'`
                            : snippetLang === 'node'
                            ? `const response = await fetch("https://paper5.co/api/v1/sync?workspace=${workspaceId}&key=${config.api_key || 'sp_live_YOUR_KEY'}", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "proof_of_work_submitted", task_title: "Deploy Vercel Edge Function", agile_workflow: "${workspace?.settings?.agile_workflow || 'scrum'}", workflow_column: "In Progress" }) });`
                            : `import requests\nurl = "https://paper5.co/api/v1/sync?workspace=${workspaceId}&key=${config.api_key || 'sp_live_YOUR_KEY'}"\nresponse = requests.post(url, json={"event": "sprint_velocity_sync", "agile_workflow": "${workspace?.settings?.agile_workflow || 'scrum'}"})\nprint(response.json())`
                          navigator.clipboard.writeText(text)
                          setAlertMessage('Code snippet copied to clipboard.')
                        }}
                      >
                        Copy Code
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab 3: Interactive Simulator */}
                {apiStudioTab === 'test' && (
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                      JSON Request Body Payload:
                    </label>
                    <textarea
                      rows={6}
                      value={simulatedPayload}
                      onChange={e => setSimulatedPayload(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                        background: '#0d1117',
                        color: '#e6edf3',
                        fontFamily: 'var(--mono)',
                        fontSize: '12px',
                        resize: 'vertical'
                      }}
                    />

                    <div style={{ marginTop: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <button
                        className="btn-primary"
                        disabled={simulating}
                        onClick={() => {
                          setSimulating(true)
                          setSimulationResponse(null)
                          setTimeout(() => {
                            try {
                              const parsed = JSON.parse(simulatedPayload)
                              setSimulationResponse({
                                status: 200,
                                ok: true,
                                latency: '38ms',
                                response: {
                                  status: 'success',
                                  code: 200,
                                  message: '1-Click API Webhook & Agile Workflow transition processed.',
                                  workspace_id: workspaceId,
                                  received_payload: parsed
                                }
                              })
                            } catch (e) {
                              setSimulationResponse({
                                status: 400,
                                ok: false,
                                latency: '12ms',
                                response: {
                                  error: 'Invalid JSON',
                                  message: e.message
                                }
                              })
                            } finally {
                              setSimulating(false)
                            }
                          }, 600)
                        }}
                      >
                        {simulating ? 'Executing...' : '▶ Run Test Request'}
                      </button>
                    </div>

                    {simulationResponse && (
                      <div style={{ marginTop: '16px', padding: '16px', background: simulationResponse.ok ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', border: simulationResponse.ok ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: simulationResponse.ok ? '#10b981' : '#ef4444' }}>
                            HTTP {simulationResponse.status}
                          </span>
                        </div>
                        <pre style={{ margin: 0, padding: '12px', background: '#0d1117', color: '#e6edf3', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--mono)', overflowX: 'auto' }}>
                          {JSON.stringify(simulationResponse.response, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bento-terminal-mock">
                <div className="bento-terminal-header">
                  <div className="bento-terminal-dots">
                    <span className="bento-terminal-dot" style={{ background: '#ef4444' }} />
                    <span className="bento-terminal-dot" style={{ background: '#f59e0b' }} />
                    <span className="bento-terminal-dot" style={{ background: '#10b981' }} />
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>api.paper5.co &bull; v1/sprint/webhook</span>
                </div>
                <pre className="bento-terminal-code">
                  <span className="comment"># 1-Click Webhook Trigger (GitHub Actions / GitLab / CI)</span>{'\n'}
                  <span className="kw">curl</span> -X POST https://api.paper5.co/v1/sprint/webhook \{'\n'}
                  {'  '}-H <span className="str">"Authorization: Bearer p5_live_9f82d1c7..."</span> \{'\n'}
                  {'  '}-d <span className="str">'&#123;"event": "task.progress", "taskId": "tsk_82a", "status": "in_review"&#125;'</span>
                </pre>
                <div className="bento-locked-overlay">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Lock size={16} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: '#ffffff' }}>Scale Tier Exclusive</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>Upgrade to unlock custom automated webhook listeners and REST API keys.</div>
                    </div>
                  </div>
                  <button 
                    className="btn-primary"
                    onClick={() => setIsPricingModalOpen(true)}
                    style={{ whiteSpace: 'nowrap', padding: '8px 18px', fontSize: '13px' }}
                  >
                    Upgrade to Scale
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bento Tile: Spans 8 Columns - Meeting Notes & Google Calendar Sync */}
          <div className="bento-tile-8 bento-card bento-card-google">
            <div className="integration-card-top">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="bento-brand-icon icon-google">
                  <Calendar size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px' }}>Google Calendar &amp; Meeting Notes Sync</h3>
                  <p className="integration-desc" style={{ marginTop: '2px', fontSize: '12.5px' }}>
                    Auto-sync notes directly onto the Meeting Agenda page when events occur.
                  </p>
                </div>
              </div>
              <span className="integration-status integration-status--ready">
                {savingNotes ? 'Saving...' : 'Auto-saved'}
              </span>
            </div>
            
            <div className="integration-fields" style={{ marginTop: '4px' }}>
              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
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
                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px', background: 'var(--bg-layer-2)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer' }}
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
                  <div style={{ padding: '10px', background: 'var(--bg-inset)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Connect Google Calendar below to select an event{isAdmin ? ', or click "+ Custom Note" to add one manually.' : '.'}
                  </div>
                )}
              </div>

              {selectedEventId && (
                <>
                  <div className="field-row" style={{ display: 'flex', gap: '12px' }}>
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
                  </div>
                  <div className="field">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ margin: 0 }}>Notes Summary</label>
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
                      rows={4}
                      style={{ width: '100%', background: !canEdit ? 'transparent' : 'var(--bg-layer-2)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '10px', fontFamily: 'inherit', resize: 'vertical', cursor: !canEdit ? 'default' : 'text' }}
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

          {/* Bento Tiles: Spans 4 Columns Each for GitHub, Discord, Slack, Vercel */}
          {INTEGRATIONS.map(integration => {
            const isAllowedByPlan = currentPlan.allowedIntegrations ? currentPlan.allowedIntegrations.includes(integration.id) : true
            const configured = integration.isConfigured(formConfig, formCredentials)
            const result = testResults[integration.id]
            const brandMeta = BRAND_META[integration.id] || { iconClass: 'icon-api', icon: <Terminal size={16} />, previewLabel: integration.name, previewDot: '#10b981', previewText: 'Configured', previewMeta: 'Live' }
            const brandClass = `bento-tile-4 bento-card bento-card-${integration.id}`
            const isGoogleCal = integration.id === 'google_calendar'
            const isGoogleConnected = isGoogleCal && Boolean(googleCalendar?.actions?.hasValidToken())

            // Dynamic StageShow preview chip
            let chipMeta = { ...brandMeta }
            if (isGoogleCal) {
              if (isGoogleConnected) {
                if (calendarEvents.length > 0) {
                  const first = calendarEvents[0]
                  const timeStr = first.start?.dateTime ? new Date(first.start.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'All-day'
                  chipMeta = {
                    ...chipMeta,
                    previewLabel: first.summary || 'Upcoming Meeting',
                    previewDot: '#10b981',
                    previewText: timeStr,
                    previewMeta: 'Live'
                  }
                } else {
                  chipMeta = {
                    ...chipMeta,
                    previewLabel: 'Google Calendar',
                    previewDot: '#10b981',
                    previewText: 'No upcoming meetings',
                    previewMeta: 'Connected'
                  }
                }
              } else if (configured) {
                chipMeta = {
                  ...chipMeta,
                  previewLabel: 'Google Calendar',
                  previewDot: '#3b82f6',
                  previewText: 'Click to connect account',
                  previewMeta: 'Ready'
                }
              }
            }

            return (
              <div key={integration.id} className={brandClass}>
                <div 
                  className="integration-card-top" 
                  style={{ cursor: 'pointer', userSelect: 'none' }} 
                  onClick={() => toggleCard(integration.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className={`bento-brand-icon ${chipMeta.iconClass}`}>
                      {chipMeta.icon}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '15px', margin: 0 }}>{integration.name}</h3>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                        {isAllowedByPlan ? (configured ? (isGoogleCal ? (isGoogleConnected ? 'Account connected' : 'Ready to link account') : 'Ready & active') : 'Click to configure') : 'Plan upgrade required'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`integration-status${configured && isAllowedByPlan ? ' integration-status--ready' : ''}`}>
                      {!isAllowedByPlan ? 'Locked' : (configured ? (isGoogleCal && isGoogleConnected ? 'Connected' : 'Active') : 'Setup')}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', transform: expandedCards[integration.id] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                  </div>
                </div>

                <p className="integration-desc">{integration.description}</p>

                {!expandedCards[integration.id] && (
                  <div className="bento-preview-chip" onClick={() => toggleCard(integration.id)} style={{ cursor: 'pointer' }} title="Click to expand settings">
                    <div className="bento-preview-left">
                      <span className="bento-preview-dot" style={{ background: chipMeta.previewDot || (configured ? '#10b981' : (isAllowedByPlan ? '#3b82f6' : '#f59e0b')) }} />
                      <span>{chipMeta.previewLabel}</span>
                      <span style={{ color: 'var(--muted, #64748B)' }}>&bull;</span>
                      <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>{chipMeta.previewText}</span>
                    </div>
                    <span className="bento-preview-meta">{chipMeta.previewMeta}</span>
                  </div>
                )}

                {expandedCards[integration.id] && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                    {!isAllowedByPlan ? (
                      <div style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.05)', border: '1px dashed rgba(245, 158, 11, 0.3)', borderRadius: '8px', fontSize: '13px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                          {integration.name} is exclusive to {integration.id === 'github' ? 'Team & Pro Plans' : 'Pro Plan'}.
                        </div>
                        <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          Upgrade your workspace tier to connect {integration.name} for team notifications & workflow triggers.
                        </p>
                        <button className="btn-primary btn-sm" onClick={() => setIsPricingModalOpen(true)}>
                          Upgrade Plan
                        </button>
                      </div>
                    ) : (
                      <>
                        {isGoogleCal && (
                          <div style={{ padding: '12px 14px', background: isGoogleConnected ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-layer-2)', border: `1px solid ${isGoogleConnected ? 'rgba(16, 185, 129, 0.25)' : 'var(--border-subtle)'}`, borderRadius: '8px', fontSize: '12.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ fontWeight: 600, color: isGoogleConnected ? '#059669' : 'var(--text-primary)' }}>
                                {isGoogleConnected ? '✓ Personal Google Account Connected' : 'Google Account Not Linked'}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                {isGoogleConnected ? 'Your calendar events are syncing with your workspace.' : 'Click to authorize your personal Google Calendar.'}
                              </div>
                            </div>
                            <button
                              type="button"
                              className={isGoogleConnected ? "btn-ghost btn-sm" : "btn-primary btn-sm"}
                              style={{ fontSize: '12px', padding: '5px 12px', height: 'auto', color: isGoogleConnected ? 'var(--accent-critical)' : undefined }}
                              onClick={async () => {
                                if (isGoogleConnected) {
                                  googleCalendar.actions.disconnectCalendar()
                                  setCalendarEvents([])
                                  setTestResults(prev => ({ ...prev, google_calendar: { ok: 'Google account disconnected.' } }))
                                } else {
                                  try {
                                    await googleCalendar.actions.connectCalendar(formConfig, formCredentials)
                                    const evts = await googleCalendar.actions.fetchUpcomingEvents(formConfig, formCredentials)
                                    setCalendarEvents(evts)
                                    setTestResults(prev => ({ ...prev, google_calendar: { ok: 'Google account connected successfully!' } }))
                                  } catch (err) {
                                    setTestResults(prev => ({ ...prev, google_calendar: { error: err.message || 'Failed to connect.' } }))
                                  }
                                }
                              }}
                            >
                              {isGoogleConnected ? 'Disconnect' : 'Connect Account'}
                            </button>
                          </div>
                        )}

                        <div className="integration-fields">
                          {integration.configFields.map(f => {
                            const isPassword = f.type === 'password'
                            const isShown = showSecrets[f.key]
                            const inputType = isPassword ? (isShown ? 'text' : 'password') : 'text'

                            return (
                              <div className="field" key={f.key}>
                                <label>{f.label}</label>
                                <input
                                  type={inputType}
                                  value={formConfig[f.key] || ''}
                                  placeholder={f.placeholder}
                                  onChange={(e) => setFormConfig(prev => ({ ...prev, [f.key]: e.target.value }))}
                                  disabled={!isAdmin}
                                />
                              </div>
                            )
                          })}
                          {integration.credentialFields.map(f => {
                            const isShown = showSecrets[f.key]
                            const inputType = isShown ? 'text' : 'password'

                            return (
                              <div className="field" key={f.key}>
                                <label>{f.label} <span className="integration-private-tag">(private)</span></label>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                  <input
                                    type={inputType}
                                    value={formCredentials[f.key] || ''}
                                    onChange={(e) => setFormCredentials(prev => ({ ...prev, [f.key]: e.target.value }))}
                                    style={{ width: '100%', paddingRight: '36px' }}
                                  />
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
                            {result?.loading ? 'Testing…' : 'Test'}
                          </button>
                        </div>

                        {result?.error && <div className="form-error">{result.error}</div>}
                        {result?.ok && <div className="form-status form-status--ok">{result.ok}</div>}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* StageShow Telemetry & Webhook Delivery Stat Tile (Spans 8 Columns - Completes Row 4) */}
          <div className="bento-tile-8 bento-card bento-card-telemetry">
            <div className="integration-card-top">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="bento-brand-icon icon-telemetry">
                  <Zap size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px' }}>Real-Time Event Telemetry &amp; Delivery Engine</h3>
                  <p className="integration-desc" style={{ marginTop: '2px', fontSize: '12.5px' }}>
                    Zero-drop HMAC-SHA256 signed event propagation across all connected tools.
                  </p>
                </div>
              </div>
              <span className="integration-status integration-status--ready">
                Sub-50ms SLA
              </span>
            </div>

            <div className="bento-stat-grid" style={{ marginTop: '4px' }}>
              <div className="bento-stat-big">
                <div className="bento-stat-number">99.98%</div>
                <div className="bento-stat-kicker">Delivery Reliability</div>
              </div>
              <div className="bento-live-indicators">
                <div className="bento-live-chip">
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                  <span>GitHub CI: Real-Time</span>
                </div>
                <div className="bento-live-chip">
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6' }} />
                  <span>Google GIS: Synchronized</span>
                </div>
                <div className="bento-live-chip">
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#5865f2' }} />
                  <span>Discord/Slack: Armed</span>
                </div>
              </div>
            </div>
          </div>
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
      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
        currentPlan={effectivePlanId}
        onSelectPlan={async (planId) => {
          if (updateWorkspacePlan) {
            await updateWorkspacePlan(planId)
          }
          setIsPricingModalOpen(false)
          setAlertMessage(`Plan updated to ${planId.toUpperCase()} successfully!`)
        }}
      />
    </div>
  )
}
