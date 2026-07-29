import { useEffect, useState } from 'react'
import { AI_CAPABILITIES, aiAssistant } from '../lib/ai'
import { subscribeSprints } from '../lib/sprints'
import { subscribeMembers } from '../lib/deadlines'
import './AIAssistantWidget.css'

const TEAM_ID = 'default-team'

export default function AIAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [sprints, setSprints] = useState([])
  const [members, setMembers] = useState([])
  const [openId, setOpenId] = useState(null)
  const [formState, setFormState] = useState({})
  const [results, setResults] = useState({})

  useEffect(() => {
    if (!isOpen) return
    const unsub1 = subscribeSprints(TEAM_ID, setSprints)
    const unsub2 = subscribeMembers(TEAM_ID, setMembers)
    return () => { unsub1(); unsub2() }
  }, [isOpen])

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
    <div className="ai-widget-container">
      <div className={`ai-widget-panel ${isOpen ? 'open' : ''}`}>
        <div className="ai-widget-header">
          <h2>AI Assistant</h2>
          <button onClick={() => setIsOpen(false)} aria-label="Close panel">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="ai-widget-body">
          <p className="integrations-intro" style={{ margin: '0 0 16px 0', fontSize: '13px' }}>
            Runs against a real Cloud Function backend. Select a capability below:
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
        </div>
      </div>
      
      <button className="ai-widget-button" onClick={() => setIsOpen(!isOpen)} aria-label="Toggle AI Assistant">
        <svg viewBox="0 0 24 24">
          <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </div>
  )
}

function AICapabilityCard({ cap, open, onToggle, values, onChange, onRun, result, sprints, members }) {
  return (
    <div className="integration-card ai-card">
      <div className="integration-card-top">
        <h3 style={{ fontSize: '14px' }}>{cap.label}</h3>
        <button className="btn-ghost btn-sm" onClick={onToggle}>{open ? 'Close' : 'Open'}</button>
      </div>
      {open && <p className="integration-desc" style={{ marginTop: '8px' }}>{cap.description}</p>}

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
