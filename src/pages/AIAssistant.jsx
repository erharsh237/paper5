import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { AI_CAPABILITIES, aiAssistant } from '../lib/ai'
import { subscribeSprints } from '../lib/sprints'
import { subscribeMembers } from '../lib/deadlines'
import NotificationBell from '../components/NotificationBell'
import NavTabs from '../components/NavTabs'
import Breadcrumbs from '../components/Breadcrumbs'
import './Dashboard.css'
import './AIAssistant.css'

const TEAM_ID = 'default-team'

export default function AIAssistant() {
  const { user, logout } = useAuth()
  const [sprints, setSprints] = useState([])
  const [members, setMembers] = useState([])
  const [openId, setOpenId] = useState(null)
  const [formState, setFormState] = useState({})
  const [results, setResults] = useState({})

  useEffect(() => {
    const unsub1 = subscribeSprints(TEAM_ID, setSprints)
    const unsub2 = subscribeMembers(TEAM_ID, setMembers)
    return () => { unsub1(); unsub2() }
  }, [])

  function setField(capId, key, value) {
    setFormState(prev => ({ ...prev, [capId]: { ...prev[capId], [key]: value } }))
  }

  async function handleRun(cap) {
    const values = formState[cap.id] || {}
    const missing = cap.fields.filter(f => f.required && !values[f.key])
    if (missing.length > 0) {
      setResults(prev => ({ ...prev, [cap.id]: { error: `${missing[0].label} is required.` } }))
      return
    }

    setResults(prev => ({ ...prev, [cap.id]: { loading: true } }))
    try {
      let data
      if (cap.id === 'breakFeatureIntoTasks') {
        data = await aiAssistant.breakFeatureIntoTasks(values.description, values.sprintGoal)
      } else if (cap.id === 'estimateHours') {
        data = await aiAssistant.estimateHours(values.title, values.description)
      } else if (cap.id === 'generateDefinitionOfDone') {
        data = await aiAssistant.generateDefinitionOfDone(values.title, values.description)
      } else if (cap.id === 'generateAcceptanceCriteria') {
        data = await aiAssistant.generateAcceptanceCriteria(values.title, values.description)
      } else if (cap.id === 'summarizeSprint') {
        data = await aiAssistant.summarizeSprint(values.sprintId)
      } else if (cap.id === 'identifyRisks') {
        data = await aiAssistant.identifyRisks(values.sprintId)
      } else if (cap.id === 'detectOverloadedFounders') {
        data = await aiAssistant.detectOverloadedFounders(values.availableHoursByMember || {})
      }
      setResults(prev => ({ ...prev, [cap.id]: { data } }))
    } catch (err) {
      setResults(prev => ({ ...prev, [cap.id]: { error: err.message } }))
    }
  }

  return (
    <div className="dash">
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-brand">
            <span className="dash-brand-dot" />
            <span className="mono">SECURIQ <span className="dash-brand-sub">| AI Assistant</span></span>
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
        <Breadcrumbs trail={[{ label: 'AI Assistant' }]} />

        <p className="integrations-intro">
          Runs against a real Cloud Function backend (see <code>functions/index.js</code>) — the Anthropic API key
          lives only there, never in this page. If a call fails with a backend-unreachable error, the functions
          likely haven't been deployed yet.
        </p>

        <div className="ai-list">
          {AI_CAPABILITIES.map(cap => (
            <AICapabilityCard
              key={cap.id}
              cap={cap}
              open={openId === cap.id}
              onToggle={() => setOpenId(openId === cap.id ? null : cap.id)}
              values={formState[cap.id] || {}}
              onChange={(key, value) => setField(cap.id, key, value)}
              onRun={() => handleRun(cap)}
              result={results[cap.id]}
              sprints={sprints}
              members={members}
            />
          ))}
        </div>
      </main>
    </div>
  )
}

