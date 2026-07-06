import * as XLSX from 'xlsx'

const STATUS_LABEL = {
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
}

function toJsDate(dueDateIso) {
  return dueDateIso ? new Date(dueDateIso) : null
}

// Firestore Timestamp, JS Date, or ISO string -> JS Date
function coerceDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  return new Date(value)
}

/**
 * Builds and downloads an .xlsx report for a given month.
 * A deadline is included if its due date falls in the month, OR it has
 * activity (extra work notes) logged in that month — so work done ahead of
 * or around the due date isn't dropped from the report.
 */
export function downloadMonthlyReport(deadlines, members, { year, month }) {
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 1)

  const inMonth = (d) => d && d >= monthStart && d < monthEnd

  const memberByEmail = new Map(members.map(m => [m.email?.toLowerCase(), m]))

  const rows = []
  deadlines.forEach(d => {
    const due = toJsDate(d.dueDate)
    const extraInMonth = (d.extraWork || []).filter(ew => inMonth(coerceDate(ew.addedAt)))
    const dueInMonth = inMonth(due)

    if (!dueInMonth && extraInMonth.length === 0) return

    rows.push({
      'Title': d.title,
      'Assignee': d.assigneeName || memberByEmail.get(d.assigneeEmail?.toLowerCase())?.name || d.assigneeEmail || '',
      'Status': STATUS_LABEL[d.status] || d.status,
      'Priority': d.priority ? d.priority[0].toUpperCase() + d.priority.slice(1) : '',
      'Due Date': due ? due.toLocaleDateString() : '',
      'Description': d.description || '',
      'Extra Work This Month': extraInMonth.map(ew => `- ${ew.note} (${ew.addedByName || ew.addedBy})`).join('\n'),
      'Created By': d.createdByName || d.createdBy || '',
    })
  })

  rows.sort((a, b) => a.Assignee.localeCompare(b.Assignee) || a.Title.localeCompare(b.Title))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Title': 'No deadlines this month' }])
  ws['!cols'] = [
    { wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 10 },
    { wch: 14 }, { wch: 40 }, { wch: 45 }, { wch: 18 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Report')

  const monthName = monthStart.toLocaleString('default', { month: 'long' })
  const filename = `deadline-report-${monthName}-${year}.xlsx`
  XLSX.writeFile(wb, filename)
}
