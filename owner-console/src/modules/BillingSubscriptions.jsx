import React, { useState, useEffect } from 'react'
import { ownerApi } from '../lib/api'

export function BillingSubscriptions() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadBilling() {
    setLoading(true)
    try {
      const res = await ownerApi('billing.overview')
      setData(res)
    } catch (err) {
      console.error('Billing error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBilling()
  }, [])

  const summary = data?.summary || {}
  const subscribers = data?.subscribers || []

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-black/[0.06] shadow-sm">
          <div className="text-xs text-slate-500 font-medium">Monthly Revenue</div>
          <div className="text-3xl font-extrabold text-slate-900 font-mono mt-1">${summary.mrr?.toLocaleString() || 0}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Active MRR</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-black/[0.06] shadow-sm">
          <div className="text-xs text-slate-500 font-medium">Annual Run Rate</div>
          <div className="text-3xl font-extrabold text-slate-900 font-mono mt-1">${summary.arr?.toLocaleString() || 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">12-month ARR</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-black/[0.06] shadow-sm">
          <div className="text-xs text-slate-500 font-medium">Paid Subscribers</div>
          <div className="text-3xl font-extrabold text-slate-900 font-mono mt-1">{summary.totalPaid || 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">Team: {summary.team || 0} • Pro: {summary.pro || 0}</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-black/[0.06] shadow-sm">
          <div className="text-xs text-slate-500 font-medium">Gateway</div>
          <div className="text-xl font-bold text-slate-900 mt-1">Razorpay</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Connected & live</div>
        </div>
      </div>

      {/* Subscribers Table */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-900">Subscribers</span>
          <span className="text-xs text-slate-500 font-mono">{subscribers.length} total</span>
        </div>

        <table className="console-table w-full">
          <thead>
            <tr>
              <th>Subscriber</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Enrolled</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4" className="text-center py-12 text-xs text-slate-400">Loading subscribers...</td>
              </tr>
            ) : subscribers.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center py-12 text-xs text-slate-400">No active paid subscribers.</td>
              </tr>
            ) : (
              subscribers.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="font-semibold text-slate-900">{s.email}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{s.id}</div>
                  </td>
                  <td>
                    <span className="text-xs font-mono uppercase font-semibold text-slate-700">
                      {s.billing_plan_id}
                    </span>
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  </td>
                  <td className="text-xs text-slate-500 font-mono">
                    {new Date(s.created_at).toLocaleDateString()}
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
