import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Search,
  RefreshCw,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Ban,
  FileText
} from 'lucide-react'
import { ownerApi } from '../lib/api'

export function WorkspaceManagement() {
  const [workspaces, setWorkspaces] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [page, setPage] = useState(0)
  const limit = 20

  // Modals state
  const [inspectWs, setInspectWs] = useState(null)
  const [activeModalTab, setActiveModalTab] = useState('overview')
  const [deleteModal, setDeleteModal] = useState(null)
  const [permSuspendModal, setPermSuspendModal] = useState(null)
  const [permSuspendReason, setPermSuspendReason] = useState('Terms of service violation')
  const [permSuspendIp, setPermSuspendIp] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [actionSuccess, setActionSuccess] = useState(null)

  // Delete Form
  const [deleteConfirmation, setDeleteConfirmation] = useState('')

  async function fetchWorkspaces() {
    setLoading(true)
    try {
      const res = await ownerApi('workspaces.list', {
        params: {
          search,
          isActive: activeFilter,
          limit,
          offset: page * limit
        }
      })
      setWorkspaces(res.workspaces || [])
      setTotal(res.total || 0)
    } catch (err) {
      console.error('Fetch workspaces error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWorkspaces()
  }, [search, activeFilter, page])

  async function handleInspect(w, initialTab = 'overview') {
    try {
      const res = await ownerApi('workspaces.get', { params: { id: w.id } })
      setInspectWs(res)
      setActiveModalTab(initialTab)
    } catch (err) {
      alert(err.message)
    }
  }

  async function submitPermanentSuspend(e) {
    e.preventDefault()
    setActionLoading(true)
    setActionError(null)

    try {
      const res = await ownerApi('workspaces.permanently_suspend', {
        method: 'POST',
        body: {
          id: permSuspendModal.id,
          reason: permSuspendReason.trim(),
          ip: permSuspendIp.trim() || undefined
        }
      })
      setActionSuccess(res.message || 'Workspace and owner permanently banned.')
      setTimeout(() => {
        setPermSuspendModal(null)
        setActionSuccess(null)
        setInspectWs(null)
        fetchWorkspaces()
      }, 1200)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleToggleStatus(w) {
    const promptMsg = w.is_active
      ? `Suspend workspace "${w.name}"? Users will be blocked from accessing boards.`
      : `Reactivate workspace "${w.name}"?`
    if (!confirm(promptMsg)) return

    try {
      await ownerApi('workspaces.toggle_status', {
        method: 'POST',
        body: { id: w.id, isActive: !w.is_active }
      })
      fetchWorkspaces()
    } catch (err) {
      alert(`Action failed: ${err.message}`)
    }
  }

  async function submitDelete(e) {
    e.preventDefault()
    if (deleteConfirmation !== deleteModal.id) {
      setActionError('Workspace ID does not match.')
      return
    }

    setActionLoading(true)
    setActionError(null)

    try {
      await ownerApi('workspaces.delete', {
        method: 'POST',
        body: {
          id: deleteModal.id,
          confirmation: deleteConfirmation,
          reason: 'Admin delete'
        }
      })
      setActionSuccess('Workspace deleted.')
      setTimeout(() => {
        setDeleteModal(null)
        setActionSuccess(null)
        fetchWorkspaces()
      }, 1000)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const totalPages = Math.ceil(total / limit) || 1

  return (
    <div className="space-y-4">
      {/* Search & Controls */}
      <div className="bg-white p-5 rounded-2xl border border-black/[0.06] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Workspaces <span className="text-xs font-normal text-slate-500">({total})</span>
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by workspace name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="console-input text-xs w-64 pr-7"
              style={{ paddingLeft: '2.25rem' }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 text-slate-400 hover:text-slate-700 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={activeFilter}
            onChange={(e) => { setActiveFilter(e.target.value); setPage(0); }}
            className="console-input text-xs"
          >
            <option value="all">All Statuses</option>
            <option value="true">Active</option>
            <option value="false">Suspended</option>
          </select>

          <button
            onClick={() => fetchWorkspaces()}
            className="btn-secondary !p-2"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Workspaces Table */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
        <table className="console-table w-full">
          <thead>
            <tr>
              <th>Workspace</th>
              <th>Plan</th>
              <th>Members</th>
              <th>Status</th>
              <th>Created</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center py-12 text-xs text-slate-400">
                  Loading workspaces...
                </td>
              </tr>
            ) : workspaces.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-12 text-xs text-slate-400">
                  No workspaces found.
                </td>
              </tr>
            ) : (
              workspaces.map((w) => {
                const rawPlan = (w.billing_plan_id || 'starter').toLowerCase()
                const plan = (['pro', 'scale', 'enterprise'].includes(rawPlan)) ? 'pro' : (['team', 'standard'].includes(rawPlan)) ? 'team' : 'starter'
                return (
                  <tr key={w.id}>
                    <td>
                      <div>
                        <span className="font-semibold text-slate-900">{w.name}</span>
                        <div className="text-xs text-slate-500 font-mono">{w.id}</div>
                      </div>
                    </td>

                    <td>
                      <span className="text-xs font-mono uppercase font-semibold text-slate-700">
                        {plan}
                      </span>
                    </td>

                    <td>
                      <span className="font-mono text-slate-900 font-semibold text-xs">{w.memberCount}</span>
                    </td>

                    <td>
                      {w.is_active ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Suspended
                        </span>
                      )}
                    </td>

                    <td className="text-xs text-slate-500 font-mono">
                      {new Date(w.created_at).toLocaleDateString()}
                    </td>

                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleInspect(w, 'overview')}
                          className="btn-secondary !py-1 !px-2.5 !text-xs font-medium"
                          title="Inspect Workspace Overview"
                        >
                          Inspect
                        </button>

                        <button
                          onClick={() => handleInspect(w, 'content')}
                          className="btn-secondary !py-1 !px-2.5 !text-xs font-medium text-blue-600 hover:text-blue-700"
                          title="Check Workspace Sprints & Tasks Content"
                        >
                          Content
                        </button>

                        <button
                          onClick={() => handleToggleStatus(w)}
                          className={`btn-secondary !py-1 !px-2 !text-xs font-medium ${w.is_active ? 'text-amber-600' : 'text-emerald-600'}`}
                        >
                          {w.is_active ? 'Suspend' : 'Reactivate'}
                        </button>

                        <button
                          onClick={() => {
                            setPermSuspendModal(w)
                            setPermSuspendReason('Terms of service violation')
                            setPermSuspendIp('')
                            setActionError(null)
                            setActionSuccess(null)
                          }}
                          className="btn-secondary !py-1 !px-2 !text-xs text-rose-600 hover:bg-rose-50 font-medium"
                          title="Permanently Suspend & Ban (IP + Email)"
                        >
                          Ban
                        </button>

                        <button
                          onClick={() => {
                            setDeleteModal(w)
                            setDeleteConfirmation('')
                          }}
                          className="btn-danger !py-1 !px-2 !text-xs"
                          title="Delete Workspace"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-mono text-slate-900 font-semibold">{workspaces.length}</span> of{' '}
            <span className="font-mono text-slate-900 font-semibold">{total}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn-secondary !py-1 !px-2 disabled:opacity-30"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-xs">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="btn-secondary !py-1 !px-2 disabled:opacity-30"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* INSPECT WORKSPACE MODAL */}
      {inspectWs && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-6 space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {inspectWs.workspace?.name}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase ${
                    inspectWs.workspace?.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {inspectWs.workspace?.is_active ? 'Active' : 'Suspended'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">{inspectWs.workspace?.id}</div>
              </div>
              <button onClick={() => setInspectWs(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs Header */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <button
                type="button"
                onClick={() => setActiveModalTab('overview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeModalTab === 'overview'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Overview & Members
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('content')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeModalTab === 'content'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FolderKanban className="w-3.5 h-3.5" />
                <span>Workspace Content</span>
                <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeModalTab === 'content' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {inspectWs.sprints?.length || 0} sp / {inspectWs.tasks?.length || inspectWs.taskCount || 0} tasks
                </span>
              </button>
            </div>

            {activeModalTab === 'overview' ? (
              <>
                {/* Workspace Core Info Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[11px] text-slate-500 font-medium mb-1">Plan Tier</div>
                    <div className="font-mono uppercase text-slate-900 font-semibold">
                      {(() => {
                        const p = (inspectWs.workspace?.billing_plan_id || 'starter').toLowerCase()
                        if (p === 'pro' || p === 'scale' || p === 'enterprise') return 'PRO'
                        if (p === 'team' || p === 'standard') return 'TEAM'
                        return 'STARTER'
                      })()}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[11px] text-slate-500 font-medium mb-1">Billing Status</div>
                    <div className="font-mono capitalize text-slate-900 font-semibold">
                      {inspectWs.workspace?.billing_status || 'free'}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[11px] text-slate-500 font-medium mb-1">Total Members</div>
                    <div className="font-mono text-slate-900 font-semibold">{inspectWs.members?.length || 0} active</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[11px] text-slate-500 font-medium mb-1">Sprints & Tasks</div>
                    <div className="font-mono text-slate-900 font-semibold">{inspectWs.sprints?.length || 0} sp / {inspectWs.tasks?.length || inspectWs.taskCount || 0} tasks</div>
                  </div>
                </div>

                {/* Owner Section */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-slate-500 font-medium">Workspace Owner</div>
                    <div className="font-bold text-slate-900 text-sm mt-0.5">
                      {inspectWs.owner?.full_name || inspectWs.owner?.email || 'Unknown Owner'}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">{inspectWs.owner?.email || inspectWs.workspace?.created_by}</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-800 uppercase">
                    Owner
                  </span>
                </div>

                {/* Workspace Members */}
                <div>
                  <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Team Members ({inspectWs.members?.length || 0})
                  </div>
                  {inspectWs.members?.length === 0 ? (
                    <div className="text-xs text-slate-500 py-3 text-center bg-slate-50 rounded-xl">No members found.</div>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {inspectWs.members?.map((m) => (
                        <div key={m.id || m.user_id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 text-xs">
                          <div>
                            <div className="text-slate-900 font-semibold">{m.users?.full_name || m.users?.email || m.user_id}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{m.users?.email}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase ${
                            m.role === 'owner' ? 'bg-amber-100 text-amber-800' :
                            m.role === 'admin' ? 'bg-indigo-100 text-indigo-800' :
                            'bg-slate-200 text-slate-700'
                          }`}>
                            {m.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pending Invitations */}
                <div>
                  <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Pending Invitations ({inspectWs.invites?.length || 0})
                  </div>
                  {inspectWs.invites?.length === 0 ? (
                    <div className="text-xs text-slate-400 py-2.5 text-center bg-slate-50 rounded-xl">No pending invites.</div>
                  ) : (
                    <div className="space-y-1.5 max-h-28 overflow-y-auto">
                      {inspectWs.invites?.map((inv) => (
                        <div key={inv.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-mono text-slate-900 font-semibold">{inv.email}</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Invited as <span className="font-medium text-slate-700 uppercase font-mono">{inv.role || 'member'}</span>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-50 text-blue-700 font-medium uppercase">
                              {inv.status || 'pending'}
                            </span>
                          </div>

                          {/* Explicit Permissions Pills */}
                          {inv.permissions && inv.permissions.length > 0 ? (
                            <div>
                              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-1">
                                Granted Permissions ({inv.permissions.length}):
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {inv.permissions.map((p) => (
                                  <span
                                    key={p}
                                    className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-800 text-[10px] font-mono font-medium shadow-2xs"
                                  >
                                    {p}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 italic">
                              Standard member permissions (collaborator access).
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* WORKSPACE CONTENT TAB: Sprints & Tasks */
              <div className="space-y-4">
                {/* Sprints Section */}
                <div>
                  <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Sprints ({inspectWs.sprints?.length || 0})</span>
                  </div>
                  {(!inspectWs.sprints || inspectWs.sprints.length === 0) ? (
                    <div className="text-xs text-slate-400 py-4 text-center bg-slate-50 rounded-xl">
                      No sprints created in this workspace yet.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {inspectWs.sprints.map((sp) => (
                        <div key={sp.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-900">{sp.name || 'Sprint'}</div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                              {sp.start_date ? new Date(sp.start_date).toLocaleDateString() : 'N/A'} - {sp.end_date ? new Date(sp.end_date).toLocaleDateString() : 'N/A'}
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase ${
                            sp.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                            sp.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                            'bg-slate-200 text-slate-700'
                          }`}>
                            {sp.status || 'planning'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tasks / Deadlines Section */}
                <div>
                  <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Tasks & Deadlines ({inspectWs.tasks?.length || 0})</span>
                  </div>
                  {(!inspectWs.tasks || inspectWs.tasks.length === 0) ? (
                    <div className="text-xs text-slate-400 py-4 text-center bg-slate-50 rounded-xl">
                      No tasks created in this workspace yet.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {inspectWs.tasks.map((t) => (
                        <div key={t.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-slate-900">{t.title}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Due: {t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No deadline'}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {t.priority && (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase ${
                                t.priority === 'high' ? 'bg-rose-100 text-rose-700' :
                                t.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {t.priority}
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-200 text-slate-700 font-semibold uppercase">
                              {t.status || 'todo'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer Controls */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setPermSuspendModal(inspectWs.workspace)
                  setPermSuspendReason('Terms of service violation')
                  setPermSuspendIp('')
                  setActionError(null)
                  setActionSuccess(null)
                }}
                className="btn-secondary !py-1.5 !px-3 !text-xs text-rose-600 hover:bg-rose-50 border-rose-200 font-semibold flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5 text-rose-600" />
                <span>Permanently Ban (IP + Email)</span>
              </button>

              <button type="button" onClick={() => setInspectWs(null)} className="btn-secondary !text-xs font-medium">
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* PERMANENT SUSPEND & BAN MODAL */}
      {permSuspendModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-rose-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900">Permanent Suspension & Ban</h3>
              </div>
              <button onClick={() => setPermSuspendModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-800 space-y-1">
              <div className="font-semibold text-rose-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>Zero-Tolerance Security Action</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Permanently suspends workspace <strong>{permSuspendModal.name}</strong>, revokes all active sessions, and blacklists the owner's <strong>Email</strong> and <strong>IP address</strong> across all platform routes. The user will be blocked from re-registering or accessing Paper5.
              </p>
            </div>

            <form onSubmit={submitPermanentSuspend} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-600 block mb-1 font-medium">Target Workspace</label>
                <input
                  type="text"
                  disabled
                  value={`${permSuspendModal.name} (${permSuspendModal.id})`}
                  className="console-input w-full bg-slate-100 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-medium">Suspension Reason</label>
                <input
                  type="text"
                  required
                  value={permSuspendReason}
                  onChange={(e) => setPermSuspendReason(e.target.value)}
                  placeholder="e.g. Terms of service violation, fraud"
                  className="console-input w-full"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-medium">Target IP Address (Optional - auto-detected if empty)</label>
                <input
                  type="text"
                  value={permSuspendIp}
                  onChange={(e) => setPermSuspendIp(e.target.value)}
                  placeholder="Leave blank to ban last known IP automatically"
                  className="console-input w-full font-mono text-[11px]"
                />
              </div>

              {actionError && <div className="text-rose-600 text-xs font-medium">{actionError}</div>}
              {actionSuccess && <div className="text-emerald-600 text-xs font-medium">{actionSuccess}</div>}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPermSuspendModal(null)}
                  className="btn-secondary !text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-danger !text-xs font-medium flex items-center gap-1.5"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>{actionLoading ? 'Banning...' : 'Confirm Permanent Ban'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* DELETE MODAL */}
      {deleteModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-rose-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3">
              <h3 className="text-sm font-bold text-rose-600">Delete Workspace</h3>
              <button onClick={() => setDeleteModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitDelete} className="space-y-3.5 text-xs">
              <p className="text-slate-600">
                Are you sure you want to permanently delete <strong className="text-slate-900">{deleteModal.name}</strong> and all its tasks, sprints, and members?
              </p>
              <div>
                <label className="text-slate-600 block mb-1">
                  Type <span className="font-mono text-slate-900 font-bold select-all">{deleteModal.id}</span> to confirm:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Paste workspace ID here"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className="console-input w-full font-mono text-xs"
                />
              </div>

              {actionError && <div className="text-rose-600 text-xs">{actionError}</div>}
              {actionSuccess && <div className="text-emerald-600 text-xs">{actionSuccess}</div>}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteModal(null)}
                  className="btn-secondary !text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || deleteConfirmation !== deleteModal.id}
                  className="btn-danger !text-xs font-medium"
                >
                  {actionLoading ? 'Deleting...' : 'Delete Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
