import { useState } from 'react'
import { createSprint } from '../lib/sprints'
import { useWorkspace } from '../lib/WorkspaceContext'
import { X, Calendar, User, Flag, Target, Sparkles } from 'lucide-react'

export default function CreateProjectModal({ existingCount, members = [], onClose, onCreated }) {
  const { workspaceId, isAdmin, isOwner } = useWorkspace()
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [priority, setPriority] = useState('medium')
  const [ownerId, setOwnerId] = useState('')
  const [selectedMembers, setSelectedMembers] = useState([])
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d.toISOString().slice(0, 10)
  })
  const [status, setStatus] = useState('active')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleToggleMember = (userId) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      return setError('Please enter a project name.')
    }
    if (!startDate || !endDate) {
      return setError('Both start and end dates are required.')
    }
    if (new Date(endDate) < new Date(startDate)) {
      return setError('Deadline must chronologically follow the start date.')
    }

    setSubmitting(true)
    try {
      const nextNumber = (existingCount || 0) + 1
      const created = await createSprint(workspaceId, undefined, {
        number: nextNumber,
        name: name.trim(),
        goal: goal.trim(),
        startDate,
        endDate,
        status,
        priority,
        ownerId: ownerId || null,
        memberIds: selectedMembers,
        archived: false
      })
      if (typeof onCreated === 'function') onCreated(created)
      onClose()
    } catch (err) {
      console.error('Project creation failed:', err)
      setError(err?.message || 'Failed to initialize project. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" style={{ maxWidth: '540px', width: '92%' }} role="dialog" aria-modal="true" aria-label="Create Project">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: '#f4f1ed', padding: '6px', borderRadius: '8px', display: 'flex' }}>
              <Sparkles size={18} color="#18181b" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Initialize New Project</h2>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#71717a' }}>Organize sprints, assign owners, and track milestone health</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', fontSize: '13px', margin: '0 24px 16px' }}>
            {error}
          </div>
        )}

        <form className="modal-form" onSubmit={handleSubmit} style={{ padding: '0 24px 24px' }}>
          <div className="field">
            <label htmlFor="project-name" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
              Project Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="project-name"
              type="text"
              placeholder="e.g. Core API v2, Mobile App Beta, Website Redesign"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e4e4e7', fontSize: '14px' }}
            />
          </div>

          <div className="field" style={{ marginTop: '14px' }}>
            <label htmlFor="project-goal" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
              Strategic Goal &amp; Deliverables
            </label>
            <textarea
              id="project-goal"
              rows={3}
              placeholder="What must be accomplished to declare this project or sprint a success?"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e4e4e7', fontSize: '13.5px', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '14px' }}>
            <div className="field">
              <label htmlFor="project-priority" style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                <Flag size={14} color="#71717a" /> Priority
              </label>
              <select
                id="project-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e4e4e7', fontSize: '13.5px' }}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="critical">Critical / Urgent</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="project-status" style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                <Target size={14} color="#71717a" /> Initial State
              </label>
              <select
                id="project-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e4e4e7', fontSize: '13.5px' }}
              >
                <option value="active">Active (Immediate Sprint)</option>
                <option value="planning">Planning (Backlog)</option>
              </select>
            </div>
          </div>

          <div className="field" style={{ marginTop: '14px' }}>
            <label htmlFor="project-owner" style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
              <User size={14} color="#71717a" /> Project Owner / Lead
            </label>
            <select
              id="project-owner"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e4e4e7', fontSize: '13.5px' }}
            >
              <option value="">Unassigned (Team Shared)</option>
              {members.map((m) => (
                <option key={m.id || m.userId || m.user_id} value={m.id || m.userId || m.user_id}>
                  {m.name || m.displayName || m.email} ({m.role || 'Member'})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '14px' }}>
            <div className="field">
              <label htmlFor="project-start" style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                <Calendar size={14} color="#71717a" /> Start Date
              </label>
              <input
                id="project-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e4e4e7', fontSize: '13.5px' }}
              />
            </div>

            <div className="field">
              <label htmlFor="project-end" style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                <Calendar size={14} color="#ef4444" /> Target Deadline
              </label>
              <input
                id="project-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e4e4e7', fontSize: '13.5px' }}
              />
            </div>
          </div>

          {members.length > 0 && (
            <div className="field" style={{ marginTop: '16px' }}>
              <label style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px', display: 'block' }}>
                Assigned Team Members ({selectedMembers.length} selected)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '110px', overflowY: 'auto', padding: '6px', border: '1px solid #e4e4e7', borderRadius: '8px' }}>
                {members.map((m) => {
                  const mId = m.id || m.userId || m.user_id
                  const isSelected = selectedMembers.includes(mId)
                  return (
                    <button
                      key={mId}
                      type="button"
                      onClick={() => handleToggleMember(mId)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '16px',
                        fontSize: '12px',
                        border: '1px solid',
                        borderColor: isSelected ? '#18181b' : '#e4e4e7',
                        background: isSelected ? '#18181b' : '#f4f4f5',
                        color: isSelected ? '#ffffff' : '#3f3f46',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {m.name || m.displayName || m.email?.split('@')[0]}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={onClose}
              disabled={submitting}
              style={{ padding: '9px 16px', borderRadius: '8px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                background: '#18181b',
                color: '#ffffff',
                fontWeight: 600,
                cursor: submitting ? 'wait' : 'pointer'
              }}
            >
              {submitting ? 'Creating Project...' : 'Initialize Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
