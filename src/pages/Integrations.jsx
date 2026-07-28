import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { INTEGRATIONS } from '../lib/integrations'
import { subscribeIntegrationConfig, saveIntegrationConfig, subscribeIntegrationCredentials, saveIntegrationCredentials } from '../lib/integrations/config'
import NotificationBell from '../components/NotificationBell'
import NavTabs from '../components/NavTabs'
import Breadcrumbs from '../components/Breadcrumbs'
import './Dashboard.css'
import './Integrations.css'

const TEAM_ID = 'default-team'

export default function Integrations() {
  const { user, logout } = useAuth()
  const [config, setConfig] = useState({})
  const [credentials, setCredentials] = useState({})
  const [formConfig, setFormConfig] = useState({})
  const [formCredentials, setFormCredentials] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [testResults, setTestResults] = useState({})

  useEffect(() => {
    const unsub1 = subscribeIntegrationConfig(TEAM_ID, (c) => { setConfig(c); setFormConfig(prev => ({ ...c, ...prev })) })
    const unsub2 = subscribeIntegrationCredentials(user?.email, (c) => { setCredentials(c); setFormCredentials(prev => ({ ...c, ...prev })) })
    return () => { unsub1(); unsub2() }
  }, [user?.email])

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
        ok = 'Client ID saved — the consent popup will appear the first time you sync a sprint or meeting.'
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
          deployment status. Config fields (repo names, webhook URLs, project IDs) are shared with the whole team.
          Credential fields (personal tokens) are private to you only.
        </p>

        <div className="integrations-grid">
          {INTEGRATIONS.map(integration => {
            const configured = integration.isConfigured(formConfig, formCredentials)
            const result = testResults[integration.id]
            return (
              <div key={integration.id} className="integration-card">
                <div className="integration-card-top">
                  <h3>{integration.name}</h3>
                  <span className={`integration-status${configured ? ' integration-status--ready' : ''}`}>
                    {configured ? 'Configured' : 'Not configured'}
                  </span>
                </div>
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

                <div className="integration-actions-row">
                  <button className="btn-primary btn-sm" disabled={savingId === integration.id} onClick={() => handleSave(integration)}>
                    {savingId === integration.id ? 'Saving…' : 'Save'}
                  </button>
                  <button className="btn-ghost btn-sm" disabled={!configured || result?.loading} onClick={() => handleTest(integration)}>
                    {result?.loading ? 'Testing…' : 'Test'}
                  </button>
                </div>

                {result?.error && <div className="form-error">{result.error}</div>}
                {result?.ok && <div className="form-status form-status--ok">{result.ok}</div>}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
