import React, { useState, useEffect } from 'react'
import { ownerApi } from '../lib/api'

export function GrowthAttribution() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadGrowth() {
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
    loadGrowth()
  }, [])

  const kpis = data?.kpis || {}

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Growth</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-lg bg-[#0D111A] border border-[#1A2233]">
          <div className="text-xs text-[#8DA0BA] font-medium">Conversion</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">{kpis.conversionRate}%</div>
          <div className="text-[11px] text-[#64748B] mt-1">Paid plans ratio</div>
        </div>

        <div className="p-4 rounded-lg bg-[#0D111A] border border-[#1A2233]">
          <div className="text-xs text-[#8DA0BA] font-medium">Paying Accounts</div>
          <div className="text-2xl font-bold text-white font-mono mt-1">{kpis.payingUsers || 0}</div>
          <div className="text-[11px] text-[#64748B] mt-1">Total paying subscribers</div>
        </div>

        <div className="p-4 rounded-lg bg-[#0D111A] border border-[#1A2233]">
          <div className="text-xs text-[#8DA0BA] font-medium">Avg Revenue Per User</div>
          <div className="text-2xl font-bold text-white font-mono mt-1">
            ${kpis.payingUsers ? Math.round((kpis.mrrEstimate || 0) / kpis.payingUsers) : 0}
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">ARPU / month</div>
        </div>
      </div>
    </div>
  )
}
