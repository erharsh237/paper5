import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Search,
  RefreshCw,
  Sliders,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  Ban
} from 'lucide-react'
import { ownerApi } from '../lib/api'
import { useRealtimeRefresh } from '../lib/useRealtimeRefresh'

export function UserManagement() {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [page, setPage] = useState(0)
  const limit = 20

  // Modals state
  const [inspectUser, setInspectUser] = useState(null)
  const [overrideModal, setOverrideModal] = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)
  const [permSuspendModal, setPermSuspendModal] = useState(null)
  const [permSuspendReason, setPermSuspendReason] = useState('Terms of service violation')
  const [permSuspendIp, setPermSuspendIp] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [actionSuccess, setActionSuccess] = useState(null)

  // Override Form
  const [overridePlan, setOverridePlan] = useState('team')
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideExpiry, setOverrideExpiry] = useState('')

  // Delete Form
  const [deleteConfirmation, setDeleteConfirmation] = useState('')

  async function fetchUsers(silent = false) {
    if (!silent) setLoading(true)
    try {
      const res = await ownerApi('users.list', {
        params: {
          search,
          tier: tierFilter,
          limit,
          offset: page * limit
        }
      })
      setUsers(res.users || [])
      setTotal(res.total || 0)
    } catch (err) {
      console.error('Fetch users error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [search, tierFilter, page])

  useRealtimeRefresh(() => {
    fetchUsers(true)
  }, ['users', 'user_entitlement_overrides'])

  async function handleInspect(u) {
    try {
      const res = await ownerApi('users.get', { params: { id: u.id } })
      setInspectUser(res)
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleToggleSuspend(u) {
    const isSuspended = u.account_status === 'suspended'
    const promptMsg = isSuspended
      ? `Reactivate account for ${u.email}?`
      : `Reason for suspending ${u.email}:`
    const reason = prompt(promptMsg, isSuspended ? 'Admin reactivation' : 'Terms violation')
    if (!reason) return

    try {
      await ownerApi('users.suspend', {
        method: 'POST',
        body: { id: u.id, suspend: !isSuspended, reason }
      })
      fetchUsers()
    } catch (err) {
      alert(`Action failed: ${err.message}`)
    }
  }

  async function submitPermanentSuspendUser(e) {
    e.preventDefault()
    setActionLoading(true)
    setActionError(null)

    try {
      const res = await ownerApi('users.permanently_suspend', {
        method: 'POST',
        body: {
          id: permSuspendModal.id,
          reason: permSuspendReason.trim(),
          ip: permSuspendIp.trim() || undefined
        }
      })
      setActionSuccess(res.message || 'Account and IP permanently banned.')
      setTimeout(() => {
        setPermSuspendModal(null)
        setActionSuccess(null)
        setInspectUser(null)
        fetchUsers()
      }, 1200)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function submitOverride(e) {
    e.preventDefault()
    if (!overrideReason.trim()) return
    setActionLoading(true)
    setActionError(null)

    try {
      await ownerApi('users.override_plan', {
        method: 'POST',
        body: {
          userId: overrideModal.id,
          plan: overridePlan,
          reason: overrideReason.trim(),
          expiresAt: overrideExpiry ? new Date(overrideExpiry).toISOString() : null
        }
      })
      setActionSuccess('Plan updated successfully.')
      setTimeout(() => {
        setOverrideModal(null)
        setActionSuccess(null)
        fetchUsers()
      }, 1000)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function submitDelete(e) {
    e.preventDefault()
    if (deleteConfirmation !== deleteModal.id) {
      setActionError('User ID does not match.')
      return
    }

    setActionLoading(true)
    setActionError(null)

    try {
      await ownerApi('users.delete', {
        method: 'POST',
        body: {
          id: deleteModal.id,
          confirmation: deleteConfirmation,
          reason: 'Admin delete'
        }
      })
      setActionSuccess('User deleted.')
      setTimeout(() => {
        setDeleteModal(null)
        setActionSuccess(null)
        fetchUsers()
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
      {/* Search & Filter Controls */}
      <div className="bg-white p-5 rounded-2xl border border-black/[0.06] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Users <span className="text-xs font-normal text-slate-500">({total})</span>
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by email or name..."
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

          {/* Tier Filter */}
          <select
            value={tierFilter}
            onChange={(e) => { setTierFilter(e.target.value); setPage(0); }}
            className="console-input text-xs"
          >
            <option value="all">All Plans</option>
            <option value="starter">Starter</option>
            <option value="team">Team</option>
            <option value="pro">Pro</option>
          </select>

          <button
            onClick={() => fetchUsers()}
            className="btn-secondary !p-2"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
        <table className="console-table w-full">
          <thead>
            <tr>
              <th>User</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Source</th>
              <th>Joined</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center py-12 text-xs text-slate-400">
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-12 text-xs text-slate-400">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const plan = (u.effectivePlan || 'starter').toLowerCase()
                const isSuspended = u.account_status === 'suspended'
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center text-xs font-semibold text-slate-700 shrink-0">
                          {u.email?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <span>{u.full_name || u.name || u.email?.split('@')[0] || 'User'}</span>
                            {u.hasOverride && (
                              <span className="text-[10px] text-amber-600 font-mono font-medium">(Override)</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="text-xs font-mono uppercase font-semibold text-slate-700">
                        {plan}
                      </span>
                    </td>

                    <td>
                      {isSuspended ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      )}
                    </td>

                    <td>
                      <span
                        title={u.sourceDetails ? `Medium: ${u.sourceDetails.medium}${u.sourceDetails.campaign ? ` | Campaign: ${u.sourceDetails.campaign}` : ''}${u.sourceDetails.referrer ? ` | Referrer: ${u.sourceDetails.referrer}` : ''}` : 'No recorded attribution'}
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono ${
                          u.source && u.source !== 'direct'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200/70 font-semibold'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {u.source || '—'}
                      </span>
                    </td>

                    <td className="text-xs text-slate-500 font-mono">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>

                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleInspect(u)}
                          className="btn-secondary !py-1 !px-2.5 !text-xs font-medium"
                        >
                          Inspect
                        </button>

                        <button
                          onClick={() => {
                            setOverrideModal(u)
                            setOverridePlan(u.effectivePlan || 'team')
                            setOverrideReason('')
                          }}
                          className="btn-secondary !py-1 !px-2 !text-xs text-amber-600 font-medium"
                          title="Override Plan"
                        >
                          Plan
                        </button>

                        <button
                          onClick={() => handleToggleSuspend(u)}
                          className={`btn-secondary !py-1 !px-2 !text-xs font-medium ${isSuspended ? 'text-emerald-600' : 'text-rose-600'}`}
                        >
                          {isSuspended ? 'Reactivate' : 'Suspend'}
                        </button>

                        <button
                          onClick={() => {
                            setPermSuspendModal(u)
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
                            setDeleteModal(u)
                            setDeleteConfirmation('')
                          }}
                          className="btn-danger !py-1 !px-2 !text-xs"
                          title="Delete User"
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
            Showing <span className="font-mono text-slate-900 font-semibold">{users.length}</span> of{' '}
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

      {/* INSPECT USER MODAL */}
      {inspectUser && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-6 space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {inspectUser.user?.full_name || inspectUser.user?.username || 'User Details'}
                  </h3>
                  {inspectUser.platformAdmin ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-900 text-white uppercase">
                      {inspectUser.platformAdmin.role === 'owner' ? 'Platform Owner' : 'Super Admin'}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-500 bg-slate-100 uppercase">
                      Standard User
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">{inspectUser.user?.email}</div>
              </div>
              <button onClick={() => setInspectUser(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] text-slate-500 font-medium mb-1">Platform Role</div>
                <div className="font-mono text-slate-900 font-semibold capitalize">
                  {inspectUser.platformAdmin?.role || 'Normal User'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] text-slate-500 font-medium mb-1">Account Plan</div>
                <div className="font-mono uppercase text-slate-900 font-semibold">
                  {(() => {
                    const p = (inspectUser.effectivePlan || inspectUser.user?.billing_plan_id || 'starter').toLowerCase()
                    if (p === 'pro' || p === 'scale' || p === 'enterprise') return 'PRO'
                    if (p === 'team' || p === 'standard') return 'TEAM'
                    return 'STARTER'
                  })()}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] text-slate-500 font-medium mb-1">Account Status</div>
                <div className="font-mono capitalize text-slate-900 font-semibold">{inspectUser.user?.billing_status || 'active'}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] text-slate-500 font-medium mb-1">Created</div>
                <div className="font-mono text-slate-900 text-[11px] font-medium">{new Date(inspectUser.user?.created_at).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Subscription, Billing Cycle, Expiration & Invoices */}
            {(() => {
              const bd = inspectUser.billingDetails || {}
              const intervalLabel = bd.interval === 'annual' || bd.interval === 'yearly'
                ? 'Annual'
                : bd.interval === 'monthly'
                  ? 'Monthly'
                  : 'Free (No Cycle)'
              const expiryLabel = bd.expiresAt
                ? new Date(bd.expiresAt).toLocaleDateString()
                : (inspectUser.effectivePlan === 'starter' ? 'No Expiry (Free)' : 'Not Set')
              return (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2.5 text-xs">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Subscription &amp; Billing
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <div className="text-[10px] text-slate-400">Billing Cycle</div>
                      <div className="font-mono font-semibold text-slate-900 mt-0.5">{intervalLabel}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Started</div>
                      <div className="font-mono font-semibold text-slate-900 mt-0.5">
                        {bd.startedAt ? new Date(bd.startedAt).toLocaleDateString() : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Expiration / Renewal</div>
                      <div className="font-mono font-semibold text-slate-900 mt-0.5">{expiryLabel}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Subscription / Invoice</div>
                      <div className="font-mono text-slate-700 mt-0.5 truncate" title={bd.subscriptionId || 'None'}>
                        {bd.subscriptionId || 'None'}
                      </div>
                    </div>
                  </div>
                  {bd.invoices && bd.invoices.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/70 space-y-1">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Invoices</div>
                      {bd.invoices.map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-slate-700">
                            {inv.id} · {inv.amount} {inv.currency} ({inv.status})
                          </span>
                          {inv.url && (
                            <a href={inv.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                              View Invoice
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Active Plan Overrides */}
            {inspectUser.activeOverride && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                <div className="font-bold text-amber-900">Active Admin Plan Override</div>
                <div className="text-amber-800 mt-0.5">
                  Plan elevated to <strong className="uppercase">{inspectUser.activeOverride.tier}</strong>. Reason: {inspectUser.activeOverride.reason || 'Manual override'}.
                  {inspectUser.activeOverride.expires_at ? ` Expires: ${new Date(inspectUser.activeOverride.expires_at).toLocaleDateString()}` : ' Permanent override.'}
                </div>
              </div>
            )}

            {/* Assigned Workspaces & Roles */}
            <div>
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Workspace Memberships & Permissions ({inspectUser.workspaces?.length || 0})
              </div>
              {inspectUser.workspaces?.length === 0 ? (
                <div className="text-xs text-slate-500 py-3 text-center bg-slate-50 rounded-xl">No workspace memberships found.</div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {inspectUser.workspaces?.map((w) => (
                    <div key={w.workspace_id || w.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{w.workspaces?.name || w.name || 'Workspace'}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          ID: {w.workspace_id || w.id}
                        </div>
                        {w.joined_at && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Joined: {new Date(w.joined_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold uppercase ${
                          w.role === 'owner' ? 'bg-amber-100 text-amber-800' :
                          w.role === 'admin' ? 'bg-indigo-100 text-indigo-800' :
                          'bg-slate-200/80 text-slate-700'
                        }`}>
                          {w.role || 'member'}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {w.role === 'owner' ? 'Full Control' : w.role === 'admin' ? 'Admin Permissions' : 'Standard Member'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Invited Team Members */}
            {inspectUser.invites && inspectUser.invites.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Invited Team Members ({inspectUser.invites.length})
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {inspectUser.invites.map((inv) => (
                    <div key={inv.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-mono text-slate-900 font-semibold">{inv.email}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Invited role: <span className="uppercase font-mono font-medium text-slate-700">{inv.role || 'member'}</span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 uppercase">
                          Invited Member
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
              </div>
            )}

            {inspectUser.sourceDetails && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-500 font-medium">Acquisition Source</span>
                <span className="font-mono text-slate-900 font-semibold">
                  {inspectUser.sourceDetails.source}
                  {inspectUser.sourceDetails.medium && inspectUser.sourceDetails.medium !== 'none' ? ` / ${inspectUser.sourceDetails.medium}` : ''}
                  {inspectUser.sourceDetails.campaign ? ` (${inspectUser.sourceDetails.campaign})` : ''}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setPermSuspendModal(inspectUser.user)
                  setPermSuspendReason('Terms of service violation')
                  setPermSuspendIp(inspectUser.lastKnownIp || '')
                  setActionError(null)
                  setActionSuccess(null)
                }}
                className="btn-secondary !py-1.5 !px-3 !text-xs text-rose-600 hover:bg-rose-50 border-rose-200 font-semibold flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5 text-rose-600" />
                <span>Permanently Ban (IP + Email)</span>
              </button>

              <button type="button" onClick={() => setInspectUser(null)} className="btn-secondary !text-xs font-medium">
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* OVERRIDE PLAN MODAL */}
      {overrideModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Override Plan</h3>
              <button onClick={() => setOverrideModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitOverride} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-600 block mb-1 font-medium">User</label>
                <input
                  type="text"
                  disabled
                  value={overrideModal.email}
                  className="console-input w-full bg-slate-100 opacity-80 text-xs"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-medium">Select Plan</label>
                <select
                  value={overridePlan}
                  onChange={(e) => setOverridePlan(e.target.value)}
                  className="console-input w-full text-xs"
                >
                  <option value="starter">Starter (Free)</option>
                  <option value="team">Team ($29/mo)</option>
                  <option value="pro">Pro ($79/mo)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-medium">Reason</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP client, promotion, beta tester"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="console-input w-full text-xs"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-medium">Expires (Optional)</label>
                <input
                  type="date"
                  value={overrideExpiry}
                  onChange={(e) => setOverrideExpiry(e.target.value)}
                  className="console-input w-full text-xs"
                />
              </div>

              {actionError && <div className="text-rose-600 text-xs">{actionError}</div>}
              {actionSuccess && <div className="text-emerald-600 text-xs">{actionSuccess}</div>}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOverrideModal(null)}
                  className="btn-secondary !text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-primary !text-xs font-medium"
                >
                  {actionLoading ? 'Saving...' : 'Save Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* PERMANENT SUSPEND & BAN USER MODAL */}
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
                <span>Zero-Tolerance Security Enforcement</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Permanently suspends account <strong>{permSuspendModal.email}</strong>, all owned workspaces, revokes active sessions, and blacklists the user's <strong>Email</strong> and <strong>IP address</strong> across all platform routes.
              </p>
            </div>

            <form onSubmit={submitPermanentSuspendUser} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-600 block mb-1 font-medium">Target User</label>
                <input
                  type="text"
                  disabled
                  value={`${permSuspendModal.email} (${permSuspendModal.id})`}
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
                  placeholder="e.g. Fraud, terms of service violation"
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
              <h3 className="text-sm font-bold text-rose-600">Delete User</h3>
              <button onClick={() => setDeleteModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitDelete} className="space-y-3.5 text-xs">
              <p className="text-slate-600">
                Are you sure you want to permanently delete <strong className="text-slate-900">{deleteModal.email}</strong>?
              </p>
              <div>
                <label className="text-slate-600 block mb-1">
                  Type <span className="font-mono text-slate-900 font-bold select-all">{deleteModal.id}</span> to confirm:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Paste user ID here"
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
                  {actionLoading ? 'Deleting...' : 'Delete User'}
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
