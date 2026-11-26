import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { ownerApi } from '../lib/api'
import { useRealtimeRefresh } from '../lib/useRealtimeRefresh'

export function SupportTickets() {
  const [tickets, setTickets] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')

  const [activeTicket, setActiveTicket] = useState(null)
  const [patchStatus, setPatchStatus] = useState('open')
  const [patchPriority, setPatchPriority] = useState('normal')
  const [adminNotes, setAdminNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadTickets(silent = false) {
    if (!silent) setLoading(true)
    try {
      const res = await ownerApi('support.list', {
        params: { status: statusFilter === 'all' ? undefined : statusFilter }
      })
      setTickets(res.tickets || [])
      setTotal(res.total || 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
  }, [statusFilter])

  useRealtimeRefresh(() => {
    loadTickets(true)
  }, ['support_tickets'])

  function handleOpenTicket(t) {
    setActiveTicket(t)
    setPatchStatus(t.status || 'open')
    setPatchPriority(t.priority || 'normal')
    setAdminNotes(t.admin_notes || '')
  }

  async function saveTicket(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await ownerApi('support.update_ticket', {
        method: 'POST',
        body: {
          id: activeTicket.id,
          status: patchStatus,
          priority: patchPriority,
          adminNotes: adminNotes.trim()
        }
      })
      setActiveTicket(null)
      loadTickets()
    } catch (err) {
      alert(`Save failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-2xl border border-black/[0.06] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">
          Support <span className="text-xs font-normal text-slate-500">({total})</span>
        </h2>

        <div className="flex items-center gap-2">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="console-input text-xs w-44"
          >
            <option value="all">All Sources</option>
            <option value="workspace">Workspace Feedback</option>
            <option value="support">Support &amp; General</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="console-input text-xs w-40"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
        <table className="console-table w-full">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>User</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Submitted</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-xs text-slate-400">Loading tickets...</td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-xs text-slate-400">No tickets found.</td>
              </tr>
            ) : (
              tickets
                .filter((t) => {
                  const isWs = t.source?.startsWith('workspace') || t.source === 'feedback_modal'
                  if (sourceFilter === 'workspace') return isWs
                  if (sourceFilter === 'support') return !isWs
                  return true
                })
                .map((t) => {
                  const wsId = t.source?.startsWith('workspace:') ? t.source.slice('workspace:'.length) : null
                  return (
                <tr key={t.id}>
                  <td>
                    <div className="font-semibold text-slate-900 text-xs">#{t.ticket_number} {t.subject}</div>
                    <div className="text-[11px] text-slate-500 truncate max-w-xs">{t.message}</div>
                  </td>
                  <td>
                    <div className="text-slate-900 text-xs font-medium">{t.name || 'User'}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{t.email}</div>
                    {wsId && (
                      <div className="text-[10px] text-blue-600 font-mono mt-0.5">ws: {wsId}</div>
                    )}
                  </td>
                  <td>
                    <span className="text-xs font-mono uppercase font-semibold text-slate-700">
                      {t.priority || 'normal'}
                    </span>
                  </td>
                  <td>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium capitalize ${t.status === 'resolved' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${t.status === 'resolved' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {t.status || 'open'}
                    </span>
                  </td>
                  <td className="text-xs text-slate-500 font-mono">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => handleOpenTicket(t)}
                      className="btn-secondary !py-1 !px-2.5 !text-xs font-medium"
                    >
                      View / Update
                    </button>
                  </td>
                </tr>
                  )
                })
            )}
          </tbody>
        </table>
      </div>

      {activeTicket && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Ticket #{activeTicket.ticket_number}</h3>
              <button onClick={() => setActiveTicket(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1.5">
              <div className="font-semibold text-slate-900">{activeTicket.subject}</div>
              <div className="text-slate-500 font-mono text-[11px]">
                {activeTicket.email}{activeTicket.source?.startsWith('workspace:') ? ` · ws: ${activeTicket.source.slice('workspace:'.length)}` : ''}
              </div>
              <pre className="whitespace-pre-wrap font-sans text-slate-700 text-xs pt-1 leading-relaxed max-h-40 overflow-y-auto">{activeTicket.message}</pre>
            </div>

            <form onSubmit={saveTicket} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-600 block mb-1 font-medium">Status</label>
                <select
                  value={patchStatus}
                  onChange={(e) => setPatchStatus(e.target.value)}
                  className="console-input w-full text-xs"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-medium">Priority</label>
                <select
                  value={patchPriority}
                  onChange={(e) => setPatchPriority(e.target.value)}
                  className="console-input w-full text-xs"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-medium">Admin Notes</label>
                <textarea
                  rows="3"
                  placeholder="Internal notes..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="console-input w-full text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveTicket(null)}
                  className="btn-secondary !text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary !text-xs font-medium"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
