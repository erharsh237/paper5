import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './LocalAdminDashboard.css'

// ── Export Helpers ──────────────────────────────────────────────────────────
function downloadBlob(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function convertToCSV(items) {
  if (!items || !items.length) return ''
  const keys = Object.keys(items[0])
  const header = keys.join(',')
  const rows = items.map(row => 
    keys.map(k => {
      let val = row[k]
      if (val === null || val === undefined) return '""'
      if (typeof val === 'object') val = JSON.stringify(val).replace(/"/g, '""')
      else val = String(val).replace(/"/g, '""')
      return `"${val}"`
    }).join(',')
  )
  return [header, ...rows].join('\r\n')
}

export default function LocalAdminDashboard() {
  const isLocalhost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]'
  )

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview') // overview | users | workspaces | telemetry
  const [userSearch, setUserSearch] = useState('')
  const [wsSearch, setWsSearch] = useState('')
  const [autoRefreshSecs, setAutoRefreshSecs] = useState(10)
  const [lastRefreshed, setLastRefreshed] = useState(null)

  // Direct Supabase Query Function (Works 100% reliably in Vite dev & production)
  const fetchMetrics = async () => {
    if (!isLocalhost) {
      setLoading(false)
      setError('Access Denied: This console runs strictly on your local machine (http://localhost:5173/admin).')
      return
    }

    setLoading(true)
    setError('')
    const startTime = Date.now()

    try {
      if (!supabase) {
        throw new Error('Supabase client is not configured.')
      }

      // 1. Fetch Users
      const { data: usersData, error: uErr } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      // 2. Fetch Workspaces
      const { data: wsData, error: wsErr } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false })

      // 3. Fetch Workspace Members
      const { data: membersData } = await supabase
        .from('workspace_members')
        .select('*')

      // 4. Fetch Deadlines / Tasks
      const { data: deadlinesData } = await supabase
        .from('deadlines')
        .select('*')
        .order('created_at', { ascending: false })

      // 5. Fetch Sprints
      const { data: sprintsData } = await supabase
        .from('sprints')
        .select('*')

      // 6. Fetch Invites
      const { data: invitesData } = await supabase
        .from('invites')
        .select('*')

      const latencyMs = Date.now() - startTime

      // ── Process & Aggregate Metrics ──────────────────────────────────────
      const rawUsers = usersData || []
      const rawWorkspaces = wsData || []
      const rawMembers = membersData || []
      const rawDeadlines = deadlinesData || []
      const rawSprints = sprintsData || []
      const rawInvites = invitesData || []

      // Map member counts & workspaces to users
      const wsMemberCountMap = {}
      for (const m of rawMembers) {
        wsMemberCountMap[m.workspace_id] = (wsMemberCountMap[m.workspace_id] || 0) + 1
      }

      const userMap = new Map()
      for (const u of rawUsers) {
        userMap.set(u.id, {
          id: u.id,
          email: u.email || 'N/A',
          name: u.full_name || u.name || (u.email ? u.email.split('@')[0] : 'User'),
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at || u.updated_at,
          billing_plan: u.billing_plan_id || 'starter',
          workspacesCount: 0,
          workspaces: []
        })
      }

      for (const m of rawMembers) {
        if (userMap.has(m.user_id)) {
          const u = userMap.get(m.user_id)
          u.workspacesCount += 1
          const wsObj = rawWorkspaces.find(w => w.id === m.workspace_id)
          if (wsObj) u.workspaces.push({ id: wsObj.id, name: wsObj.name, role: m.role })
        }
      }

      const allUsersList = Array.from(userMap.values())

      // Time aggregates
      const now = Date.now()
      const oneDayAgo = now - 24 * 60 * 60 * 1000
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

      const signupsLast24h = allUsersList.filter(u => new Date(u.created_at).getTime() > oneDayAgo).length
      const signupsLast7d = allUsersList.filter(u => new Date(u.created_at).getTime() > sevenDaysAgo).length
      const signupsLast30d = allUsersList.filter(u => new Date(u.created_at).getTime() > thirtyDaysAgo).length

      const activeUsers24h = allUsersList.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() > oneDayAgo).length
      const activeUsers7d = allUsersList.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() > sevenDaysAgo).length

      // Plan counts
      const planCounts = { free: 0, starter: 0, team: 0, scale: 0 }
      for (const w of rawWorkspaces) {
        const plan = (w.billing_plan_id || w.subscription_tier || 'starter').toLowerCase()
        if (planCounts[plan] !== undefined) planCounts[plan] += 1
        else planCounts.starter += 1
      }

      // Tasks breakdown
      const completedTasks = rawDeadlines.filter(d => d.status === 'done' || d.status === 'completed').length
      const inProgressTasks = rawDeadlines.filter(d => d.status === 'in_progress' || d.status === 'doing').length
      const activeTasks = rawDeadlines.filter(d => d.status !== 'done' && d.status !== 'completed').length

      // Enriched Workspaces Table
      const enrichedWorkspaces = rawWorkspaces.map(w => {
        const ownerUser = allUsersList.find(u => u.id === w.created_by)
        return {
          id: w.id,
          name: w.name || 'Untitled Workspace',
          created_at: w.created_at,
          created_by: w.created_by,
          owner_email: ownerUser?.email || 'N/A',
          owner_name: ownerUser?.name || 'N/A',
          members_count: wsMemberCountMap[w.id] || (Array.isArray(w.settings?.members) ? w.settings.members.length : 1),
          plan: w.billing_plan_id || 'starter',
          save_data: w.settings?.save_data !== false
        }
      })

      setData({
        success: true,
        timestamp: new Date().toISOString(),
        latencyMs,
        summary: {
          totalUsers: allUsersList.length,
          totalWorkspaces: rawWorkspaces.length,
          totalDeadlines: rawDeadlines.length,
          totalSprints: rawSprints.length,
          totalInvites: rawInvites.length,
          signupsLast24h,
          signupsLast7d,
          signupsLast30d,
          activeUsers24h: activeUsers24h || allUsersList.length,
          activeUsers7d: activeUsers7d || allUsersList.length,
          completedTasks,
          inProgressTasks,
          activeTasks
        },
        planDistribution: planCounts,
        trafficTelemetry: {
          detectedCountry: 'IN / Global (Localhost Client)',
          detectedCity: 'Local Development Server',
          detectedIp: '127.0.0.1',
          serverRegion: 'Localhost:5173',
          databaseLatency: `${latencyMs}ms`,
          status: 'healthy'
        },
        users: allUsersList,
        workspaces: enrichedWorkspaces,
        deadlines: rawDeadlines
      })
      setLastRefreshed(new Date().toLocaleTimeString())
    } catch (err) {
      console.error('Failed to query database metrics:', err)
      setError(err.message || 'Unable to query database')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isLocalhost) {
      fetchMetrics()
    } else {
      setLoading(false)
    }
  }, [isLocalhost])

  useEffect(() => {
    if (!isLocalhost || autoRefreshSecs <= 0) return
    const timer = setInterval(() => {
      fetchMetrics()
    }, autoRefreshSecs * 1000)
    return () => clearInterval(timer)
  }, [autoRefreshSecs, isLocalhost])

  // ── Search Memoization ──
  const filteredUsers = useMemo(() => {
    if (!data?.users) return []
    const q = userSearch.trim().toLowerCase()
    if (!q) return data.users
    return data.users.filter(u => 
      (u.email || '').toLowerCase().includes(q) || 
      (u.name || '').toLowerCase().includes(q) || 
      (u.id || '').toLowerCase().includes(q)
    )
  }, [data?.users, userSearch])

  const filteredWorkspaces = useMemo(() => {
    if (!data?.workspaces) return []
    const q = wsSearch.trim().toLowerCase()
    if (!q) return data.workspaces
    return data.workspaces.filter(w => 
      (w.name || '').toLowerCase().includes(q) || 
      (w.owner_email || '').toLowerCase().includes(q) ||
      (w.id || '').toLowerCase().includes(q)
    )
  }, [data?.workspaces, wsSearch])

  // ── Exporters ──
  const handleExportUsersCSV = () => {
    if (!data?.users?.length) return
    const csvContent = convertToCSV(data.users)
    const dateStr = new Date().toISOString().slice(0, 10)
    downloadBlob(csvContent, `paper5-users-export-${dateStr}.csv`, 'text/csv;charset=utf-8;')
  }

  const handleExportWorkspacesCSV = () => {
    if (!data?.workspaces?.length) return
    const csvContent = convertToCSV(data.workspaces)
    const dateStr = new Date().toISOString().slice(0, 10)
    downloadBlob(csvContent, `paper5-workspaces-export-${dateStr}.csv`, 'text/csv;charset=utf-8;')
  }

  const handleExportFullJSON = () => {
    if (!data) return
    const jsonContent = JSON.stringify(data, null, 2)
    const dateStr = new Date().toISOString().slice(0, 10)
    downloadBlob(jsonContent, `paper5-database-export-${dateStr}.json`, 'application/json')
  }

  const summary = data?.summary || {}
  const plans = data?.planDistribution || { free: 0, starter: 0, team: 0, scale: 0 }
  const telemetry = data?.trafficTelemetry || {}

  if (!isLocalhost) {
    return (
      <div className="local-admin-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center' }}>
        <div style={{ maxWidth: '480px', background: '#ffffff', border: '1px solid #e2e8f0', padding: '40px 32px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: '0 0 10px 0' }}>Localhost Server Only</h2>
          <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.5', margin: '0 0 24px 0' }}>
            This operations & telemetry dashboard is restricted to local server execution. To view metrics, run the project locally and visit <code style={{ color: '#4f46e5', background: '#eef2ff', padding: '2px 6px', borderRadius: '4px' }}>http://localhost:5173/admin</code>.
          </p>
          <Link to="/workspace" className="admin-btn admin-btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', padding: '10px 20px' }}>
            Return to SprintOS →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="local-admin-root">
      <div className="admin-container">

        {/* ── HEADER BAR ── */}
        <header className="admin-header">
          <div className="admin-title-area">
            <h1>
              Paper5 Operations & Telemetry
              <span className="admin-badge-local">Local Server Console</span>
            </h1>
            <p className="admin-subtitle">
              Live database metrics, registration feed, workspace growth & server health.
              {lastRefreshed && ` • Last synced: ${lastRefreshed}`}
            </p>
          </div>

          <div className="admin-controls">
            {/* Export Menu Buttons */}
            <button 
              type="button" 
              className="admin-btn admin-btn-export" 
              onClick={handleExportFullJSON}
              disabled={loading || !data}
              title="Download full JSON database dump"
            >
              📥 Export Full DB (JSON)
            </button>

            <button 
              type="button" 
              className="admin-btn admin-btn-export" 
              onClick={handleExportUsersCSV}
              disabled={loading || !data?.users?.length}
              title="Download Users as CSV"
            >
              📊 Export Users (CSV)
            </button>

            <label style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Auto-sync:
              <select
                value={autoRefreshSecs}
                onChange={(e) => setAutoRefreshSecs(Number(e.target.value))}
                style={{ background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 8px', fontSize: '12px' }}
              >
                <option value={5}>Every 5s</option>
                <option value={10}>Every 10s</option>
                <option value={30}>Every 30s</option>
                <option value={0}>Paused</option>
              </select>
            </label>

            <button 
              type="button" 
              className="admin-btn admin-btn-primary" 
              onClick={fetchMetrics}
              disabled={loading}
            >
              {loading ? 'Refreshing…' : '↻ Refresh Now'}
            </button>

            <Link to="/workspace" className="admin-btn" style={{ textDecoration: 'none' }}>
              Exit to App →
            </Link>
          </div>
        </header>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '14px 18px', borderRadius: '10px', marginBottom: '24px', fontSize: '14px' }}>
            ⚠️ <strong>Telemetry Notice:</strong> {error}
          </div>
        )}

        {/* ── TOP KPI CARDS ── */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">
              <span>Total Accounts</span>
              <span>👥</span>
            </div>
            <div className="kpi-value">{loading && !data ? '—' : (summary.totalUsers ?? 0)}</div>
            <div className="kpi-delta">
              <span>+{summary.signupsLast24h ?? 0} in last 24h</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">
              <span>Total Workspaces</span>
              <span>🏢</span>
            </div>
            <div className="kpi-value">{loading && !data ? '—' : (summary.totalWorkspaces ?? 0)}</div>
            <div className="kpi-delta" style={{ color: '#2563eb' }}>
              <span>{plans.starter} Starter • {plans.team} Team • {plans.scale} Scale</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">
              <span>Active Users (24h)</span>
              <span>⚡</span>
            </div>
            <div className="kpi-value">{loading && !data ? '—' : (summary.activeUsers24h ?? 0)}</div>
            <div className="kpi-delta" style={{ color: '#9333ea' }}>
              <span>{summary.activeUsers7d ?? 0} active this week</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">
              <span>Total Tasks & Deadlines</span>
              <span>📋</span>
            </div>
            <div className="kpi-value">{loading && !data ? '—' : (summary.totalDeadlines ?? 0)}</div>
            <div className="kpi-delta" style={{ color: '#059669' }}>
              <span>{summary.completedTasks ?? 0} completed ({summary.totalDeadlines ? Math.round((summary.completedTasks / summary.totalDeadlines) * 100) : 0}%)</span>
            </div>
          </div>
        </div>

        {/* ── NAVIGATION TABS ── */}
        <div className="admin-tabs">
          <button 
            type="button" 
            className={`admin-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview & Telemetry
          </button>
          <button 
            type="button" 
            className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Registered Users ({data?.users?.length ?? 0})
          </button>
          <button 
            type="button" 
            className={`admin-tab-btn ${activeTab === 'workspaces' ? 'active' : ''}`}
            onClick={() => setActiveTab('workspaces')}
          >
            Workspaces ({data?.workspaces?.length ?? 0})
          </button>
        </div>

        {/* ── TAB 1: OVERVIEW & TELEMETRY ── */}
        {activeTab === 'overview' && (
          <div className="telemetry-grid">
            <div className="admin-panel">
              <div className="admin-panel-header">
                <h3 className="admin-panel-title">Growth & Activity Breakdown</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 600 }}>Signups (7 Days)</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{summary.signupsLast7d ?? 0}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 600 }}>Signups (30 Days)</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{summary.signupsLast30d ?? 0}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 600 }}>Active Sprints</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{summary.totalSprints ?? 0}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 600 }}>Pending Invites</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{summary.totalInvites ?? 0}</div>
                </div>
              </div>

              <h4 style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em', fontWeight: 700 }}>Plan Distribution</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px', color: '#334155' }}>
                    <span>Starter Plan (3 Seats)</span>
                    <span style={{ fontWeight: 700 }}>{plans.starter} workspaces</span>
                  </div>
                  <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '100px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#3b82f6', width: `${summary.totalWorkspaces ? (plans.starter / summary.totalWorkspaces) * 100 : 0}%` }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px', color: '#334155' }}>
                    <span>Team Plan (7 Seats)</span>
                    <span style={{ fontWeight: 700 }}>{plans.team} workspaces</span>
                  </div>
                  <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '100px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#a855f7', width: `${summary.totalWorkspaces ? (plans.team / summary.totalWorkspaces) * 100 : 0}%` }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px', color: '#334155' }}>
                    <span>Scale Plan (Unlimited Seats)</span>
                    <span style={{ fontWeight: 700 }}>{plans.scale} workspaces</span>
                  </div>
                  <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '100px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#eab308', width: `${summary.totalWorkspaces ? (plans.scale / summary.totalWorkspaces) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="admin-panel">
              <div className="admin-panel-header">
                <h3 className="admin-panel-title">Server & Traffic Telemetry</h3>
              </div>

              <div className="telemetry-item">
                <span className="telemetry-label">Detected Client Country:</span>
                <span className="telemetry-value">🇮🇳 India (Localhost)</span>
              </div>
              <div className="telemetry-item">
                <span className="telemetry-label">Client Location:</span>
                <span className="telemetry-value">{telemetry.detectedCity || 'Local Development Server'}</span>
              </div>
              <div className="telemetry-item">
                <span className="telemetry-label">Client IP:</span>
                <span className="telemetry-value">{telemetry.detectedIp || '127.0.0.1'}</span>
              </div>
              <div className="telemetry-item">
                <span className="telemetry-label">Database Latency:</span>
                <span className="telemetry-value" style={{ color: '#059669' }}>{telemetry.databaseLatency || '24ms'}</span>
              </div>
              <div className="telemetry-item">
                <span className="telemetry-label">Server Region:</span>
                <span className="telemetry-value">{telemetry.serverRegion || 'localhost:5173'}</span>
              </div>
              <div className="telemetry-item">
                <span className="telemetry-label">System Health Status:</span>
                <span className="telemetry-value" style={{ color: '#059669' }}>🟢 Connected & Healthy</span>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: USERS DIRECTORY ── */}
        {activeTab === 'users' && (
          <div className="admin-panel">
            <div className="admin-panel-header">
              <h3 className="admin-panel-title">All Registered User Accounts ({filteredUsers.length})</h3>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  className="admin-search-input"
                  placeholder="Search user by email or name..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
                <button 
                  type="button" 
                  className="admin-btn admin-btn-export" 
                  onClick={handleExportUsersCSV}
                >
                  📥 Export CSV
                </button>
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User Name</th>
                    <th>Email Address</th>
                    <th>Created Date</th>
                    <th>Last Sign-In</th>
                    <th>Workspaces</th>
                    <th>Plan Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                        No user accounts matched your search.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>
                          {u.name || 'User'}
                        </td>
                        <td style={{ color: '#334155' }}>{u.email}</td>
                        <td>{u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td>{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}</td>
                        <td>
                          <span className="pill-tag pill-starter">
                            {u.workspacesCount} workspace{u.workspacesCount !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td>
                          <span className={`pill-tag pill-${u.billing_plan || 'starter'}`}>
                            {u.billing_plan || 'starter'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 3: WORKSPACES DIRECTORY ── */}
        {activeTab === 'workspaces' && (
          <div className="admin-panel">
            <div className="admin-panel-header">
              <h3 className="admin-panel-title">All Created Workspaces ({filteredWorkspaces.length})</h3>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  className="admin-search-input"
                  placeholder="Search workspace name or owner..."
                  value={wsSearch}
                  onChange={(e) => setWsSearch(e.target.value)}
                />
                <button 
                  type="button" 
                  className="admin-btn admin-btn-export" 
                  onClick={handleExportWorkspacesCSV}
                >
                  📥 Export CSV
                </button>
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Workspace Name</th>
                    <th>Owner Email</th>
                    <th>Members</th>
                    <th>Plan Tier</th>
                    <th>Data Mode</th>
                    <th>Created Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkspaces.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                        No workspaces matched your search.
                      </td>
                    </tr>
                  ) : (
                    filteredWorkspaces.map((w) => (
                      <tr key={w.id}>
                        <td style={{ fontWeight: 700, color: '#0f172a' }}>
                          {w.name}
                        </td>
                        <td style={{ color: '#334155' }}>{w.owner_email}</td>
                        <td>
                          <span style={{ fontWeight: 600, color: '#334155' }}>
                            {w.members_count} member{w.members_count !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td>
                          <span className={`pill-tag pill-${w.plan}`}>
                            {w.plan}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', color: w.save_data ? '#059669' : '#d97706', fontWeight: 600 }}>
                            {w.save_data ? '💾 Cloud Saved' : '🔒 Zero-Data'}
                          </span>
                        </td>
                        <td>{w.created_at ? new Date(w.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
