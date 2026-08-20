import { useEffect, useState } from 'react'
import { subscribeReflections, submitReflection } from '../lib/reflections'
import { useWorkspace } from '../lib/WorkspaceContext'
import './ReflectionPanel.css'

export default function ReflectionPanel({ sprint, currentUser, members }) {
  const { workspaceId } = useWorkspace();
  const [reflections, setReflections] = useState([])
  const [completedTasks, setCompletedTasks] = useState(true)
  const [whyNot, setWhyNot] = useState('')
  const [biggestBlocker, setBiggestBlocker] = useState('')
  const [improvement, setImprovement] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!sprint) return
    return subscribeReflections(workspaceId, undefined, sprint.id, setReflections)
  }, [workspaceId, sprint])

  const myEmail = (currentUser?.email || '').toLowerCase()
  const mine = reflections.find(r => r.memberEmail === myEmail)

  useEffect(() => {
    if (mine) {
      setCompletedTasks(mine.completedTasks)
      setWhyNot(mine.whyNot || '')
      setBiggestBlocker(mine.biggestBlocker || '')
      setImprovement(mine.improvement || '')
    }
  }, [mine?.id])

  if (!sprint) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await submitReflection(workspaceId, undefined, sprint.id, {
        memberId: currentUser.uid,
        memberEmail: currentUser.email,
        memberName: currentUser.displayName || currentUser.email,
        completedTasks,
        whyNot: completedTasks ? '' : whyNot.trim(),
        biggestBlocker: biggestBlocker.trim(),
        improvement: improvement.trim(),
      })
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 2000)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="sprint-overview reflection-panel">
      <h2 className="mono">WEEKLY REFLECTION — SPRINT {sprint.number}</h2>

      <form className="reflection-form" onSubmit={handleSubmit}>
        <div className="field">
          <label>Did you complete your tasks?</label>
          <div className="reflection-toggle">
            <button type="button" className={`btn-ghost btn-sm${completedTasks ? ' reflection-toggle--on' : ''}`} onClick={() => setCompletedTasks(true)}>Yes</button>
            <button type="button" className={`btn-ghost btn-sm${!completedTasks ? ' reflection-toggle--on' : ''}`} onClick={() => setCompletedTasks(false)}>No</button>
          </div>
        </div>

        {!completedTasks && (
          <div className="field">
            <label htmlFor="refl-whynot">If not, why?</label>
            <textarea id="refl-whynot" rows={2} value={whyNot} onChange={(e) => setWhyNot(e.target.value)} />
          </div>
        )}

        <div className="field">
          <label htmlFor="refl-blocker">Biggest blocker?</label>
          <textarea id="refl-blocker" rows={2} value={biggestBlocker} onChange={(e) => setBiggestBlocker(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="refl-improve">What will you improve next sprint?</label>
          <textarea id="refl-improve" rows={2} value={improvement} onChange={(e) => setImprovement(e.target.value)} />
        </div>

        <div className="modal-actions" style={{ padding: 0 }}>
          <button type="submit" className="btn-primary btn-sm" disabled={submitting}>
            {submitting ? 'Saving…' : mine ? 'Update reflection' : 'Submit reflection'}
          </button>
          {submitted && <span className="form-status form-status--ok">Saved.</span>}
        </div>
      </form>

      {members?.length > 0 && (
        <div className="reflection-status-row">
          {members.map(m => {
            const done = reflections.some(r => r.memberEmail === (m.email || '').toLowerCase())
            return (
              <span key={m.id || m.userId} className={`reflection-status-pill${done ? ' reflection-status-pill--done' : ''}`}>
                {m.name || m.email} {done ? '✓' : '—'}
              </span>
            )
          })}
        </div>
      )}

      {reflections?.length > 0 && (
        <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-soft, #EAECF6)', paddingTop: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary, #000000)' }}>
              Team Submissions ({reflections.length}/{members?.length || 0})
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary, #6B7280)', fontFamily: 'var(--mono, monospace)' }}>
              Sprint {sprint.number}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {reflections.map(r => (
              <div 
                key={r.id || r.memberId} 
                style={{
                  background: 'var(--bg-layer-2, #F8FAFC)',
                  border: '1px solid var(--border-soft, #E2E8F0)',
                  borderRadius: '10px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary, #0F172A)' }}>
                    {r.memberName || r.memberEmail}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '100px',
                    background: r.completedTasks ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: r.completedTasks ? '#059669' : '#DC2626',
                    border: `1px solid ${r.completedTasks ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                  }}>
                    {r.completedTasks ? '✓ Tasks Completed' : '✕ Tasks Incomplete'}
                  </span>
                </div>

                {!r.completedTasks && r.whyNot && (
                  <div style={{ fontSize: '12px' }}>
                    <div style={{ color: 'var(--text-tertiary, #64748B)', fontWeight: 600, marginBottom: '2px' }}>Why not:</div>
                    <div style={{ color: 'var(--text-primary, #1E293B)', background: '#FFFFFF', padding: '6px 10px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>{r.whyNot}</div>
                  </div>
                )}

                {r.biggestBlocker && (
                  <div style={{ fontSize: '12px' }}>
                    <div style={{ color: 'var(--text-tertiary, #64748B)', fontWeight: 600, marginBottom: '2px' }}>Biggest blocker:</div>
                    <div style={{ color: 'var(--text-primary, #1E293B)', background: '#FFFFFF', padding: '6px 10px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>{r.biggestBlocker}</div>
                  </div>
                )}

                {r.improvement && (
                  <div style={{ fontSize: '12px' }}>
                    <div style={{ color: 'var(--text-tertiary, #64748B)', fontWeight: 600, marginBottom: '2px' }}>Next sprint improvement:</div>
                    <div style={{ color: 'var(--text-primary, #1E293B)', background: '#FFFFFF', padding: '6px 10px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>{r.improvement}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
