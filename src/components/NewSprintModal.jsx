import { useState } from 'react'
import { createSprint, setActiveSprint } from '../lib/sprints'
import { useWorkspace } from '../lib/WorkspaceContext'

export default function NewSprintModal({ currentUser, existingCount, members = [], onClose }) {
  const { workspaceId } = useWorkspace();
  const [number, setNumber] = useState(existingCount + 1)
  const [goal, setGoal] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const [activateNow, setActivateNow] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!startDate || !endDate) return setError('Both start and end dates must be specified to initialize a sprint.')
    if (new Date(endDate) < new Date(startDate)) return setError('The sprint end date must chronologically follow the start date.')

    setSubmitting(true)
    try {
      const selectedMember = members.find(m => m.id === assigneeId)
      const ref = await createSprint(workspaceId, undefined, {
        number: Number(number),
        goal: goal.trim(),
        startDate,
        endDate,
        assigneeId: assigneeId || null,
        assigneeName: selectedMember ? selectedMember.name || selectedMember.email : null,
        createdBy: currentUser?.email,
      })
      if (activateNow) await setActiveSprint(workspaceId, undefined, ref.id)
      onClose()
    } catch (err) {
      console.error(err)
      setError('Unable to initialize the new sprint. Please try again later.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label="Create sprint">
        <div className="modal-header">
          <h2>New sprint</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="field-row">
            <div className="field">
              <label htmlFor="sprint-number">Sprint number</label>
              <input
                id="sprint-number" type="number" min="1" value={number}
                onChange={(e) => setNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="sprint-goal">Sprint goal</label>
            <textarea
              id="sprint-goal" rows={2} value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Ship the detection engine MVP end-to-end"
            />
          </div>

          <div className="field">
            <label htmlFor="sprint-assignee">Assign to</label>
            <select
              id="sprint-assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              <option value="">(Unassigned)</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name || m.email}</option>
              ))}
            </select>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="sprint-start">Start date</label>
              <input id="sprint-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="sprint-end">End date</label>
              <input id="sprint-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <label className="checkbox-row">
            <input type="checkbox" checked={activateNow} onChange={(e) => setActivateNow(e.target.checked)} />
            Make this the active sprint
          </label>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create sprint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
