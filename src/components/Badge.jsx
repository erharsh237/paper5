import './Badge.css'

const URGENCY_LABEL = {
  overdue: 'Overdue',
  critical: 'Due soon',
  warn: 'This week',
  clear: 'On track',
  done: 'Complete',
}

export function UrgencyBadge({ urgency }) {
  return (
    <span className={`badge badge--${urgency}`}>
      <span className="badge-dot" />
      {URGENCY_LABEL[urgency]}
    </span>
  )
}

const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' }

export function PriorityBadge({ priority }) {
  return <span className={`badge badge--priority-${priority}`}>{PRIORITY_LABEL[priority]}</span>
}

const STATUS_LABEL = {
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
}

export function StatusBadge({ status }) {
  return <span className={`badge badge--status-${status}`}>{STATUS_LABEL[status]}</span>
}
