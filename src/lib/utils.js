import { differenceInHours, differenceInDays, format, isPast, formatDistanceToNow } from 'date-fns'

export const PRIORITIES = ['low', 'medium', 'high', 'critical']
export const STATUSES = [
  { key: 'not_started', label: 'Not started' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'review', label: 'In review' },
  { key: 'done', label: 'Done' },
]

export function getUrgency(dueDateIso, status) {
  if (status === 'done') return 'done'
  const due = new Date(dueDateIso)
  if (isPast(due)) return 'overdue'
  const hrs = differenceInHours(due, new Date())
  if (hrs <= 24) return 'critical'
  if (hrs <= 72) return 'warn'
  return 'clear'
}

export function formatDue(dueDateIso) {
  const due = new Date(dueDateIso)
  return {
    full: format(due, 'MMM d, yyyy · h:mm a'),
    relative: formatDistanceToNow(due, { addSuffix: true }),
  }
}

export function daysLeft(dueDateIso) {
  return differenceInDays(new Date(dueDateIso), new Date())
}
