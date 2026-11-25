import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, BarChart3, Globe, Clock, MousePointerClick, AlertCircle } from 'lucide-react'
import { ownerApi } from '../lib/api'

function formatDuration(sec = 0) {
  const s = Math.max(0, Math.round(sec))
  const m = Math.floor(s / 60)
  const rem = s % 60
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`
}

export function ProductAnalytics() {
  const [data, setData] = useState(null)
  const [ga4, setGa4] = useState(null)
  const [dateRange, setDateRange] = useState('28d')
  const [target, setTarget] = useState('main')
  const [loading, setLoading] = useState(true)
  const [gaLoading, setGaLoading] = useState(true)

  const loadOverview = useCallback(async () => {
    setLoading(true)
    try {
      const res = await ownerApi('overview')
      setData(res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadGa4 = useCallback(async (range, propTarget) => {
    setGaLoading(true)
    try {
      const res = await ownerApi('analytics.ga4', { params: { dateRange: range, target: propTarget } })
      setGa4(res)
    } catch (err) {
      setGa4({ configured: true, error: err?.message || 'Failed to load GA4 analytics.' })
    } finally {
      setGaLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  useEffect(() => {
    loadGa4(dateRange, target)
  }, [dateRange, target]) // loadGa4 has stable identity (empty deps), safe to omit

  const kpis = data?.kpis || {}
  const summary = ga4?.summary || {}
  const daily = ga4?.daily || []
  const maxViews = Math.max(1, ...daily.map((d) => d.pageViews || 0))
  const hasBothProps = Boolean(ga4?.availableProperties?.main && ga4?.availableProperties?.app)

  return (
    <div className="space-y-6">
      {/* Platform KPIs */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Platform &amp; Product Analytics</h2>
            <p className="text-xs text-slate-500">Internal workspace telemetry and live Google Analytics 4 reports.</p>
          </div>
          <button
            type="button"
            onClick={() => { loadOverview(); loadGa4(dateRange, target) }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(loading || gaLoading) ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
            <div className="text-xs text-slate-500 font-medium">Total Tasks</div>
            <div className="text-2xl font-bold text-slate-900 font-mono mt-1">{kpis.totalTasks || 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">Across all workspaces</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
            <div className="text-xs text-slate-500 font-medium">Total Sprints</div>
            <div className="text-2xl font-bold text-slate-900 font-mono mt-1">{kpis.totalSprints || 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">Managed sprints</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
            <div className="text-xs text-slate-500 font-medium">Conversion Rate</div>
            <div className="text-2xl font-bold text-emerald-600 font-mono mt-1">{kpis.conversionRate || 0}%</div>
            <div className="text-[11px] text-slate-400 mt-1">Free to paid</div>
          </div>
        </div>
      </section>

      {/* Google Analytics 4 Section */}
      <section className="p-5 rounded-2xl bg-white border border-black/[0.06] shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Google Analytics 4 (GA4)</h3>
              <p className="text-xs text-slate-500">
                {ga4?.configured && ga4?.propertyId ? `Property ID: ${ga4.propertyId}` : 'Live traffic, pages, and acquisition sources'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {hasBothProps && (
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
                <button
                  type="button"
                  onClick={() => setTarget('main')}
                  className={`px-2.5 py-1 rounded-md font-semibold ${target === 'main' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  paper5.co
                </button>
                <button
                  type="button"
                  onClick={() => setTarget('app')}
                  className={`px-2.5 py-1 rounded-md font-semibold ${target === 'app' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  app.paper5.co
                </button>
              </div>
            )}

            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
              {['7d', '28d', '90d'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDateRange(r)}
                  className={`px-2.5 py-1 rounded-md font-semibold uppercase ${dateRange === r ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {gaLoading && !ga4 ? (
          <div className="py-8 text-center text-xs text-slate-500">Loading GA4 metrics...</div>
        ) : ga4 && ga4.configured === false ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs text-slate-600">
            <div className="font-semibold text-slate-900">Connect your GA4 Property to view live reports</div>
            <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
              <li>Enable the <strong>Google Analytics Data API</strong> in your Google Cloud project (<code className="px-1 py-0.5 bg-white rounded border border-slate-200">paper5-515716</code>).</li>
              <li>Create a <strong>Service Account</strong> (JSON key) and add its email as a <strong>Viewer</strong> in <strong>GA4 Admin → Property Access Management</strong>.</li>
              <li>Copy your numeric <strong>GA4 Property ID</strong> from <strong>GA4 Admin → Property Details</strong>.</li>
              <li>Add <code className="px-1 py-0.5 bg-white rounded border border-slate-200">GA4_PROPERTY_ID</code> (or <code className="px-1 py-0.5 bg-white rounded border border-slate-200">GA4_MAIN_PROPERTY_ID</code> &amp; <code className="px-1 py-0.5 bg-white rounded border border-slate-200">GA4_APP_PROPERTY_ID</code>) and <code className="px-1 py-0.5 bg-white rounded border border-slate-200">GA4_SERVICE_ACCOUNT_JSON</code> to your <code className="px-1 py-0.5 bg-white rounded border border-slate-200">.env</code> and Vercel environment variables.</li>
            </ol>
          </div>
        ) : ga4?.error ? (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{ga4.error}</span>
          </div>
        ) : (
          <>
            {/* GA4 Summary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[11px] text-slate-500 font-medium">Active Users</div>
                <div className="text-xl font-bold text-slate-900 font-mono mt-1">{(summary.activeUsers || 0).toLocaleString()}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[11px] text-slate-500 font-medium">Sessions</div>
                <div className="text-xl font-bold text-slate-900 font-mono mt-1">{(summary.sessions || 0).toLocaleString()}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[11px] text-slate-500 font-medium">Page Views</div>
                <div className="text-xl font-bold text-slate-900 font-mono mt-1">{(summary.pageViews || 0).toLocaleString()}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Avg. Session</div>
                <div className="text-xl font-bold text-slate-900 font-mono mt-1">{formatDuration(summary.avgSessionDurationSec)}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1"><MousePointerClick className="w-3 h-3" /> Bounce Rate</div>
                <div className="text-xl font-bold text-slate-900 font-mono mt-1">{summary.bounceRatePct ?? 0}%</div>
              </div>
            </div>

            {/* Daily Page Views Bar Strip */}
            {daily.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">Daily Page Views ({dateRange})</div>
                <div className="h-28 flex items-end gap-1 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  {daily.map((d, idx) => {
                    const pct = Math.max(6, Math.round(((d.pageViews || 0) / maxViews) * 100))
                    return (
                      <div
                        key={d.date || idx}
                        title={`${d.date}: ${d.pageViews} views, ${d.activeUsers} users`}
                        className="flex-1 bg-slate-900/85 hover:bg-slate-900 rounded-t transition-all"
                        style={{ height: `${pct}%` }}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* Top Pages & Top Sources */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-500" />
                  <span>Top Pages</span>
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  {(ga4?.topPages || []).length === 0 ? (
                    <div className="p-4 text-slate-400">No page data in this range.</div>
                  ) : (
                    ga4.topPages.map((p, i) => (
                      <div key={p.path + i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                        <span className="font-mono text-slate-700 truncate">{p.path}</span>
                        <span className="font-mono font-semibold text-slate-900 shrink-0">{p.views.toLocaleString()} views</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                  Top Traffic Sources
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  {(ga4?.topSources || []).length === 0 ? (
                    <div className="p-4 text-slate-400">No source data in this range.</div>
                  ) : (
                    ga4.topSources.map((s, i) => (
                      <div key={s.source + i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                        <span className="text-slate-700 truncate">{s.source}</span>
                        <span className="font-mono font-semibold text-slate-900 shrink-0">{s.sessions.toLocaleString()} sessions</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
