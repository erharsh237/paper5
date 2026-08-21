import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const host = req.headers.host || ''
  const origin = req.headers.origin || ''
  const referer = req.headers.referer || ''
  const adminKey = req.headers['x-admin-key'] || req.query?.adminKey

  const isLocalhostRequest = 
    host.includes('localhost') || 
    host.includes('127.0.0.1') || 
    origin.includes('localhost') || 
    origin.includes('127.0.0.1') || 
    referer.includes('localhost') || 
    referer.includes('127.0.0.1')

  const validSecret = process.env.ADMIN_SECRET_KEY || 'paper5-superadmin-secret'
  const isAuthorizedSecret = adminKey && adminKey === validSecret

  if (!isLocalhostRequest && !isAuthorizedSecret) {
    return res.status(403).json({
      success: false,
      error: 'Access Denied: Internal telemetry console is restricted strictly to local server execution.'
    })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://sdbglndhjkqhkphzqmum.supabase.co'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const activeKey = serviceKey || anonKey

  if (!activeKey) {
    return res.status(500).json({ error: 'Supabase credentials missing' })
  }

  const supabaseAdmin = createClient(supabaseUrl, activeKey)
  const startTime = Date.now()

  try {
    // 1. Fetch Users Data (from public.users and auth.admin if available)
    let authUsersList = []
    if (serviceKey && typeof supabaseAdmin.auth?.admin?.listUsers === 'function') {
      try {
        const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
        authUsersList = authData?.users || []
      } catch (e) {
        console.warn('Auth admin list warning:', e.message)
      }
    }

    const { data: publicUsers, count: publicUsersCount } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // 2. Fetch Workspaces Data
    const { data: workspaces, count: workspacesCount } = await supabaseAdmin
      .from('workspaces')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // 3. Fetch Workspace Members
    const { data: workspaceMembers } = await supabaseAdmin
      .from('workspace_members')
      .select('*')

    // 4. Fetch Deadlines / Tasks
    const { data: deadlines, count: deadlinesCount } = await supabaseAdmin
      .from('deadlines')
      .select('id, workspace_id, status, priority, created_at, due_date', { count: 'exact' })

    // 5. Fetch Sprints
    const { data: sprints, count: sprintsCount } = await supabaseAdmin
      .from('sprints')
      .select('id, workspace_id, status, start_date, end_date', { count: 'exact' })

    // 6. Fetch Invites
    const { data: invites, count: invitesCount } = await supabaseAdmin
      .from('invites')
      .select('id, workspace_id, email, role, created_at', { count: 'exact' })

    const latencyMs = Date.now() - startTime

    // ── Build Enriched Telemetry ──────────────────────────────────────────

    // Combine Auth & Public Users
    const userMap = new Map()

    for (const au of authUsersList) {
      userMap.set(au.id, {
        id: au.id,
        email: au.email,
        name: au.user_metadata?.full_name || au.user_metadata?.name || (au.email ? au.email.split('@')[0] : 'User'),
        created_at: au.created_at,
        last_sign_in_at: au.last_sign_in_at,
        confirmed_at: au.email_confirmed_at || au.confirmed_at,
        provider: au.app_metadata?.provider || 'email',
        workspacesCount: 0,
        workspaces: []
      })
    }

    for (const pu of (publicUsers || [])) {
      const existing = userMap.get(pu.id) || {}
      userMap.set(pu.id, {
        ...existing,
        id: pu.id,
        email: pu.email || existing.email,
        name: pu.full_name || pu.name || existing.name || (pu.email ? pu.email.split('@')[0] : 'User'),
        created_at: pu.created_at || existing.created_at,
        billing_plan_id: pu.billing_plan_id || 'free',
        billing_status: pu.billing_status || 'active',
        workspacesCount: existing.workspacesCount || 0,
        workspaces: existing.workspaces || []
      })
    }

    // Map Workspaces to Users
    const wsMemberCountMap = {}
    for (const wm of (workspaceMembers || [])) {
      wsMemberCountMap[wm.workspace_id] = (wsMemberCountMap[wm.workspace_id] || 0) + 1
      if (userMap.has(wm.user_id)) {
        const u = userMap.get(wm.user_id)
        u.workspacesCount += 1
        const wsObj = (workspaces || []).find(w => w.id === wm.workspace_id)
        if (wsObj) u.workspaces.push({ id: wsObj.id, name: wsObj.name, role: wm.role })
      }
    }

    const allUsersList = Array.from(userMap.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))

    // Time calculations (24h, 7d, 30d)
    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

    const signupsLast24h = allUsersList.filter(u => new Date(u.created_at).getTime() > oneDayAgo).length
    const signupsLast7d = allUsersList.filter(u => new Date(u.created_at).getTime() > sevenDaysAgo).length
    const signupsLast30d = allUsersList.filter(u => new Date(u.created_at).getTime() > thirtyDaysAgo).length

    const activeUsers24h = allUsersList.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() > oneDayAgo).length
    const activeUsers7d = allUsersList.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() > sevenDaysAgo).length

    // Plan breakdown
    const planCounts = { free: 0, starter: 0, team: 0, scale: 0 }
    for (const w of (workspaces || [])) {
      const plan = (w.billing_plan_id || w.subscription_tier || 'starter').toLowerCase()
      if (planCounts[plan] !== undefined) planCounts[plan] += 1
      else planCounts.starter += 1
    }

    // Task breakdown
    const completedTasks = (deadlines || []).filter(d => d.status === 'done').length
    const inProgressTasks = (deadlines || []).filter(d => d.status === 'in_progress').length
    const activeTasks = (deadlines || []).filter(d => d.status !== 'done').length

    // Location / Country Telemetry from Request Headers
    const clientCountry = req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || 'Local / Unknown'
    const clientCity = req.headers['x-vercel-ip-city'] || 'Localhost'
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1'

    // Enriched Workspaces Table
    const enrichedWorkspaces = (workspaces || []).map(w => {
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

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      latencyMs,
      summary: {
        totalUsers: allUsersList.length,
        totalWorkspaces: workspacesCount || (workspaces || []).length,
        totalDeadlines: deadlinesCount || (deadlines || []).length,
        totalSprints: sprintsCount || (sprints || []).length,
        totalInvites: invitesCount || (invites || []).length,
        signupsLast24h,
        signupsLast7d,
        signupsLast30d,
        activeUsers24h,
        activeUsers7d,
        completedTasks,
        inProgressTasks,
        activeTasks
      },
      planDistribution: planCounts,
      trafficTelemetry: {
        detectedCountry: clientCountry,
        detectedCity: clientCity,
        detectedIp: clientIp.split(',')[0],
        serverRegion: process.env.VERCEL_REGION || 'edge-local',
        databaseLatency: `${latencyMs}ms`,
        status: 'healthy'
      },
      users: allUsersList,
      workspaces: enrichedWorkspaces
    })
  } catch (err) {
    console.error('Admin metrics error:', err)
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to generate metrics telemetry'
    })
  }
}
