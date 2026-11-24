import React, { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { ownerApi } from '../lib/api'

export function AdminRbac({ currentAdmin }) {
  const [admins, setAdmins] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteModal, setInviteModal] = useState(false)
  const [searchAudit, setSearchAudit] = useState('')

  // Invite Form
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('super_admin')
  const [selectedPerms, setSelectedPerms] = useState(['overview:read', 'users:read', 'workspaces:read'])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function loadData() {
    setLoading(true)
    try {
      const [adminRes, auditRes] = await Promise.all([
        ownerApi('admins.list'),
        ownerApi('security.audit_logs', { params: { limit: 100 } })
      ])
      setAdmins(adminRes.admins || [])
      setAuditLogs(auditRes.logs || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleToggleAdmin(a) {
    if (a.role === 'owner') {
      alert('Platform Owner cannot be deactivated.')
      return
    }
    const nextStatus = !a.is_active
    try {
      await ownerApi('admins.update', {
        method: 'POST',
        body: { id: a.id, isActive: nextStatus }
      })
      loadData()
    } catch (err) {
      alert(`Update failed: ${err.message}`)
    }
  }

  async function handleInvite(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await ownerApi('admins.invite', {
        method: 'POST',
        body: {
          email: email.trim().toLowerCase(),
          role,
          permissions: role === 'owner' ? ['*'] : selectedPerms,
          notes: notes.trim()
        }
      })
      setInviteModal(false)
      setEmail('')
      setNotes('')
      loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const isOwner = currentAdmin?.role === 'owner'
  const filteredLogs = auditLogs.filter(l =>
    l.action?.toLowerCase().includes(searchAudit.toLowerCase()) ||
    l.admin_email?.toLowerCase().includes(searchAudit.toLowerCase()) ||
    l.target_id?.toLowerCase().includes(searchAudit.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Admins Table */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-900">
            Administrators ({admins.length})
          </span>
          {isOwner && (
            <button onClick={() => setInviteModal(true)} className="btn-primary !text-xs !py-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add Admin
            </button>
          )}
        </div>

        <table className="console-table w-full">
          <thead>
            <tr>
              <th>Admin</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              {isOwner && <th className="text-right">Action</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={isOwner ? 5 : 4} className="text-center py-8 text-xs text-slate-400">Loading...</td>
              </tr>
            ) : admins.length === 0 ? (
              <tr>
                <td colSpan={isOwner ? 5 : 4} className="text-center py-8 text-xs text-slate-400">No admins found.</td>
              </tr>
            ) : (
              admins.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="font-semibold text-slate-900 text-xs">{a.email}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{a.notes || a.user_id}</div>
                  </td>
                  <td>
                    <span className="text-xs font-mono uppercase font-semibold text-slate-700">
                      {a.role}
                    </span>
                  </td>
                  <td>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${a.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${a.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      {a.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="text-xs text-slate-500 font-mono">
                    {new Date(a.created_at).toLocaleDateString()}
                  </td>
                  {isOwner && (
                    <td className="text-right">
                      {a.role !== 'owner' && (
                        <button
                          onClick={() => handleToggleAdmin(a)}
                          className="btn-secondary !py-1 !px-2 !text-xs font-medium"
                        >
                          {a.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Audit Logs */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-900">
            Audit Ledger ({filteredLogs.length})
          </span>
          <input
            type="text"
            placeholder="Filter logs..."
            value={searchAudit}
            onChange={(e) => setSearchAudit(e.target.value)}
            className="console-input !py-1 !px-2 text-xs w-48"
          />
        </div>

        <table className="console-table w-full">
          <thead>
            <tr>
              <th>Admin</th>
              <th>Action</th>
              <th>Target</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4" className="text-center py-8 text-xs text-slate-400">Loading logs...</td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center py-8 text-xs text-slate-400">No events found.</td>
              </tr>
            ) : (
              filteredLogs.slice(0, 50).map((l) => (
                <tr key={l.id}>
                  <td className="text-xs text-slate-900 font-medium">{l.admin_email}</td>
                  <td>
                    <span className="font-mono text-xs text-blue-600 font-medium">{l.action}</span>
                  </td>
                  <td className="text-xs text-slate-600 font-mono">
                    {l.target_type} ({l.target_id?.slice(0, 8)}...)
                  </td>
                  <td className="text-xs text-slate-500 font-mono">
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Admin Modal */}
      {inviteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add Platform Admin</h3>
              <button onClick={() => setInviteModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-600 block mb-1 font-medium">User Email</label>
                <input
                  type="email"
                  required
                  placeholder="admin@paper5.co"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="console-input w-full text-xs"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-medium">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="console-input w-full text-xs"
                >
                  <option value="super_admin">Super Admin</option>
                  <option value="owner">Owner (Full Permissions)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-medium">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Lead Engineer, Ops"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="console-input w-full text-xs"
                />
              </div>

              {error && <div className="text-rose-600 text-xs">{error}</div>}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setInviteModal(false)}
                  className="btn-secondary !text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary !text-xs font-medium"
                >
                  {saving ? 'Adding...' : 'Add Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
