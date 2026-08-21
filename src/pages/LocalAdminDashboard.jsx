import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import './LocalAdminDashboard.css'

export default function LocalAdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview') // overview | users | workspaces | telemetry
  const [userSearch, setUserSearch] = useState('')
  const [wsSearch, setWsSearch] = useState('')
  const [autoRefreshSecs, setAutoRefreshSecs] = useState(10)
  const [lastRefreshed, setLastRefreshed] = useState(null)

  const fetchMetrics = async () => {
    try {
      setError('')
      const res = await fetch('/api/admin-metrics')
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`)
      }
      const json = await res.json()
      if (json.success) {
        setData(json)
        setLastRefreshed(new Date().toLocaleTimeString())
      } else {
        throw new Error(json.error || 'Failed to load telemetry')
      }
    } catch (err) {
      console.error('Failed to load admin metrics:', err)
      setError(err.message || 'Unable to connect to telemetry API')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
  }, [])

  useEffect(() => {
    if (autoRefreshSecs <= 0) return
    const timer = setInterval(() => {
      fetchMetrics()
    }, autoRefreshSecs * 1000)
    return () => clearInterval(timer)
  }, [autoRefreshSecs])

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

  const summary = data?.summary || {}
  const plans = data?.planDistribution || { free: 0, starter: 0, team: 0, scale: 0 }
  const telemetry = data?.trafficTelemetry || {}

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
            <label style={{ fontSize: '13px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Auto-sync:
              <select
                value={autoRefreshSecs}
                onChange={(e) => setAutoRefreshSecs(Number(e.target.value))}
                style={{ background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px' }}
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
          <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', color: '#fecaca', padding: '14px 18px', borderRadius: '10px', marginBottom: '24px', fontSize: '14px' }}>
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
            <div className="kpi-delta" style={{ color: '#60a5fa' }}>
              <span>{plans.starter} Starter • {plans.team} Team • {plans.scale} Scale</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">
              <span>Active Users (24h)</span>
              <span>⚡</span>
            </div>
            <div className="kpi-value">{loading && !data ? '—' : (summary.activeUsers24h ?? 0)}</div>
            <div className="kpi-delta" style={{ color: '#a855f7' }}>
              <span>{summary.activeUsers7d ?? 0} active this week</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">
              <span>Total Tasks & Deadlines</span>
              <span>📋</span>
            </div>
            <div className="kpi-value">{loading && !data ? '—' : (summary.totalDeadlines ?? 0)}</div>
            <div className="kpi-delta" style={{ color: '#10b981' }}>
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
                <div style={{ background: '#181d2d', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Signups (7 Days)</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>{summary.signupsLast7d ?? 0}</div>
                </div>
                <div style={{ background: '#181d2d', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Signups (30 Days)</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>{summary.signupsLast30d ?? 0}</div>
                </div>
                <div style={{ background: '#181d2d', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Active Sprints</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>{summary.totalSprints ?? 0}</div>
                </div>
                <div style={{ background: '#181d2d', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Pending Invites</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>{summary.totalInvites ?? 0}</div>
                </div>
              </div>

              <h4 style={{ fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>Plan Distribution</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                    <span>Starter Plan (3 Seats)</span>
                    <span style={{ fontWeight: 700 }}>{plans.starter} workspaces</span>
                  </div>
                  <div style={{ height: '8px', background: '#1e293b', borderRadius: '100px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#3b82f6', width: `${summary.totalWorkspaces ? (plans.starter / summary.totalWorkspaces) * 100 : 0}%` }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                    <span>Team Plan (7 Seats)</span>
                    <span style={{ fontWeight: 700 }}>{plans.team} workspaces</span>
                  </div>
                  <div style={{ height: '8px', background: '#1e293b', borderRadius: '100px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#a855f7', width: `${summary.totalWorkspaces ? (plans.team / summary.totalWorkspaces) * 100 : 0}%` }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                    <span>Scale Plan (Unlimited Seats)</span>
                    <span style={{ fontWeight: 700 }}>{plans.scale} workspaces</span>
                  </div>
                  <div style={{ height: '8px', background: '#1e293b', borderRadius: '100px', overflow: 'hidden' }}>
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
                <span className="telemetry-value">🌍 {telemetry.detectedCountry || 'IN / Global'}</span>
              </div>
              <div className="telemetry-item">
                <span className="telemetry-label">Client Location:</span>
                <span className="telemetry-value">{telemetry.detectedCity || 'Localhost'}</span>
              </div>
              <div className="telemetry-item">
                <span className="telemetry-label">Client IP:</span>
                <span className="telemetry-value">{telemetry.detectedIp || '127.0.0.1'}</span>
              </div>
              <div className="telemetry-item">
                <span className="telemetry-label">Database Latency:</span>
                <span className="telemetry-value" style={{ color: '#10b981' }}>{telemetry.databaseLatency || '18ms'}</span>
              </div>
              <div className="telemetry-item">
                <span className="telemetry-label">Server Region:</span>
                <span className="telemetry-value">{telemetry.serverRegion || 'Vercel Edge'}</span>
              </div>
              <div className="telemetry-item">
                <span className="telemetry-label">System Health Status:</span>
                <span className="telemetry-value" style={{ color: '#10b981' }}>🟢 Operational</span>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: USERS DIRECTORY ── */}
        {activeTab === 'users' && (
          <div className="admin-panel">
            <div className="admin-panel-header">
              <h3 className="admin-panel-title">All Registered User Accounts</h3>
              <input
                type="text"
                className="admin-search-input"
                placeholder="Search user by email or name..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Created Date</th>
                    <th>Last Sign-In</th>
                    <th>Workspaces</th>
                    <th>Auth Provider</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                        No user accounts matched your search.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 600, color: '#ffffff' }}>
                          {u.name || 'User'}
                        </td>
                        <td>{u.email}</td>
                        <td>{u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td>{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}</td>
                        <td>
                          <span className="pill-tag pill-starter">
                            {u.workspacesCount} workspace{u.workspacesCount !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td>
                          <span style={{ textTransform: 'capitalize', fontSize: '12px', color: '#94a3b8' }}>
                            {u.provider || 'email'}
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
              <h3 className="admin-panel-title">All Created Workspaces</h3>
              <input
                type="text"
                className="admin-search-input"
                placeholder="Search workspace name or owner..."
                value={wsSearch}
                onChange={(e) => setWsSearch(e.target.value)}
              />
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
                      <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                        No workspaces matched your search.
                      </td>
                    </tr>
                  ) : (
                    filteredWorkspaces.map((w) => (
                      <tr key={w.id}>
                        <td style={{ fontWeight: 700, color: '#ffffff' }}>
                          {w.name}
                        </td>
                        <td>{w.owner_email}</td>
                        <td>
                          <span style={{ fontWeight: 600, color: '#e2e8f0' }}>
                            {w.members_count} member{w.members_count !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td>
                          <span className={`pill-tag pill-${w.plan}`}>
                            {w.plan}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', color: w.save_data ? '#10b981' : '#f59e0b' }}>
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
