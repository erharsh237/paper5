import React, { useState, useEffect } from 'react'
import { ownerApi } from '../lib/api'

export function ProductAnalytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadMetrics() {
    setLoading(true)
    try {
      const res = await ownerApi('overview')
      setData(res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMetrics()
  }, [])

  const kpis = data?.kpis || {}

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Analytics</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-lg bg-[#0D111A] border border-[#1A2233]">
          <div className="text-xs text-[#8DA0BA] font-medium">Total Tasks</div>
          <div className="text-2xl font-bold text-white font-mono mt-1">{kpis.totalTasks || 0}</div>
          <div className="text-[11px] text-[#64748B] mt-1">Across all workspaces</div>
        </div>

        <div className="p-4 rounded-lg bg-[#0D111A] border border-[#1A2233]">
          <div className="text-xs text-[#8DA0BA] font-medium">Total Sprints</div>
          <div className="text-2xl font-bold text-white font-mono mt-1">{kpis.totalSprints || 0}</div>
          <div className="text-[11px] text-[#64748B] mt-1">Managed sprints</div>
        </div>

        <div className="p-4 rounded-lg bg-[#0D111A] border border-[#1A2233]">
          <div className="text-xs text-[#8DA0BA] font-medium">Conversion Rate</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">{kpis.conversionRate}%</div>
          <div className="text-[11px] text-[#64748B] mt-1">Free to paid</div>
        </div>
      </div>
    </div>
  )
}