function AICapabilityCard({ cap, open, onToggle, values, onChange, onRun, result, sprints, members }) {
  return (
    <div className="integration-card ai-card">
      <div className="integration-card-top">
        <h3>{cap.label}</h3>
        <button className="btn-ghost btn-sm" onClick={onToggle}>{open ? 'Close' : 'Open'}</button>
      </div>
      <p className="integration-desc">{cap.description}</p>

      {open && (
        <div className="ai-card-form">
          {cap.fields.map(field => (
            <AIField key={field.key} field={field} value={values[field.key]} onChange={(v) => onChange(field.key, v)} sprints={sprints} members={members} />
          ))}

          <button className="btn-primary btn-sm" disabled={result?.loading} onClick={onRun}>
            {result?.loading ? 'Running…' : 'Run'}
          </button>

          {result?.error && <div className="form-error">{result.error}</div>}
          {result?.data && <AIResult capId={cap.id} data={result.data} />}
        </div>
      )}
    </div>
  )
}

function AIField({ field, value, onChange, sprints, members }) {
  if (field.type === 'textarea') {
    return (
      <div className="field">
        <label>{field.label}</label>
        <textarea rows={3} value={value || ''} onChange={(e) => onChange(e.target.value)} />
      </div>
    )
  }
  if (field.type === 'sprint-select') {
    return (
      <div className="field">
        <label>{field.label}</label>
        <select value={value || ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select a sprint…</option>
          {sprints.map(s => <option key={s.id} value={s.id}>Sprint {s.number} — {s.goal || 'no goal set'}</option>)}
        </select>
      </div>
    )
  }
  if (field.type === 'hours-by-member') {
    const hoursMap = value || {}
    return (
      <div className="field">
        <label>{field.label}</label>
        {members.length === 0 && <p className="profile-hint">No team members yet.</p>}
        {members.map(m => (
          <div key={m.id} className="ai-hours-row">
            <span>{m.name}</span>
            <input
              type="number" min="0" placeholder="hrs"
              value={hoursMap[m.email?.toLowerCase()] ?? ''}
              onChange={(e) => onChange({ ...hoursMap, [m.email?.toLowerCase()]: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="field">
      <label>{field.label}</label>
      <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function AIResult({ capId, data }) {
  if (capId === 'breakFeatureIntoTasks') {
    return (
      <div className="ai-result">
        {(data.tasks || []).map((t, i) => (
          <div key={i} className="ai-result-row">
            <strong>{t.title}</strong> — {t.estimatedHours}h
            {t.dependencies?.length > 0 && <span className="ai-result-sub"> (depends on: {t.dependencies.join(', ')})</span>}
          </div>
        ))}
      </div>
    )
  }
  if (capId === 'estimateHours') {
    return (
      <div className="ai-result">
        <div><strong>{data.estimatedHours} hours</strong></div>
        <p className="ai-result-sub">{data.reasoning}</p>
      </div>
    )
  }
  if (capId === 'generateDefinitionOfDone') {
    return <div className="ai-result"><p>{data.definitionOfDone}</p></div>
  }
  if (capId === 'generateAcceptanceCriteria') {
    return (
      <ul className="ai-result">
        {(data.criteria || []).map((c, i) => <li key={i}>{c}</li>)}
      </ul>
    )
  }
  if (capId === 'summarizeSprint') {
    return <div className="ai-result"><p>{data.summary}</p></div>
  }
  if (capId === 'identifyRisks') {
    return (
      <div className="ai-result">
        {(data.risks || []).length === 0 ? <p className="profile-hint">No risks flagged.</p> : data.risks.map((r, i) => (
          <div key={i} className="ai-result-row"><strong>{r.title}</strong> — {r.reason}</div>
        ))}
      </div>
    )
  }
  if (capId === 'detectOverloadedFounders') {
    return (
      <div className="ai-result">
        {(data.overloaded || []).length === 0 ? <p className="profile-hint">Nobody's over capacity.</p> : data.overloaded.map((o, i) => (
          <div key={i} className="ai-result-row"><strong>{o.name}</strong> — {o.overByHours}h over</div>
        ))}
      </div>
    )
  }
  return <pre className="ai-result">{JSON.stringify(data, null, 2)}</pre>
}
