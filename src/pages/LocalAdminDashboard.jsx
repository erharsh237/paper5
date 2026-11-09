import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '../lib/supabase'
import { 
  Settings, 
  RefreshCw, 
  Download, 
  ExternalLink, 
  Search, 
  ArrowLeft, 
  ChevronRight, 
  LogOut, 
  Radio, 
  ShieldCheck, 
  Key, 
  X,
  Users,
  Building2,
  CheckCircle2,
  Activity,
  Layers
} from 'lucide-react'
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
  const navigate = useNavigate()
  const isLocalhost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]'
  )

  const [serviceKey, setServiceKey] = useState(() => {
    return localStorage.getItem('paper5_service_role_key') || import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
  })
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [tempKey, setTempKey] = useState('')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview') // overview | live | users | workspaces | reports
  const [userSearch, setUserSearch] = useState('')
  const [wsSearch, setWsSearch] = useState('')
  const [autoRefreshSecs, setAutoRefreshSecs] = useState(10)
  const [lastRefreshed, setLastRefreshed] = useState(null)

  // Real-time live presence visitors
  const [liveVisitors, setLiveVisitors] = useState([])
  const [liveCount, setLiveCount] = useState(0)

  // Real-time Supabase Presence Listener for Live Visitors
  useEffect(() => {
    if (!defaultClient || typeof window === 'undefined') return

    const channel = defaultClient.channel('paper5-live-visitors')

    const updateFromState = () => {
      const state = channel.presenceState()
      const visitors = []
      for (const key in state) {
        const arr = state[key] || []
        for (const item of arr) {
          if (item && (item.visitorId || item.page || item.email)) {
            visitors.push(item)
          }
        }
      }
      setLiveVisitors(visitors)
      setLiveCount(visitors.length)
    }

    channel
      .on('presence', { event: 'sync' }, updateFromState)
      .on('presence', { event: 'join' }, updateFromState)
      .on('presence', { event: 'leave' }, updateFromState)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          updateFromState()
        }
      })

    return () => {
      try {
        defaultClient.removeChannel(channel)
      } catch (_) {}
    }
  }, [])

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sdbglndhjkqhkphzqmum.supabase.co'

  // Direct Supabase Query Function (Uses Service Role Key if available, or default client)
  const fetchMetrics = async () => {
    setLoading(true)
    setError('')
    const startTime = Date.now()

    try {
      const activeClient = (serviceKey && serviceKey.trim()) 
        ? createClient(supabaseUrl, serviceKey.trim(), {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
              storageKey: 'paper5_admin_client_session'
            }
          })
        : defaultClient

      if (!activeClient) {
        throw new Error('Supabase client is not configured.')
      }

      // 1. Fetch Users from auth.admin (if serviceKey provided) and public.users
      let authUsersList = []
      if (serviceKey && typeof activeClient.auth?.admin?.listUsers === 'function') {
        try {
          const { data: authRes } = await activeClient.auth.admin.listUsers({ perPage: 1000 })
          if (authRes?.users) {
            authUsersList = authRes.users
          }
        } catch (authErr) {
          console.warn('Auth admin list note:', authErr.message)
        }
      }

      const { data: usersData } = await activeClient
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      // 2. Fetch Workspaces
      const { data: wsData } = await activeClient
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false })

      // 3. Fetch Workspace Members
      const { data: membersData } = await activeClient
        .from('workspace_members')
        .select('*')

      // 4. Fetch Deadlines / Tasks
      const { data: deadlinesData } = await activeClient
        .from('deadlines')
        .select('*')
        .order('created_at', { ascending: false })

      // 5. Fetch Sprints
      const { data: sprintsData } = await activeClient
        .from('sprints')
        .select('*')

      // 6. Fetch Invites
      const { data: invitesData } = await activeClient
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

      // Add all auth users
      for (const au of authUsersList) {
        userMap.set(au.id, {
          id: au.id,
          email: au.email || 'N/A',
          name: au.user_metadata?.full_name || au.user_metadata?.name || (au.email ? au.email.split('@')[0] : 'User'),
          created_at: au.created_at,
          last_sign_in_at: au.last_sign_in_at,
          billing_plan: 'starter',
          provider: au.app_metadata?.provider || 'email',
          workspacesCount: 0,
          workspaces: []
        })
      }

      // Add/merge public users
      for (const u of rawUsers) {
        const existing = userMap.get(u.id) || {}
        userMap.set(u.id, {
          ...existing,
          id: u.id,
          email: u.email || existing.email || 'N/A',
          name: u.full_name || u.name || existing.name || (u.email ? u.email.split('@')[0] : 'User'),
          created_at: u.created_at || existing.created_at,
          last_sign_in_at: u.last_sign_in_at || existing.last_sign_in_at,
          billing_plan: u.billing_plan_id || existing.billing_plan || 'starter',
          provider: existing.provider || 'email',
          workspacesCount: existing.workspacesCount || 0,
          workspaces: existing.workspaces || []
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
    fetchMetrics()
  }, [])

  useEffect(() => {
    if (autoRefreshSecs <= 0) return
    const timer = setInterval(() => {
      fetchMetrics()
    }, autoRefreshSecs * 1000)
    return () => clearInterval(timer)
  }, [autoRefreshSecs])

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

  const summary = data?.summary || {}
  const plans = data?.planDistribution || { starter: 0, team: 0, scale: 0 }

  // Top performers mock/real hybrid
  const topPerformers = useMemo(() => {
    if (data?.workspaces && data.workspaces.length > 0) {
      return data.workspaces.slice(0, 3).map((w, i) => {
        const percentages = ['39%', '25%', '18%']
        const avatars = [
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80'
        ]
        return {
          name: w.name,
          handle: w.owner_email ? `@${w.owner_email.split('@')[0]}` : '@paper5_team',
          percentage: percentages[i] || '20%',
          avatar: avatars[i]
        }
      })
    }
    return [
      { name: 'Valy Antonova', handle: '@valyantonova', percentage: '39%', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80' },
      { name: 'Mark Noil', handle: '@marknoil', percentage: '18%', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80' },
      { name: 'Nenci Villy', handle: '@nencivilly', percentage: '25%', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80' },
    ]
  }, [data?.workspaces])

  return (
    <div className="admin-page-bg">
      <div className="admin-shell-card">
        
        {/* ── LEFT SIDEBAR (WARM IVORY) ── */}
        <aside className="admin-sidebar">
          <div className="sidebar-top">
            
            {/* Brand Header */}
            <Link to="/" className="sidebar-brand">
              <div className="brand-dots">
                <span className="brand-dot brand-dot-1" />
                <span className="brand-dot-2 brand-dot" />
                <span className="brand-dot-3 brand-dot" />
                <span className="brand-dot-4 brand-dot" />
              </div>
              <span className="brand-name">Paper5</span>
            </Link>

            {/* Profile Element */}
            <div className="sidebar-profile">
              <div className="profile-avatar-wrap">
                <img 
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80" 
                  alt="Robert Grant" 
                  className="profile-avatar-img"
                />
              </div>
              <h4 className="profile-name">Robert Grant</h4>
              <p className="profile-role">Platform Director</p>
            </div>

            {/* Navigation Menu */}
            <nav className="sidebar-nav">
              <button 
                type="button"
                className={`sidebar-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <span>Dashboard</span>
                <span className="nav-badge-pill">1</span>
              </button>

              <button 
                type="button"
                className={`sidebar-nav-item ${activeTab === 'live' ? 'active' : ''}`}
                onClick={() => setActiveTab('live')}
              >
                <span>Insights</span>
                {liveCount > 0 && <span className="nav-live-dot" />}
              </button>

              <button 
                type="button"
                className={`sidebar-nav-item ${activeTab === 'reports' ? 'active' : ''}`}
                onClick={() => setActiveTab('reports')}
              >
                <span>Reports</span>
              </button>

              <button 
                type="button"
                className={`sidebar-nav-item ${activeTab === 'workspaces' ? 'active' : ''}`}
                onClick={() => setActiveTab('workspaces')}
              >
                <span>Workspaces</span>
              </button>

              <button 
                type="button"
                className={`sidebar-nav-item ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                <span>Channels</span>
              </button>
            </nav>
          </div>

          {/* Sidebar Footer */}
          <div className="sidebar-footer">
            <button 
              type="button" 
              className="sidebar-logout-btn"
              onClick={() => navigate('/')}
            >
              <LogOut size={16} />
              <span>Log out</span>
            </button>
          </div>
        </aside>

        {/* ── MAIN CONTENT CANVAS ── */}
        <main className="admin-main-canvas">

          {/* Service Key Alert Banner if not set */}
          {!serviceKey && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '10px 16px', borderRadius: '14px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <span>
                🔑 <strong>Supabase RLS Active:</strong> Paste your Service Role Key to view unmasked auth users.
              </span>
              <button 
                type="button"
                onClick={() => { setTempKey(serviceKey); setShowKeyInput(true); }}
                style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#78350f', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                Set Key
              </button>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
             TAB 1: OVERVIEW (THE BEAUTIFUL REFERENCE DESIGN)
             ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <>
              {/* TOP ROW: Header Title + Horizontal KPIs + System Health Arc Card */}
              <div className="top-dashboard-row">
                <div className="top-left-block">
                  <div className="dashboard-title-row">
                    <h1 className="dashboard-main-heading">Dashboard</h1>
                    <span className="header-action-badge">1</span>
                    <button 
                      type="button" 
                      className="header-gear-btn" 
                      onClick={() => { setTempKey(serviceKey); setShowKeyInput(true); }}
                      title="Admin Settings / Service Role Key"
                    >
                      <Settings size={18} />
                    </button>
                  </div>

                  {/* Horizontal KPI Stats Row */}
                  <div className="kpi-strip">
                    <div className="kpi-unit">
                      <div className="kpi-unit-label">
                        <span>Views</span>
                        <span className="kpi-dot kpi-dot-green" />
                      </div>
                      <div className="kpi-unit-value">
                        {loading && !data ? '—' : (summary.totalUsers ? `${(summary.totalUsers * 1.15).toFixed(1)}k` : '27,6m')}
                      </div>
                    </div>

                    <div className="kpi-unit">
                      <div className="kpi-unit-label">
                        <span>Followers</span>
                        <span className="kpi-dot kpi-dot-red" />
                      </div>
                      <div className="kpi-unit-value">
                        {loading && !data ? '—' : (summary.totalUsers ?? '219,3k')}
                      </div>
                    </div>

                    <div className="kpi-unit">
                      <div className="kpi-unit-label">
                        <span>Reposts</span>
                        <span className="kpi-dot kpi-dot-green" />
                      </div>
                      <div className="kpi-unit-value">
                        {loading && !data ? '—' : (summary.totalWorkspaces ? `${summary.totalWorkspaces}` : '1,5k')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Upgrade Your Crowd / System Health Card with Arc Gauge */}
                <div className="upgrade-health-card">
                  <div className="health-card-left">
                    <div className="health-avatar-pill">
                      <ShieldCheck size={14} />
                    </div>
                    <h3 className="health-card-title">Upgrade Your<br />Crowd</h3>
                    <p className="health-card-sub">Pro plan for better results</p>
                  </div>

                  {/* Concentric Arc Gauges */}
                  <div className="arc-gauge-container">
                    <svg width="110" height="75" viewBox="0 0 110 75" style={{ overflow: 'visible' }}>
                      {/* Outer Arc: Cyan/Mint */}
                      <path 
                        d="M 10 70 A 45 45 0 0 1 100 70" 
                        fill="none" 
                        stroke="#56b4a6" 
                        strokeWidth="7" 
                        strokeLinecap="round" 
                      />
                      {/* Middle Arc: Peach/Sand */}
                      <path 
                        d="M 22 70 A 33 33 0 0 1 88 70" 
                        fill="none" 
                        stroke="#f2a387" 
                        strokeWidth="7" 
                        strokeLinecap="round" 
                      />
                      {/* Inner Arc: Dark Slate */}
                      <path 
                        d="M 34 70 A 21 21 0 0 1 76 70" 
                        fill="none" 
                        stroke="#262833" 
                        strokeWidth="7" 
                        strokeLinecap="round" 
                      />
                    </svg>
                    
                    {/* Center Circular "NOW" Button */}
                    <button 
                      type="button" 
                      className="arc-now-button"
                      onClick={() => fetchMetrics()}
                      title="Refresh Telemetry Now"
                    >
                      NOW
                    </button>
                  </div>
                </div>
              </div>

              {/* MIDDLE ROW: Activity Spline Chart (Left) + Top Performers (Right) */}
              <div className="middle-dashboard-grid">
                
                {/* Left 60%: Activity Chart */}
                <div className="activity-card-section">
                  <div className="activity-header">
                    <h2 className="activity-title">Activity</h2>
                    <div className="activity-meta-row">
                      <span className="activity-subtext">Data updates every 3 hours</span>
                      <div className="activity-date-pill">
                        <span>01-07 May</span>
                        <span style={{ fontSize: '10px' }}>▾</span>
                      </div>
                    </div>
                  </div>

                  {/* SVG Line Chart Canvas */}
                  <div className="activity-chart-wrapper">
                    <div className="activity-y-axis">
                      <span>40k</span>
                      <span>30k</span>
                      <span>20k</span>
                      <span>10k</span>
                      <span>0 k</span>
                    </div>

                    <svg className="activity-svg" viewBox="0 0 540 160" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.14" />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Area Fill */}
                      <path 
                        d="M 40 100 Q 80 120, 140 105 T 240 110 T 320 65 T 410 115 T 480 85 T 530 65 L 530 150 L 40 150 Z" 
                        fill="url(#activityGrad)" 
                      />

                      {/* Golden Wave Line */}
                      <path 
                        d="M 40 100 Q 80 120, 140 105 T 240 110 T 320 65 T 410 115 T 480 85 T 530 65" 
                        fill="none" 
                        stroke="#f59e0b" 
                        strokeWidth="3.5" 
                        strokeLinecap="round" 
                      />

                      {/* Marker on Day 05 (Peak Point) */}
                      <circle cx="345" cy="72" r="7.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="3" />
                    </svg>

                    {/* Floating Tooltip Card on Peak Marker */}
                    <div className="activity-tooltip-card">
                      <div className="tooltip-num">32 210</div>
                      <div className="tooltip-sub">Views / hour</div>
                    </div>
                  </div>

                  {/* X-Axis Day Numbers */}
                  <div className="activity-x-axis">
                    <span>01</span>
                    <span>02</span>
                    <span>03</span>
                    <span>04</span>
                    <span>05</span>
                    <span>06</span>
                    <span>07</span>
                  </div>
                </div>

                {/* Right 40%: Top Performers Column */}
                <div className="performers-section">
                  <h3 className="performers-title">Top perfromers</h3>

                  <div className="performers-list">
                    {topPerformers.map((p, idx) => (
                      <div key={idx} className="performer-row">
                        <div className="performer-left">
                          <img src={p.avatar} alt={p.name} className="performer-avatar" />
                          <div className="performer-info">
                            <span className="performer-name">{p.name}</span>
                            <span className="performer-handle">{p.handle}</span>
                          </div>
                        </div>
                        <span className="performer-stat">{p.percentage}</span>
                      </div>
                    ))}
                  </div>

                  <button 
                    type="button" 
                    className="performers-view-more"
                    onClick={() => setActiveTab('workspaces')}
                  >
                    <span>View More</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* BOTTOM SHELF: Channels / Tiers (Mint Green Container) */}
              <div className="channels-shelf-card">
                <div className="channels-intro">
                  <h3 className="channels-title">Channels</h3>
                  <p className="channels-subtext">Your channels statistics for 1 week period.</p>
                </div>

                <div className="channels-deck">
                  {/* Card 1: Dribbble / Starter */}
                  <div className="channel-card-item">
                    <div className="channel-icon-circle icon-pink">
                      🏀
                    </div>
                    <h5 className="channel-card-title">Dribble</h5>
                    <p className="channel-card-handle">@grantart</p>
                    <span className="channel-card-metric">+2 %</span>
                  </div>

                  {/* Card 2: Behance / Team */}
                  <div className="channel-card-item">
                    <div className="channel-icon-circle icon-blue">
                      Bē
                    </div>
                    <h5 className="channel-card-title">Bahance</h5>
                    <p className="channel-card-handle">@grantart</p>
                    <span className="channel-card-metric">-7 %</span>
                  </div>

                  {/* Card 3: Instagram / Scale */}
                  <div className="channel-card-item">
                    <div className="channel-icon-circle icon-orange">
                      📷
                    </div>
                    <h5 className="channel-card-title">Instagram</h5>
                    <p className="channel-card-handle">@robertgrant</p>
                    <span className="channel-card-metric">+4 %</span>
                  </div>

                  {/* Card 4: Pinterest / Enterprise */}
                  <div className="channel-card-item">
                    <div className="channel-icon-circle icon-red">
                      P
                    </div>
                    <h5 className="channel-card-title">Pinterest</h5>
                    <p className="channel-card-handle">@robertgrant</p>
                    <span className="channel-card-metric">+2 %</span>
                  </div>

                  {/* Card 5: Full Stats Accent Button Card */}
                  <button 
                    type="button" 
                    className="full-stats-accent-card"
                    onClick={() => setActiveTab('reports')}
                  >
                    <span className="full-stats-label">Full<br />Stats</span>
                    <div className="full-stats-arrow">
                      <ChevronRight size={16} />
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════
             TAB 2: INSIGHTS / LIVE TELEMETRY
             ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'live' && (
            <div className="table-view-container">
              <div className="table-view-header">
                <div className="table-view-title-group">
                  <button 
                    type="button" 
                    className="back-to-dashboard-btn"
                    onClick={() => setActiveTab('overview')}
                  >
                    <ArrowLeft size={14} />
                    <span>Back to Dashboard</span>
                  </button>
                  <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>Live Telemetry & Real-Time Presence</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 700, background: '#dcfce7', padding: '4px 12px', borderRadius: '100px' }}>
                    🟢 {liveVisitors.length} Active Sessions
                  </span>
                  <button 
                    type="button" 
                    className="table-export-btn"
                    onClick={() => fetchMetrics()}
                  >
                    <RefreshCw size={14} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              <div className="custom-admin-table-wrap">
                <table className="custom-admin-table">
                  <thead>
                    <tr>
                      <th>Visitor / User</th>
                      <th>Current Active Page</th>
                      <th>Device & Browser</th>
                      <th>Traffic Source</th>
                      <th>Connected At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveVisitors.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                          No active real-time sessions currently connected.
                        </td>
                      </tr>
                    ) : (
                      liveVisitors.map((v, i) => (
                        <tr key={i}>
                          <td><strong>{v.email || v.visitorId || `Visitor #${i + 1}`}</strong></td>
                          <td><code>{v.page || '/'}</code></td>
                          <td>{v.device || 'Desktop / WebKit'}</td>
                          <td>{v.referrer || 'Direct Navigation'}</td>
                          <td>{v.connectedAt ? new Date(v.connectedAt).toLocaleTimeString() : 'Just now'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
             TAB 3: USERS / CHANNELS DIRECTORY
             ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'users' && (
            <div className="table-view-container">
              <div className="table-view-header">
                <div className="table-view-title-group">
                  <button 
                    type="button" 
                    className="back-to-dashboard-btn"
                    onClick={() => setActiveTab('overview')}
                  >
                    <ArrowLeft size={14} />
                    <span>Back to Dashboard</span>
                  </button>
                  <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>Registered User Directory ({filteredUsers.length})</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input 
                    type="text" 
                    placeholder="Search by name, email, or ID..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="table-search-input"
                  />
                  <button 
                    type="button" 
                    className="table-export-btn"
                    onClick={() => downloadBlob(convertToCSV(filteredUsers), `paper5_users_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv')}
                  >
                    <Download size={14} />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              <div className="custom-admin-table-wrap">
                <table className="custom-admin-table">
                  <thead>
                    <tr>
                      <th>Account Name</th>
                      <th>Email Address</th>
                      <th>Plan Tier</th>
                      <th>Workspaces</th>
                      <th>Registered</th>
                      <th>Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                          No users matched your query.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.slice(0, 50).map((u) => (
                        <tr key={u.id}>
                          <td><strong>{u.name || 'User'}</strong></td>
                          <td>{u.email}</td>
                          <td>
                            <span className={`tier-tag tier-tag-${u.billing_plan || 'starter'}`}>
                              {u.billing_plan || 'starter'}
                            </span>
                          </td>
                          <td>{u.workspacesCount || 0}</td>
                          <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}</td>
                          <td>{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'N/A'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
             TAB 4: WORKSPACES DIRECTORY
             ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'workspaces' && (
            <div className="table-view-container">
              <div className="table-view-header">
                <div className="table-view-title-group">
                  <button 
                    type="button" 
                    className="back-to-dashboard-btn"
                    onClick={() => setActiveTab('overview')}
                  >
                    <ArrowLeft size={14} />
                    <span>Back to Dashboard</span>
                  </button>
                  <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>Workspaces ({filteredWorkspaces.length})</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input 
                    type="text" 
                    placeholder="Search workspaces or owner..."
                    value={wsSearch}
                    onChange={(e) => setWsSearch(e.target.value)}
                    className="table-search-input"
                  />
                  <button 
                    type="button" 
                    className="table-export-btn"
                    onClick={() => downloadBlob(convertToCSV(filteredWorkspaces), `paper5_workspaces_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv')}
                  >
                    <Download size={14} />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              <div className="custom-admin-table-wrap">
                <table className="custom-admin-table">
                  <thead>
                    <tr>
                      <th>Workspace Name</th>
                      <th>Owner Account</th>
                      <th>Members</th>
                      <th>Active Plan</th>
                      <th>Data Persistence</th>
                      <th>Created Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorkspaces.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                          No workspaces matched your query.
                        </td>
                      </tr>
                    ) : (
                      filteredWorkspaces.slice(0, 50).map((w) => (
                        <tr key={w.id}>
                          <td><strong>{w.name}</strong></td>
                          <td>{w.owner_email}</td>
                          <td>{w.members_count} members</td>
                          <td>
                            <span className={`tier-tag tier-tag-${w.plan || 'starter'}`}>
                              {w.plan || 'starter'}
                            </span>
                          </td>
                          <td>
                            <span style={{ color: w.save_data ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                              {w.save_data ? '✓ Persistent Cloud' : 'Transient Memory'}
                            </span>
                          </td>
                          <td>{w.created_at ? new Date(w.created_at).toLocaleDateString() : 'N/A'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
             TAB 5: REPORTS / DATA EXPORT
             ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'reports' && (
            <div className="table-view-container">
              <div className="table-view-header">
                <div className="table-view-title-group">
                  <button 
                    type="button" 
                    className="back-to-dashboard-btn"
                    onClick={() => setActiveTab('overview')}
                  >
                    <ArrowLeft size={14} />
                    <span>Back to Dashboard</span>
                  </button>
                  <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>Platform Reports & Telemetry Export</h2>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '10px' }}>
                <div style={{ background: '#fbf8f4', padding: '24px', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Users & Accounts Export</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
                    Download complete user roster, plan tiers, registration timestamps, and last login telemetry in CSV format.
                  </p>
                  <button 
                    type="button" 
                    className="table-export-btn"
                    style={{ width: 'fit-content', marginTop: '8px' }}
                    onClick={() => downloadBlob(convertToCSV(data?.users || []), `paper5_users_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv')}
                  >
                    <Download size={14} />
                    <span>Download Users CSV</span>
                  </button>
                </div>

                <div style={{ background: '#fbf8f4', padding: '24px', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Workspaces & Teams Export</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
                    Export full metadata of all created workspaces, member capacities, methodology settings, and ownership mappings.
                  </p>
                  <button 
                    type="button" 
                    className="table-export-btn"
                    style={{ width: 'fit-content', marginTop: '8px' }}
                    onClick={() => downloadBlob(convertToCSV(data?.workspaces || []), `paper5_workspaces_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv')}
                  >
                    <Download size={14} />
                    <span>Download Workspaces CSV</span>
                  </button>
                </div>

                <div style={{ background: '#fbf8f4', padding: '24px', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Complete System JSON Audit</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
                    Raw JSON dump containing all live aggregates, latency benchmarks, plan distributions, and schema metrics.
                  </p>
                  <button 
                    type="button" 
                    className="table-export-btn"
                    style={{ width: 'fit-content', marginTop: '8px' }}
                    onClick={() => downloadBlob(JSON.stringify(data, null, 2), `paper5_telemetry_dump_${new Date().toISOString().slice(0, 10)}.json`, 'application/json')}
                  >
                    <Download size={14} />
                    <span>Download JSON Dump</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── SETTINGS MODAL: SUPABASE SERVICE ROLE KEY ── */}
      {showKeyInput && (
        <div className="admin-modal-overlay" onClick={() => setShowKeyInput(false)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Key size={20} color="#f45b56" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Supabase Service Role Key</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowKeyInput(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '13.5px', color: '#6b7280', lineHeight: 1.6 }}>
              Provide your Supabase Service Role Key to bypass Row-Level Security (RLS) and query all global user and workspace records directly. Stored strictly in your local browser storage.
            </p>

            <input 
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={tempKey}
              onChange={(e) => setTempKey(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                fontSize: '13.5px',
                fontFamily: 'monospace',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setServiceKey('')
                  setTempKey('')
                  localStorage.removeItem('paper5_service_role_key')
                  setShowKeyInput(false)
                  setTimeout(() => fetchMetrics(), 50)
                }}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  background: '#f3f4f6',
                  color: '#4b5563',
                  border: 'none',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Clear Key
              </button>
              <button
                type="button"
                onClick={() => {
                  const k = tempKey.trim()
                  setServiceKey(k)
                  if (k) localStorage.setItem('paper5_service_role_key', k)
                  else localStorage.removeItem('paper5_service_role_key')
                  setShowKeyInput(false)
                  setTimeout(() => fetchMetrics(), 50)
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: '#111827',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Save & Unlock
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
