import React, { useState, useEffect } from 'react'
import {
  Users,
  Briefcase,
  DollarSign,
  TrendingUp,
  Activity,
  Layers,
  ArrowRight,
  Shield,
  LifeBuoy,
  RefreshCw,
  CheckCircle2,
  Clock
} from 'lucide-react'
import { ownerApi } from '../lib/api'

export function CommandCenter({ onNavigate }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const res = await ownerApi('overview')
      setData(res)
    } catch (err) {
      console.error('Command center fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading && !data) {
    return (
      <div className="py-20 flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <RefreshCw className="w-4 h-4 animate-spin text-slate-900" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
        <span>Error loading overview: {error}</span>
        <button onClick={loadData} className="btn-secondary !text-xs !py-1">Retry</button>
      </div>
    )
  }

  const kpis = data?.kpis || {}
  const tiers = data?.tierDistribution || {}
  const stats = data?.tableStats || {}
  const recentUsers = data?.recentUsers || []
  const recentWorkspaces = data?.recentWorkspaces || []

  const totalTierUsers = (tiers.starter || 0) + (tiers.team || 0) + (tiers.pro || 0) || 1
  const starterPct = Math.round(((tiers.starter || 0) / totalTierUsers) * 100)
  const teamPct = Math.round(((tiers.team || 0) / totalTierUsers) * 100)
  const proPct = Math.round(((tiers.pro || 0) / totalTierUsers) * 100)

  // Mock bar heights for the "Activity Overnight" chart seen in the screenshot
  const activityBars = [
    { label: '09', total: 6, blue: 4, purple: 2 },
    { label: '11', total: 10, blue: 6, purple: 4 },
    { label: '13', total: 7, blue: 5, purple: 2 },
    { label: '15', total: 12, blue: 8, purple: 4 },
    { label: '17', total: 5, blue: 3, purple: 2 },
    { label: '19', total: 9, blue: 6, purple: 3 },
    { label: '21', total: 11, blue: 7, purple: 4 },
    { label: '23', total: 8, blue: 5, purple: 3 }
  ]

  return (
    <div className="space-y-6">
      {/* =========================================================================
          TOP BENTO ROW: Dark Hero Card (Left 60%) + "Waiting for you" Card (Right 40%)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* LEFT: Dark Hero Focal Card */}
        <div className="lg:col-span-7 bg-[#0D111A] text-white p-6 sm:p-7 rounded-2xl border border-white/[0.08] shadow-sm flex flex-col justify-between relative overflow-hidden">
          {/* Subtle radial ambient background glow */}
          <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold mb-2">
              Platform Health • Realtime
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white max-w-sm">
              {kpis.activeWorkspaces} active workspaces running today
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-md">
              PostgreSQL cluster operational. {kpis.payingUsers} paying tenant seats with active billing subscriptions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end mt-8 pt-6 border-t border-white/[0.08]">
            {/* Big Stat */}
            <div className="sm:col-span-5">
              <div className="text-4xl font-extrabold tracking-tight font-mono text-white">
                ${kpis.mrrEstimate?.toLocaleString() || 0}
              </div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-mono text-emerald-400 mt-2">
                <span>ARR: ${kpis.arrEstimate?.toLocaleString() || 0}</span>
              </div>
            </div>

            {/* Circular Orbit / Radar Graphic (Mirroring the screenshot) */}
            <div className="sm:col-span-7 flex items-center justify-end">
              <div className="relative w-36 h-36 flex items-center justify-center">
                {/* Concentric rings */}
                <div className="absolute inset-0 rounded-full border border-dashed border-white/10" />
                <div className="absolute inset-4 rounded-full border border-white/15" />
                <div className="absolute inset-8 rounded-full border border-white/20" />
                
                {/* Orbiting nodes */}
                <div className="absolute top-2 left-6 w-2.5 h-2.5 rounded-full bg-blue-400 shadow-sm shadow-blue-400/50" />
                <div className="absolute bottom-4 right-6 w-2 h-2 rounded-full bg-emerald-400" />
                <div className="absolute top-8 right-2 w-2 h-2 rounded-full bg-purple-400" />
                <div className="absolute bottom-6 left-4 w-1.5 h-1.5 rounded-full bg-amber-400" />

                {/* Central Core */}
                <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm flex flex-col items-center justify-center">
                  <span className="text-[11px] font-bold font-mono text-white">{stats.users || 1}</span>
                  <span className="text-[8px] text-slate-400 font-mono">USERS</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: "Waiting for you" Card (Mirroring the right column in screenshot) */}
        <div className="lg:col-span-5 bg-white p-6 sm:p-7 rounded-2xl border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Waiting for you</h3>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-full text-[11px]">
                <span className="px-2.5 py-0.5 rounded-full bg-white text-slate-900 font-semibold shadow-2xs">
                  Review
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-slate-500">
                  Tickets
                </span>
              </div>
            </div>

            {/* Featured Pending Action Dossier (Mirroring Close T-0512 for Acme AI) */}
            <div className="mt-4 p-4 rounded-xl bg-slate-50/80 border border-slate-200/60 space-y-3">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">Account Review</span>
                <span className="font-mono text-slate-400">Today</span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {recentUsers[0]?.email ? `Inspect user: ${recentUsers[0].email}` : 'Review pending tenant operations'}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify platform entitlement overrides and tenant workspace assignments.
                </p>
              </div>

              {/* Progress Milestones (Signal -> Analysis -> Review) */}
              <div className="pt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span className="text-emerald-600 font-medium">Auth Verified</span>
                <span className="w-8 h-px bg-slate-300" />
                <span className="text-blue-600 font-medium">Workspace Active</span>
                <span className="w-8 h-px bg-slate-300" />
                <span className="text-slate-600 font-medium">Tiers Synced</span>
              </div>

              {/* Quick Actions */}
              <div className="pt-1 flex items-center gap-2">
                <button
                  onClick={() => onNavigate('users')}
                  className="btn-primary !rounded-lg !py-1.5 !px-3 !text-xs font-medium"
                >
                  Inspect User
                </button>
                <button
                  onClick={() => onNavigate('workspaces')}
                  className="btn-secondary !rounded-lg !py-1.5 !px-3 !text-xs font-medium"
                >
                  Workspaces
                </button>
              </div>
            </div>

            {/* Micro List Item */}
            <div className="mt-3 flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onNavigate('support')}>
              <div className="flex items-center gap-2.5 text-xs text-slate-700">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Support ticket queue ({kpis.openTickets} open)</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>

          {/* Bottom Summary Stats (Mirroring "Median time 3h 40min" and "Approved 93%") */}
          <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] text-slate-500 font-medium">CONVERSION RATE</div>
              <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                {kpis.conversionRate}%
              </div>
              <div className="text-[10px] text-slate-400 font-mono">Paid customer tier</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">PAYING TENANTS</div>
              <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                {kpis.payingUsers}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">Team & Pro seats</div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          BOTTOM BENTO ROW: Activity Bar Chart (Left) + Plan Health / Database (Right)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* BOTTOM LEFT: Activity Throughput Bar Chart (Mirroring "Agents overnight" in screenshot) */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-7 rounded-2xl border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Activity throughput</h3>
                <p className="text-xs text-slate-500 mt-0.5">Sprint tasks and tenant operations executed</p>
              </div>
              <span className="text-xs font-mono font-semibold text-slate-700">
                {kpis.totalTasks} total tasks
              </span>
            </div>

            {/* Stylized Vertical Bar Chart (Replicating the look of the screenshot) */}
            <div className="pt-6 pb-2">
              <div className="h-36 flex items-end justify-between gap-3 px-2">
                {activityBars.map((bar, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                    <div className="w-5 rounded-full overflow-hidden bg-slate-100 flex flex-col justify-end transition-all group-hover:scale-105" style={{ height: `${bar.total * 8}px` }}>
                      <div className="w-full bg-blue-600 rounded-t-full" style={{ height: `${bar.blue * 7}px` }} />
                      <div className="w-full bg-purple-500" style={{ height: `${bar.purple * 5}px` }} />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 mt-1">{bar.label}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center gap-6 pt-4 text-[11px] text-slate-500 border-t border-slate-100">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  Sprints ({kpis.totalSprints})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  Tasks ({kpis.totalTasks})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM RIGHT: Plan Health & Database Inventory (Mirroring "Evidence health") */}
        <div className="lg:col-span-5 bg-white p-6 sm:p-7 rounded-2xl border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Plan tiers & database</h3>
                <p className="text-xs text-slate-500 mt-0.5">Subscription mix across registered users</p>
              </div>
              <span className="text-xs font-mono font-semibold text-emerald-600">
                ${kpis.mrrEstimate}/mo
              </span>
            </div>

            {/* Multi-segmented Progress Bar */}
            <div className="pt-4 space-y-2">
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                <div style={{ width: `${starterPct}%` }} className="bg-slate-400 h-full" />
                <div style={{ width: `${teamPct}%` }} className="bg-blue-600 h-full" />
                <div style={{ width: `${proPct}%` }} className="bg-purple-600 h-full" />
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 text-xs">
                  <span className="flex items-center gap-2 text-slate-700">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    Starter (Free)
                  </span>
                  <span className="font-mono font-semibold text-slate-900">{tiers.starter || 0}</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 text-xs">
                  <span className="flex items-center gap-2 text-slate-700">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    Team ($29/mo)
                  </span>
                  <span className="font-mono font-semibold text-slate-900">{tiers.team || 0}</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 text-xs">
                  <span className="flex items-center gap-2 text-slate-700">
                    <span className="w-2 h-2 rounded-full bg-purple-600" />
                    Pro ($79/mo)
                  </span>
                  <span className="font-mono font-semibold text-slate-900">{tiers.pro || 0}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Database Tables</span>
            <span className="font-mono text-slate-700 font-semibold">{Object.keys(stats).length} active</span>
          </div>
        </div>
      </div>
    </div>
  )
}
