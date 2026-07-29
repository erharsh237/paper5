import { collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'

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

// RFC 4180 field escaping — quote any field containing a comma, quote, or
// newline, and double up embedded quotes. Excel/Sheets both handle quoted
// multi-line cells fine.
function csvField(value) {
  const str = String(value ?? '')
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCsv(rows, columns) {
  const lines = [columns.map(csvField).join(',')]
  for (const row of rows) {
    lines.push(columns.map(col => csvField(row[col])).join(','))
  }
  // \r\n per RFC 4180 — some spreadsheet importers are picky about this.
  return lines.join('\r\n')
}

/**
 * Builds and downloads a CSV report for a given month. Includes any
 * deadline due that month, along with extra-work notes logged that month.
 */
export async function downloadMonthlyReport(deadlines, members, { year, month }) {
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 1)

  const inMonth = (d) => d && d >= monthStart && d < monthEnd

  const memberByEmail = new Map(members.map(m => [m.email?.toLowerCase(), m]))

  const dueInMonth = deadlines.filter(d => inMonth(toJsDate(d.dueDate)))

  const extraWorkEntries = await Promise.all(
    dueInMonth.map(async (d) => {
      const snap = await getDocs(collection(db, 'deadlines', d.id, 'extraWork'))
      return [d.id, snap.docs.map(doc => doc.data())]
    })
  )
  const extraWorkByDeadline = new Map(extraWorkEntries)

  const rows = dueInMonth.map(d => {
    const due = toJsDate(d.dueDate)
    const extraInMonth = (extraWorkByDeadline.get(d.id) || []).filter(ew => inMonth(coerceDate(ew.addedAt)))
    return {
      'Title': d.title,
      'Assignee': d.assigneeName || memberByEmail.get(d.assigneeEmail?.toLowerCase())?.name || d.assigneeEmail || '',
      'Status': STATUS_LABEL[d.status] || d.status,
      'Priority': d.priority ? d.priority[0].toUpperCase() + d.priority.slice(1) : '',
      'Due Date': due ? due.toLocaleDateString() : '',
      'Description': d.description || '',
      'Extra Work This Month': extraInMonth.map(ew => `- ${ew.note} (${ew.addedByName || ew.addedBy})`).join('\n'),
      'Created By': d.createdByName || d.createdBy || '',
    }
  })

  rows.sort((a, b) => a.Assignee.localeCompare(b.Assignee) || a.Title.localeCompare(b.Title))

  const columns = ['Title', 'Assignee', 'Status', 'Priority', 'Due Date', 'Description', 'Extra Work This Month', 'Created By']
  const csv = toCsv(rows.length ? rows : [{ Title: 'No deadlines this month' }], columns)

  const monthName = monthStart.toLocaleString('default', { month: 'long' })
  const filename = `deadline-report-${monthName}-${year}.csv`

  // Prepend a UTF-8 BOM so Excel (Windows) detects encoding correctly
  // instead of mangling non-ASCII names.
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
