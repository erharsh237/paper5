import { useEffect, useState } from 'react'
import { subscribeReflections, submitReflection } from '../lib/reflections'
import './ReflectionPanel.css'

export default function ReflectionPanel({ teamId, sprint, currentUser, members }) {
  const [reflections, setReflections] = useState([])
  const [completedTasks, setCompletedTasks] = useState(true)
  const [whyNot, setWhyNot] = useState('')
  const [biggestBlocker, setBiggestBlocker] = useState('')
  const [improvement, setImprovement] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!sprint) return
    return subscribeReflections(teamId, sprint.id, setReflections)
  }, [teamId, sprint])

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
      await submitReflection(teamId, sprint.id, {
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
            const done = reflections.some(r => r.memberEmail === m.email?.toLowerCase())
            return (
              <span key={m.id} className={`reflection-status-pill${done ? ' reflection-status-pill--done' : ''}`}>
                {m.name} {done ? '✓' : '—'}
              </span>
            )
          })}
        </div>
      )}
    </section>
  )
}
