import { useState } from 'react'
import { UrgencyBadge, PriorityBadge } from './Badge'
import { getUrgency, formatDue, STATUSES } from '../lib/utils'
import { updateDeadline, deleteDeadline } from '../lib/deadlines'
import './DeadlineCard.css'

export default function DeadlineCard({ deadline, currentUser }) {
  const [expanded, setExpanded] = useState(false)
  const urgency = getUrgency(deadline.dueDate, deadline.status)
  const due = formatDue(deadline.dueDate)
  const isOwner = currentUser?.email && deadline.createdBy === currentUser.email

  function handleStatusChange(e) {
    updateDeadline(deadline.id, { status: e.target.value })
  }

  function handleDelete() {
    if (confirm(`Delete "${deadline.title}"?`)) {
      deleteDeadline(deadline.id)
    }
  }

  return (
    <div className={`dcard dcard--${urgency}`}>
      <div className="dcard-main" onClick={() => setExpanded(!expanded)}>
        <div className="dcard-top">
          <div className="dcard-badges">
            <UrgencyBadge urgency={urgency} />
            <PriorityBadge priority={deadline.priority} />
          </div>
          <span className="dcard-due mono">{due.relative}</span>
        </div>

        <h3 className="dcard-title">{deadline.title}</h3>

        <div className="dcard-meta">
          <span className="dcard-assignee">
            <span className="avatar-dot mono">{deadline.assigneeName?.[0]?.toUpperCase() || '?'}</span>
            {deadline.assigneeName}
          </span>
          <span className="dcard-date mono">{due.full}</span>
        </div>
      </div>

      {expanded && (
        <div className="dcard-expanded">
          {deadline.description && <p className="dcard-desc">{deadline.description}</p>}
          <div className="dcard-controls">
            <select
              value={deadline.status}
              onChange={handleStatusChange}
              onClick={(e) => e.stopPropagation()}
              className="dcard-status-select"
            >
              {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            {isOwner && (
              <button
                className="dcard-delete"
                onClick={(e) => { e.stopPropagation(); handleDelete() }}
              >
                Delete
              </button>
            )}
          </div>
          <div className="dcard-footnote mono">assigned by {deadline.createdByName || deadline.createdBy}</div>
        </div>
      )}
    </div>
  )
}
