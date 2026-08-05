import { differenceInHours, differenceInDays, format, isPast, formatDistanceToNow } from 'date-fns'

export const PRIORITIES = ['low', 'medium', 'high', 'critical']
export const STATUSES = [
  { key: 'not_started', label: 'Not started' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'review', label: 'In review' },
  { key: 'done', label: 'Done' },
]

export const EVIDENCE_TYPES = [
  { key: 'github_commit', label: 'GitHub Commit' },
  { key: 'github_pr', label: 'Pull Request' },
  { key: 'github_merge', label: 'Merge' },
  { key: 'deployment', label: 'Deployment URL' },
  { key: 'documentation', label: 'Documentation Link' },
  { key: 'screenshot', label: 'Screenshot URL' },
  { key: 'video', label: 'Video Recording URL' },
  { key: 'meeting_notes', label: 'Meeting Notes' },
  { key: 'manual_approval', label: 'Manual Approval' }
]

export const BLOCKER_CATEGORIES = [
  { key: 'technical', label: 'Technical' },
  { key: 'dependency', label: 'Dependency' },
  { key: 'waiting_review', label: 'Waiting Review' },
  { key: 'waiting_client', label: 'Waiting Client' },
  { key: 'waiting_manager', label: 'Waiting Manager' },
  { key: 'infrastructure', label: 'Infrastructure' },
  { key: 'unknown', label: 'Unknown' }
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

export function formatWorkspaceDate(dateValue, settings) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  
  let timeZone = 'UTC';
  if (settings && settings.timezone) {
    timeZone = settings.timezone;
  }
  
  let dateFormat = settings && settings.date_format ? settings.date_format : 'MM/DD/YYYY';
  
  // Format parts
  const options = { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
  let parts;
  try {
     parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
  } catch (e) {
     // fallback if timezone is invalid
     parts = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).formatToParts(date);
  }
  
  const pMap = {};
  parts.forEach(p => pMap[p.type] = p.value);
  
  const m = pMap.month;
  const d = pMap.day;
  const y = pMap.year;
  
  let dateStr = `${m}/${d}/${y}`; // Default MM/DD/YYYY
  if (dateFormat === 'DD/MM/YYYY') dateStr = `${d}/${m}/${y}`;
  if (dateFormat === 'YYYY-MM-DD') dateStr = `${y}-${m}-${d}`;
  
  const timeStr = `${pMap.hour}:${pMap.minute} ${pMap.dayPeriod || ''}`;
  
  return {
    full: `${dateStr} · ${timeStr}`,
    relative: formatDistanceToNow(date, { addSuffix: true })
  };
}

export function daysLeft(dueDateIso) {
  return differenceInDays(new Date(dueDateIso), new Date())
}
