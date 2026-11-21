import { useState } from 'react'
import { updateDeadline } from '../lib/deadlines'
import { useWorkspace } from '../lib/WorkspaceContext'
import { X, UserCheck, Calendar, Flag, CheckCircle } from 'lucide-react'

export default function ReassignTaskModal({ task, members = [], onClose, onUpdated }) {
  const { workspaceId } = useWorkspace()
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId || task?.assignee_id || '')
  const [priority, setPriority] = useState(task?.priority || 'medium')
  const [status, setStatus] = useState(task?.status || 'todo')
  const [dueDate, setDueDate] = useState(() => (task?.dueDate || task?.due_date || '').slice(0, 10))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!task) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const selectedMember = members.find((m) => (m.id || m.userId || m.user_id) === assigneeId)
      const patch = {
        assignee_id: assigneeId || null,
        assignee_name: selectedMember?.name || selectedMember?.displayName || (assigneeId ? 'Assigned' : 'Unassigned'),
        assignee_email: (selectedMember?.email || '').toLowerCase().trim(),
        priority,
        status,
        due_date: dueDate || null
      }

      await updateDeadline(workspaceId, task.id, patch)
      if (typeof onUpdated === 'function') onUpdated({ ...task, ...patch })
      onClose()
    } catch (err) {
      console.error('Failed to reassign task:', err)
      setError(err?.message || 'Failed to update task assignment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" style={{ maxWidth: '480px', width: '92%' }} role="dialog" aria-modal="true" aria-label="Reassign Task">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: '#f4f1ed', padding: '6px', borderRadius: '8px', display: 'flex' }}>
              <UserCheck size={18} color="#18181b" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>Task Oversight &amp; Assignment</h2>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#71717a' }}>{task.title}</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', fontSize: '13px', margin: '0 24px 14px' }}>
            {error}
          </div>
        )}

        <form className="modal-form" onSubmit={handleSubmit} style={{ padding: '0 24px 20px' }}>
          <div className="field">
            <label htmlFor="reassign-member" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px', display: 'block' }}>
              Assignee
            </label>
            <select
              id="reassign-member"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e4e4e7', fontSize: '13.5px' }}
            >
              <option value="">⚪ Unassigned (Queue)</option>
              {members.map((m) => (
                <option key={m.id || m.userId || m.user_id} value={m.id || m.userId || m.user_id}>
                  {m.name || m.displayName || m.email} ({m.role || 'Member'})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <div className="field">
              <label htmlFor="reassign-status" style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                <CheckCircle size={14} color="#71717a" /> Status
              </label>
              <select
                id="reassign-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e4e4e7', fontSize: '13.5px' }}
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">In Review</option>
                <option value="done">Completed / Done</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="reassign-priority" style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                <Flag size={14} color="#71717a" /> Priority
              </label>
              <select
                id="reassign-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e4e4e7', fontSize: '13.5px' }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="field" style={{ marginTop: '12px' }}>
            <label htmlFor="reassign-due" style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
              <Calendar size={14} color="#71717a" /> Deadline
            </label>
            <input
              id="reassign-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e4e4e7', fontSize: '13.5px' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={onClose}
              disabled={submitting}
              style={{ padding: '8px 14px', borderRadius: '8px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                background: '#18181b',
                color: '#ffffff',
                fontWeight: 600,
                cursor: submitting ? 'wait' : 'pointer'
              }}
            >
              {submitting ? 'Saving...' : 'Save Updates'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
