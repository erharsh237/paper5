import React, { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle } from 'lucide-react'
import { ownerApi } from '../lib/api'

export function SecurityOperations() {
  const [rateLimits, setRateLimits] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [unblockingIp, setUnblockingIp] = useState(null)
  const [actionSuccess, setActionSuccess] = useState(null)

  async function loadSecurityData() {
    setLoading(true)
    try {
      const [rRes, aRes] = await Promise.all([
        ownerApi('security.rate_limits'),
        ownerApi('security.audit_logs', { params: { limit: 50 } })
      ])
      setRateLimits(rRes.rateLimits || [])
      setAuditLogs(aRes.logs || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSecurityData()
  }, [])

  async function handleUnblock(ip) {
    if (!confirm(`Unblock IP ${ip}?`)) return
    setUnblockingIp(ip)
    try {
      await ownerApi('security.unblock_ip', {
        method: 'POST',
        body: { ip }
      })
      setActionSuccess(`IP ${ip} unblocked.`)
      setTimeout(() => setActionSuccess(null), 3000)
      loadSecurityData()
    } catch (err) {
      alert(`Unblock failed: ${err.message}`)
    } finally {
      setUnblockingIp(null)
    }
  }

  return (
    <div className="space-y-6">
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Rate Limits */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-900">
            Rate-Limited IPs ({rateLimits.length})
          </span>
          <button onClick={loadSecurityData} className="btn-secondary !text-xs !py-1">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <table className="console-table w-full">
          <thead>
            <tr>
              <th>IP Address</th>
              <th>Endpoint</th>
              <th>Requests</th>
              <th>Window Start</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="text-center py-8 text-xs text-slate-400">Loading...</td>
              </tr>
            ) : rateLimits.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-8 text-xs text-slate-400">No throttled IP addresses.</td>
              </tr>
            ) : (
              rateLimits.map((r, i) => (
                <tr key={i}>
                  <td className="font-mono text-xs text-slate-900 font-semibold">{r.ip}</td>
                  <td className="font-mono text-xs text-slate-600">{r.endpoint}</td>
                  <td className="font-mono text-xs text-slate-900">{r.count}</td>
                  <td className="text-xs text-slate-500 font-mono">{new Date(r.window_start).toLocaleTimeString()}</td>
                  <td className="text-right">
                    <button
                      onClick={() => handleUnblock(r.ip)}
                      disabled={unblockingIp === r.ip}
                      className="btn-secondary !py-1 !px-2 !text-xs font-medium text-blue-600"
                    >
                      {unblockingIp === r.ip ? 'Unblocking...' : 'Unblock'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Audit Logs */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <span className="text-sm font-bold text-slate-900">
            Recent Audit Trail ({auditLogs.length})
          </span>
        </div>

        <table className="console-table w-full">
          <thead>
            <tr>
              <th>Admin</th>
              <th>Action</th>
              <th>Target</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4" className="text-center py-8 text-xs text-slate-400">Loading...</td>
              </tr>
            ) : auditLogs.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center py-8 text-xs text-slate-400">No audit events found.</td>
              </tr>
            ) : (
              auditLogs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <div className="text-slate-900 text-xs font-semibold">{log.admin_email}</div>
                    <div className="text-[11px] text-slate-500 font-mono capitalize">{log.admin_role}</div>
                  </td>
                  <td>
                    <span className="font-mono text-xs text-blue-600 font-medium">{log.action}</span>
                  </td>
                  <td>
                    <span className="text-xs text-slate-600">{log.target_type} ({log.target_id?.slice(0, 8)}...)</span>
                  </td>
                  <td className="text-xs text-slate-500 font-mono">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
