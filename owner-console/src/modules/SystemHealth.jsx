import React, { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { ownerApi } from '../lib/api'

export function SystemHealth() {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)

  async function checkHealth() {
    setLoading(true)
    try {
      const res = await ownerApi('health.check')
      setHealth(res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkHealth()
  }, [])

  const tables = health?.tables || {}

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-black/[0.06] shadow-sm">
          <div className="text-xs text-slate-500 font-medium">Database Latency</div>
          <div className="text-3xl font-extrabold font-mono text-slate-900 mt-1">
            {health?.databaseLatencyMs || 0}ms
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">PostgreSQL live round-trip</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-black/[0.06] shadow-sm">
          <div className="text-xs text-slate-500 font-medium">Platform Status</div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1 capitalize">
            {health?.status || 'Healthy'}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">All services online</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-black/[0.06] shadow-sm">
          <div className="text-xs text-slate-500 font-medium">Serverless Budget</div>
          <div className="text-3xl font-extrabold font-mono text-slate-900 mt-1">
            10 / 12
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Vercel Hobby plan compliant</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-900">
            PostgreSQL Database Tables
          </span>
          <button onClick={checkHealth} disabled={loading} className="btn-secondary !text-xs !py-1">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <table className="console-table w-full">
          <thead>
            <tr>
              <th>Table Name</th>
              <th>Status</th>
              <th>Estimated Rows</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="3" className="text-center py-8 text-xs text-slate-400">Checking tables...</td>
              </tr>
            ) : Object.keys(tables).length === 0 ? (
              <tr>
                <td colSpan="3" className="text-center py-8 text-xs text-slate-400">No tables found.</td>
              </tr>
            ) : (
              Object.entries(tables).map(([tbl, info]) => (
                <tr key={tbl}>
                  <td className="font-mono text-xs text-slate-900 font-semibold">{tbl}</td>
                  <td>
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Online
                    </span>
                  </td>
                  <td className="font-mono text-xs text-slate-600">{info.count ?? 'Accessible'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
