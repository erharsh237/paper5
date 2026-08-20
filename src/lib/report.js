import { supabase } from './supabase'

const STATUS_LABEL = {
  not_started: 'Not Started',
  todo: 'To Do',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  review: 'In Review',
  in_review: 'In Review',
  done: 'Done',
  completed: 'Done'
}

function toJsDate(dueDateIso) {
  if (!dueDateIso) return null
  const d = new Date(dueDateIso)
  return isNaN(d.getTime()) ? null : d
}

function coerceDate(value) {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

function csvField(value) {
  const str = String(value ?? '')
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCsv(rows, columns) {
  const lines = [columns.map(csvField).join(',')]
  for (const row of rows) {
    lines.push(columns.map(col => csvField(row[col])).join(','))
  }
  return lines.join('\r\n')
}

/**
 * Builds and downloads a comprehensive, multi-attribute CSV report for a given month.
 * Includes complete task metadata, sprint details, blocker diagnostics, checklists, and extra-work logs.
 */
export async function downloadMonthlyReport(deadlines = [], members = [], options = {}) {
  const { year, month, workspace = null, sprints = [] } = options
  const monthStart = new Date(year, month, 1, 0, 0, 0)
  const monthEnd = new Date(year, month + 1, 1, 0, 0, 0)

  const inMonth = (d) => d && d >= monthStart && d < monthEnd

  const memberByEmail = new Map((members || []).map(m => [(m.email || '').toLowerCase().trim(), m]))
  const memberById = new Map((members || []).map(m => [m.id || m.userId, m]))
  const sprintById = new Map((sprints || []).map(s => [s.id, s]))

  // Filter tasks due, started, or created in this month, or active during this month
  const targetDeadlines = (deadlines || []).filter(d => {
    const due = toJsDate(d.dueDate || d.due_date)
    const created = toJsDate(d.createdAt || d.created_at)
    const start = toJsDate(d.startDate || d.start_date)
    return inMonth(due) || inMonth(created) || inMonth(start)
  })

  // Fallback to all deadlines if none strictly bounded to month
  const reportingDeadlines = targetDeadlines.length > 0 ? targetDeadlines : (deadlines || [])

  // Fetch extra-work logs and subtask details in parallel
  const extraWorkEntries = await Promise.all(
    reportingDeadlines.map(async (d) => {
      try {
        const { data } = await supabase
          .from('extraWork')
          .select('*')
          .eq('deadlineId', d.id)
        return [d.id, data || []]
      } catch (_) {
        return [d.id, []]
      }
    })
  )
  const extraWorkByDeadline = new Map(extraWorkEntries)

  const rows = reportingDeadlines.map(d => {
    const due = toJsDate(d.dueDate || d.due_date)
    const created = toJsDate(d.createdAt || d.created_at)
    const completed = toJsDate(d.completedAt || d.completed_at)
    const start = toJsDate(d.startDate || d.start_date)

    const assigneeEmail = (d.assigneeEmail || '').toLowerCase().trim()
    const memberObj = memberById.get(d.assigneeId) || memberByEmail.get(assigneeEmail)
    const assigneeName = d.assigneeName || memberObj?.name || memberObj?.fullName || d.assigneeEmail || 'Unassigned'
    const assigneeRole = memberObj?.role || 'member'

    const sprintObj = d.sprintId ? sprintById.get(d.sprintId) : null
    const sprintName = sprintObj ? sprintObj.name : (d.sprintName || 'Backlog / General')

    const extraLogs = extraWorkByDeadline.get(d.id) || []
    const formattedExtraWork = extraLogs
      .map(ew => `[${ew.addedAt ? new Date(ew.addedAt).toLocaleDateString() : 'Note'}] ${ew.note || ''} (by ${ew.addedByName || ew.addedBy || 'Member'})`)
      .join('; ')

    // Format checklist / subtasks
    let checklistSummary = 'None'
    if (Array.isArray(d.checklist) && d.checklist.length > 0) {
      const doneCount = d.checklist.filter(c => c.done || c.completed).length
      checklistSummary = `${doneCount}/${d.checklist.length} completed (${d.checklist.map(c => (c.done ? '✓ ' : '○ ') + c.text).join(' | ')})`
    } else if (Array.isArray(d.subtasks) && d.subtasks.length > 0) {
      const doneCount = d.subtasks.filter(c => c.done || c.completed).length
      checklistSummary = `${doneCount}/${d.subtasks.length} completed (${d.subtasks.map(c => (c.done ? '✓ ' : '○ ') + (c.title || c.text)).join(' | ')})`
    }

    // Determine overdue or turnaround status
    let turnaroundStatus = 'On Schedule'
    if (d.status === 'done' || d.status === 'completed') {
      turnaroundStatus = completed ? `Completed on ${completed.toLocaleDateString()}` : 'Completed'
    } else if (due && due < new Date()) {
      const diffDays = Math.ceil((new Date().getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
      turnaroundStatus = `Overdue by ${diffDays} day${diffDays !== 1 ? 's' : ''}`
    } else if (d.status === 'blocked') {
      turnaroundStatus = 'Blocked / Impeded'
    }

    return {
      'Task ID': d.id || '',
      'Title': d.title || 'Untitled Task',
      'Sprint / Milestone': sprintName,
      'Status': STATUS_LABEL[d.status] || d.status || 'To Do',
      'Priority': d.priority ? (d.priority[0].toUpperCase() + d.priority.slice(1)) : 'Medium',
      'Turnaround Status': turnaroundStatus,
      'Assignee Name': assigneeName,
      'Assignee Email': d.assigneeEmail || memberObj?.email || '',
      'Assignee Role': assigneeRole,
      'Start Date': start ? start.toLocaleDateString() : '',
      'Due Date': due ? due.toLocaleDateString() : '',
      'Completed Date': completed ? completed.toLocaleDateString() : '',
      'Estimated Story Points': d.storyPoints || d.points || d.estimate || '',
      'Estimated Hours': d.estimatedHours || d.hours || '',
      'Blocker Reason': d.status === 'blocked' ? (d.blockerReason || d.blocker_reason || 'Blocked') : 'None',
      'Blocker Description & Helpers': d.status === 'blocked' ? (d.blockerDescription || d.description || '') : '',
      'Checklist / Subtasks Progress': checklistSummary,
      'Extra Work & Adjustments': formattedExtraWork || 'None',
      'Task Description': d.description || '',
      'Created By': d.createdByName || d.createdBy || 'Workspace Admin',
      'Created At': created ? created.toLocaleDateString() : ''
    }
  })

  // Sort by Status -> Due Date -> Title
  rows.sort((a, b) => a['Status'].localeCompare(b['Status']) || a['Due Date'].localeCompare(b['Due Date']) || a['Title'].localeCompare(b['Title']))

  const columns = [
    'Task ID',
    'Title',
    'Sprint / Milestone',
    'Status',
    'Priority',
    'Turnaround Status',
    'Assignee Name',
    'Assignee Email',
    'Assignee Role',
    'Start Date',
    'Due Date',
    'Completed Date',
    'Estimated Story Points',
    'Estimated Hours',
    'Blocker Reason',
    'Blocker Description & Helpers',
    'Checklist / Subtasks Progress',
    'Extra Work & Adjustments',
    'Task Description',
    'Created By',
    'Created At'
  ]

  // Compute Executive Summary stats
  const totalTasks = rows.length
  const completedTasks = rows.filter(r => r['Status'] === 'Done').length
  const inProgressTasks = rows.filter(r => r['Status'] === 'In Progress' || r['Status'] === 'In Review').length
  const blockedTasks = rows.filter(r => r['Status'] === 'Blocked').length
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const monthName = monthStart.toLocaleString('default', { month: 'long' })
  const wsName = workspace?.name || 'Workspace'

  // Header Summary block
  const summaryHeader = [
    `# ==============================================================================`,
    `# SPRINTOS WORKSPACE EXECUTIVE REPORT: ${wsName.toUpperCase()}`,
    `# Reporting Period: ${monthName} ${year}`,
    `# Generated At: ${new Date().toISOString()}`,
    `# Total Tasks: ${totalTasks} | Completed: ${completedTasks} (${completionRate}%) | In Progress: ${inProgressTasks} | Blocked: ${blockedTasks}`,
    `# ==============================================================================`,
    ''
  ].join('\r\n')

  const csvBody = toCsv(rows.length ? rows : [{ 'Title': 'No tasks recorded for this period' }], columns)
  const fullContent = summaryHeader + csvBody

  const filename = `${wsName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_detailed_report_${monthName.toLowerCase()}_${year}.csv`

  // Prepend UTF-8 BOM so Excel & Sheets render unicode correctly
  const blob = new Blob(['\uFEFF' + fullContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
