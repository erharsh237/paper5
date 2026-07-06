import './Badge.css'

const URGENCY_LABEL = {
  overdue: 'Overdue',
  critical: 'Due soon',
  warn: 'This week',
  clear: 'On track',
  done: 'Complete',
}

// Status takes priority over date-based urgency, so the badge always
// reflects what the assignee actually set from the dropdown. Overdue is
// still called out even if someone left status as "on track", since that's
// a genuine deadline risk, not a status choice.
const STATUS_BADGE_LABEL = {
  not_started: 'Not started',
  in_progress: 'On track',
  blocked: 'Blocked',
  done: 'Complete',
}
const STATUS_BADGE_TONE = {
  not_started: 'warn',
  in_progress: 'clear',
  blocked: 'overdue',
  done: 'done',
}

export function UrgencyBadge({ urgency, status }) {
  if (status) {
    // Overdue + still not done overrides the status tone/label so risk stays visible.
    if (urgency === 'overdue' && status !== 'done') {
      return (
        <span className="badge badge--overdue">
          <span className="badge-dot" />
          Overdue
        </span>
      )
    }
    return (
      <span className={`badge badge--${STATUS_BADGE_TONE[status]}`}>
        <span className="badge-dot" />
        {STATUS_BADGE_LABEL[status]}
      </span>
    )
  }
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
