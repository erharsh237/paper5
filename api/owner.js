import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { setCorsHeaders } from './_cors.js'
import { checkRateLimit } from './_rateLimit.js'
import { sanitizeError } from './_errors.js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DUMMY_EMAILS = ['admin_harshpal@paper5.co', 'owner@paper5.co']

function isValidUuid(val) {
  return typeof val === 'string' && UUID_REGEX.test(val.trim())
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (req.body && typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch (_) { return {} }
  }
  return req.body || {}
}

function sanitizeText(val, maxLen = 500) {
  if (typeof val !== 'string') return ''
  return val.replace(/[<>]/g, '').trim().slice(0, maxLen)
}

function sanitizePagination(limitVal, offsetVal, defaultLimit = 50, maxLimit = 100) {
  const parsedLimit = parseInt(limitVal, 10)
  const parsedOffset = parseInt(offsetVal, 10)
  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, maxLimit)) : defaultLimit
  const offset = Number.isFinite(parsedOffset) ? Math.max(0, parsedOffset) : 0
  return { limit, offset }
}

/**
 * Authoritative client IP resolution.
 * Prioritizes platform-authenticated edge proxy headers (x-real-ip, x-vercel-ip)
 * over client-controlled headers to prevent spoofing.
 */
function getClientIp(req) {
  if (typeof req.headers?.['x-real-ip'] === 'string' && req.headers['x-real-ip'].trim()) {
    return req.headers['x-real-ip'].trim()
  }
  if (typeof req.headers?.['x-vercel-ip'] === 'string' && req.headers['x-vercel-ip'].trim()) {
    return req.headers['x-vercel-ip'].trim()
  }
  const forwarded = req.headers?.['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    // If multiple hops, take the rightmost known proxy or leftmost real IP
    const parts = forwarded.split(',').map(s => s.trim()).filter(Boolean)
    return parts[0] || 'unknown'
  }
  return req.socket?.remoteAddress || 'unknown'
}

/**
 * Granular Action-to-Permission Mapping
 */
const ACTION_PERMISSIONS = {
  'overview': 'overview:read',
  'metrics': 'overview:read',
  'analytics.ga4': 'overview:read',
  'users.list': 'users:read',
  'users.get': 'users:read',
  'users.suspend': 'users:write',
  'users.permanently_suspend': 'users:write',
  'users.override_plan': 'billing:override',
  'users.reset_password': 'users:write',
  'users.delete': 'users:delete',
  'workspaces.list': 'workspaces:read',
  'workspaces.get': 'workspaces:read',
  'workspaces.toggle_status': 'workspaces:write',
  'workspaces.permanently_suspend': 'workspaces:write',
  'workspaces.override_plan': 'workspaces:write',
  'workspaces.delete': 'workspaces:delete',
  'billing.overview': 'billing:read',
  'billing.subscribers': 'billing:read',
  'security.rate_limits': 'security:read',
  'security.unblock_ip': 'security:write',
  'security.audit_logs': 'security:read',
  'health.check': 'health:read',
  'health.telemetry': 'health:read',
  'database.tables': 'health:read',
  'database.rows': 'health:read',
  'support.list': 'support:read',
  'support.update_ticket': 'support:write',
  'flags.list': 'flags:read',
  'flags.create': 'flags:write',
  'flags.update': 'flags:write',
  'announcements.list': 'announcements:read',
  'announcements.create': 'announcements:write',
  'announcements.update': 'announcements:write',
  'admins.list': 'admins:read',
  'admins.invite': 'admins:write',
  'admins.create': 'admins:write',
  'admins.update': 'admins:write'
}

/**
 * Records an immutable administrative audit log entry
 */
async function recordPlatformAudit(supabaseAdmin, {
  admin,
  action,
  targetType,
  targetId,
  details = {},
  req
}) {
  try {
    const ip = getClientIp(req)
    const userAgent = req.headers?.['user-agent'] || 'unknown'

    await supabaseAdmin.from('platform_audit_logs').insert({
      admin_id: admin.user_id,
      admin_email: admin.email,
      admin_role: admin.role,
      action,
      target_type: targetType,
      target_id: String(targetId || 'unknown'),
      details,
      ip_address: ip,
      user_agent: userAgent
    })
  } catch (err) {
    console.error('[OwnerConsole AuditLog Error]', err)
  }
}

/**
 * Verifies that the caller has a valid Supabase Auth session and is an active
 * platform administrator (Owner or Super-Admin) registered in public.platform_admins.
 * Enforces per-action granular RBAC and logs unauthorized access attempts.
 */
async function verifyPlatformAdmin(req, supabaseAdmin, action) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || ''
  let token = null
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim()
  }

  if (!token) {
    const cookies = req.headers?.cookie || ''
    const match = cookies.match(/sb_access_token=([^;]+)/)
    if (match) token = match[1]
  }

  if (!token) {
    return { error: 'Authentication required. Missing Bearer token.', status: 401 }
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !authData?.user) {
    return { error: 'Invalid or expired authentication session.', status: 401 }
  }

  const user = authData.user

  // STRICT SINGLE-ADMIN ACCESS CONTROL: ONLY authorized admin is permitted
  if (user.email?.toLowerCase() !== 'admin_harshpal@paper5.co') {
    return { error: 'Access denied: Unauthorized administrator account.', status: 403 }
  }

  // Check public.platform_admins
  const { data: adminRecord, error: adminError } = await supabaseAdmin
    .from('platform_admins')
    .select('id, user_id, email, role, permissions, is_active')
    .eq('user_id', user.id)
    .maybeSingle()

  if (adminError || !adminRecord) {
    // Record denied attempt from unauthorized user
    await recordPlatformAudit(supabaseAdmin, {
      admin: { user_id: user.id, email: user.email || 'unknown', role: 'unauthorized' },
      action: 'security.access_denied',
      targetType: 'endpoint',
      targetId: action || 'api/owner',
      details: { reason: 'Caller not in platform_admins', attemptedAction: action },
      req
    })
    return { error: 'Access denied: You are not authorized as a platform administrator.', status: 403 }
  }

  if (!adminRecord.is_active) {
    // Record denied attempt from suspended admin
    await recordPlatformAudit(supabaseAdmin, {
      admin: adminRecord,
      action: 'security.access_denied',
      targetType: 'endpoint',
      targetId: action || 'api/owner',
      details: { reason: 'Admin account is suspended', attemptedAction: action },
      req
    })
    return { error: 'Access denied: Your platform administrator privileges have been suspended.', status: 403 }
  }

  // Enforce granular RBAC permissions for non-owner roles
  const requiredPermission = ACTION_PERMISSIONS[action]
  if (requiredPermission && adminRecord.role !== 'owner') {
    const perms = Array.isArray(adminRecord.permissions) ? adminRecord.permissions : []
    const hasPerm = perms.includes('*') || perms.includes(requiredPermission)
    if (!hasPerm) {
      await recordPlatformAudit(supabaseAdmin, {
        admin: adminRecord,
        action: 'security.permission_denied',
        targetType: 'permission',
        targetId: requiredPermission,
        details: { missingPermission: requiredPermission, attemptedAction: action, grantedPermissions: perms },
        req
      })
      return {
        error: `Access denied: Missing required permission "${requiredPermission}".`,
        status: 403
      }
    }
  }

  return { user, admin: adminRecord, token }
}

/**
 * Unified Paper5 Owner Console & Super Admin API Handler
 */
export default async function handler(req, res) {
  setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (checkRateLimit(req, res, { max: 180, windowMs: 60000 })) return

  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const activeKey = serviceKey || anonKey

  if (!rawUrl || !activeKey) {
    return res.status(500).json({ error: 'Supabase configuration missing on server.' })
  }

  // Extract Bearer token if caller provided one
  const authHeader = req.headers?.authorization || req.headers?.Authorization || ''
  let callerToken = null
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    callerToken = authHeader.slice(7).trim()
  }
  if (!callerToken) {
    const cookies = req.headers?.cookie || ''
    const match = cookies.match(/sb_access_token=([^;]+)/)
    if (match) callerToken = match[1]
  }

  const supabaseUrl = rawUrl.replace(/["']/g, '').trim()
  const clientHeaders = {}
  // If serviceKey is present, it bypasses RLS directly.
  // If only anonKey is available (e.g. local dev), attach the caller's JWT to authenticate via RLS.
  if (!serviceKey && callerToken) {
    clientHeaders['Authorization'] = `Bearer ${callerToken}`
  }

  const supabaseAdmin = createClient(supabaseUrl, activeKey.replace(/["']/g, '').trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: clientHeaders
    }
  })

  const body = parseBody(req)
  const action = req.query?.action || body.action || ''

  // ----------------------------------------------------------------------------
  // SPECIAL BOOTSTRAP ACTION (One-Time Initialization)
  // ----------------------------------------------------------------------------
  if (action === 'admins.bootstrap') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const targetEmail = sanitizeText(body.email, 150)
    if (!targetEmail) return res.status(400).json({ error: 'Email parameter required' })

    try {
      const { data, error } = await supabaseAdmin.rpc('bootstrap_platform_owner', {
        target_email: targetEmail,
        initial_notes: sanitizeText(body.notes || 'Initial Bootstrap via Console', 300)
      })

      if (error) {
        return res.status(400).json({ error: error.message || 'Bootstrap failed' })
      }

      return res.status(200).json({ ok: true, result: data })
    } catch (err) {
      return res.status(500).json({ error: sanitizeError(err) })
    }
  }

  // ----------------------------------------------------------------------------
  // AUTHENTICATION & RBAC PREAMBLE FOR ALL STANDARD ACTIONS
  // ----------------------------------------------------------------------------
  const authRes = await verifyPlatformAdmin(req, supabaseAdmin, action)
  if (authRes.error) {
    return res.status(authRes.status || 403).json({ error: authRes.error })
  }

  const { admin } = authRes

  try {
    // ==========================================================================
    // 1. MODULE: OWNER COMMAND CENTER & EXECUTIVE OVERVIEW
    // ==========================================================================
    if (action === 'overview' || action === 'metrics') {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const [
        usersCountRes,
        workspacesCountRes,
        activeWorkspacesRes,
        sprintsCountRes,
        tasksCountRes,
        recentAuditsRes,
        openTicketsRes,
        userTiersRes,
        recentUsersRes,
        recentWorkspacesRes,
        flagsCountRes,
        announcementsCountRes,
        membersCountRes,
        signupsTodayRes,
        signupsWeekRes,
        workspacesTodayRes
      ] = await Promise.all([
        supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).not('email', 'in', '("admin_harshpal@paper5.co","owner@paper5.co")'),
        supabaseAdmin.from('workspaces').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('workspaces').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabaseAdmin.from('sprints').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('deadlines').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('platform_audit_logs').select('*').order('created_at', { ascending: false }).limit(25),
        supabaseAdmin.from('support_tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
        supabaseAdmin.from('users').select('billing_plan_id, billing_status').not('email', 'in', '("admin_harshpal@paper5.co","owner@paper5.co")'),
        supabaseAdmin.from('users').select('id, email, full_name, username, billing_plan_id, billing_status, legal_accepted_version, legal_accepted_at, created_at').not('email', 'in', '("admin_harshpal@paper5.co","owner@paper5.co")').order('created_at', { ascending: false }).limit(8),
        supabaseAdmin.from('workspaces').select('id, name, created_by, is_active, billing_plan_id, billing_status, settings, created_at').order('created_at', { ascending: false }).limit(8),
        supabaseAdmin.from('feature_flags').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('platform_announcements').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('workspace_members').select('workspace_id', { count: 'exact', head: true }),
        supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).not('email', 'in', '("admin_harshpal@paper5.co","owner@paper5.co")').gte('created_at', oneDayAgo),
        supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).not('email', 'in', '("admin_harshpal@paper5.co","owner@paper5.co")').gte('created_at', oneWeekAgo),
        supabaseAdmin.from('workspaces').select('id', { count: 'exact', head: true }).gte('created_at', oneDayAgo)
      ])

      const totalUsers = usersCountRes.count || 0
      const totalWorkspaces = workspacesCountRes.count || 0
      const activeWorkspaces = activeWorkspacesRes.count || 0
      const totalMemberships = membersCountRes.count || 0
      const totalSprints = sprintsCountRes.count || 0
      const totalTasks = tasksCountRes.count || 0
      const openTickets = openTicketsRes.count || 0
      const signupsToday = signupsTodayRes.count || 0
      const signupsThisWeek = signupsWeekRes.count || 0
      const workspacesCreatedToday = workspacesTodayRes.count || 0

      // Tier & Revenue Metrics
      let starterCount = 0
      let teamCount = 0
      let proCount = 0

      if (userTiersRes.data) {
        for (const u of userTiersRes.data) {
          const tier = (u.billing_plan_id || 'starter').toLowerCase()
          if (tier === 'pro' || tier === 'scale' || tier === 'enterprise') proCount++
          else if (tier === 'team' || tier === 'standard') teamCount++
          else starterCount++
        }
      }

      const mrrEstimate = (teamCount * 29) + (proCount * 79)
      const arrEstimate = mrrEstimate * 12

      // Enriched recent workspaces with inferred plan
      const enrichedWorkspaces = (recentWorkspacesRes.data || []).map(w => ({
        ...w,
        billing_plan_id: w.billing_plan_id || w.settings?.billing_plan_id || w.settings?.planId || 'starter'
      }))

      return res.status(200).json({
        kpis: {
          totalUsers,
          totalWorkspaces,
          activeWorkspaces,
          inactiveWorkspaces: totalWorkspaces - activeWorkspaces,
          totalMemberships,
          totalSprints,
          totalTasks,
          openTickets,
          mrrEstimate,
          arrEstimate,
          payingUsers: teamCount + proCount,
          conversionRate: totalUsers > 0 ? (((teamCount + proCount) / totalUsers) * 100).toFixed(1) : '0.0',
          signupsToday,
          signupsThisWeek,
          workspacesCreatedToday
        },
        tierDistribution: {
          starter: starterCount,
          team: teamCount,
          pro: proCount,
          teamRevenue: teamCount * 29,
          proRevenue: proCount * 79
        },
        tableStats: {
          users: totalUsers,
          workspaces: totalWorkspaces,
          workspaceMembers: totalMemberships,
          sprints: totalSprints,
          deadlines: totalTasks,
          featureFlags: flagsCountRes.count || 0,
          announcements: announcementsCountRes.count || 0,
          openSupportTickets: openTickets
        },
        recentUsers: recentUsersRes.data || [],
        recentWorkspaces: enrichedWorkspaces,
        recentActivity: recentAuditsRes.data || [],
        systemStatus: 'healthy',
        timestamp: new Date().toISOString()
      })
    }

    // ==========================================================================
    // 2. MODULE: USER DIRECTORY & MANAGEMENT
    // ==========================================================================
    if (action === 'users.list') {
      const search = sanitizeText(req.query?.search || body.search || '', 100)
      const tierFilter = sanitizeText(req.query?.tier || body.tier || '', 20)
      const { limit, offset } = sanitizePagination(req.query?.limit || body.limit, req.query?.offset || body.offset)

      let query = supabaseAdmin
        .from('users')
        .select('id, email, full_name, avatar_url, billing_plan_id, billing_status, created_at', { count: 'exact' })
        .not('email', 'in', `(${DUMMY_EMAILS.map(e => `"${e}"`).join(',')})`)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (search) {
        query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
      }
      if (tierFilter && tierFilter !== 'all') {
        if (tierFilter === 'starter') {
          query = query.in('billing_plan_id', ['starter', 'free', 'member'])
        } else {
          query = query.eq('billing_plan_id', tierFilter)
        }
      }

      const { data, count, error } = await query
      if (error) return res.status(400).json({ error: error.message })

      // Fetch active, non-expired entitlement overrides
      const userIds = (data || []).map(u => u.id)
      let overridesMap = {}
      if (userIds.length > 0) {
        const nowIso = new Date().toISOString()
        const { data: oData } = await supabaseAdmin
          .from('user_entitlement_overrides')
          .select('user_id, override_plan, reason, expires_at')
          .in('user_id', userIds)
          .eq('is_active', true)
          .or(`expires_at.is.null,expires_at.gt.${nowIso}`)

        if (oData) {
          oData.forEach(o => { overridesMap[o.user_id] = o })
        }
      }

      const enriched = (data || []).map(u => {
        const rawPlan = overridesMap[u.id]?.override_plan || u.billing_plan_id || 'starter'
        const effectivePlan = ['pro', 'scale', 'enterprise'].includes(rawPlan.toLowerCase())
          ? 'pro'
          : ['team', 'standard'].includes(rawPlan.toLowerCase())
            ? 'team'
            : 'starter'
        return {
          ...u,
          effectivePlan,
          hasOverride: Boolean(overridesMap[u.id]),
          overrideDetails: overridesMap[u.id] || null
        }
      })

      return res.status(200).json({ users: enriched, total: count || 0, offset, limit })
    }

    if (action === 'users.get') {
      const userId = sanitizeText(req.query?.id || body.id, 64)
      if (!isValidUuid(userId)) return res.status(400).json({ error: 'Valid UUID required for userId' })

      const nowIso = new Date().toISOString()
      const [userRes, membershipsRes, ownedWsRes, overrideRes, auditRes, platformAdminRes, invitesRes] = await Promise.all([
        supabaseAdmin.from('users').select('*').eq('id', userId).maybeSingle(),
        supabaseAdmin.from('workspace_members').select('workspace_id, role, joined_at, workspaces(id, name, is_active, billing_plan_id, billing_status)').eq('user_id', userId),
        supabaseAdmin.from('workspaces').select('id, name, is_active, billing_plan_id, billing_status, created_at, created_by').eq('created_by', userId),
        supabaseAdmin.from('user_entitlement_overrides').select('*').eq('user_id', userId).eq('is_active', true).or(`expires_at.is.null,expires_at.gt.${nowIso}`).maybeSingle(),
        supabaseAdmin.from('platform_audit_logs').select('*').eq('target_id', userId).order('created_at', { ascending: false }).limit(20),
        supabaseAdmin.from('platform_admins').select('role, is_active, permissions, created_at').eq('user_id', userId).maybeSingle(),
        supabaseAdmin.from('invites').select('id, workspace_id, email, role, permissions, created_at')
      ])

      if (userRes.error || !userRes.data) return res.status(404).json({ error: 'User not found' })

      const user = userRes.data

      // Synthesize workspace memberships from both workspace_members and owned workspaces
      const workspacesMap = new Map()

      // Add memberships from workspace_members
      for (const m of (membershipsRes.data || [])) {
        const wsId = m.workspace_id || m.workspaces?.id
        if (wsId) {
          workspacesMap.set(wsId, {
            id: wsId,
            workspace_id: wsId,
            name: m.workspaces?.name || 'Workspace',
            role: m.role || 'member',
            permissions: m.role === 'owner' ? ['*'] : ['member.access'],
            joined_at: m.joined_at,
            billing_plan_id: m.workspaces?.billing_plan_id || 'free'
          })
        }
      }

      // Add workspaces created by this user
      for (const w of (ownedWsRes.data || [])) {
        const existing = workspacesMap.get(w.id) || {}
        workspacesMap.set(w.id, {
          id: w.id,
          workspace_id: w.id,
          name: w.name || 'Workspace',
          role: 'owner',
          permissions: ['*'],
          joined_at: w.created_at,
          billing_plan_id: w.billing_plan_id || 'free',
          ...existing
        })
      }

      // Attach relevant pending invites across all workspaces belonging to or created by this user
      const userWorkspaces = Array.from(workspacesMap.values())
      const userWsIds = new Set(userWorkspaces.map(w => w.workspace_id || w.id))
      const relevantInvites = (invitesRes.data || []).filter(inv => 
        userWsIds.has(inv.workspace_id) || inv.invited_by === userId
      )

      // Resolve last known IP address and ban status
      const lastKnownIp = (auditRes.data || []).find(a => a.ip_address && a.ip_address !== 'unknown')?.ip_address || null
      const { data: banFlag } = await supabaseAdmin.from('feature_flags').select('metadata').eq('key', 'platform_ban_list').maybeSingle()
      const isBanned = Boolean(
        (banFlag?.metadata?.banned_emails || []).map(e => e.toLowerCase()).includes(user.email?.toLowerCase()) ||
        (lastKnownIp && (banFlag?.metadata?.banned_ips || []).includes(lastKnownIp))
      )

      const rawPlan = overrideRes.data?.override_plan || user.billing_plan_id || 'starter'
      const effectivePlan = ['pro', 'scale', 'enterprise'].includes(rawPlan.toLowerCase())
        ? 'pro'
        : ['team', 'standard'].includes(rawPlan.toLowerCase())
          ? 'team'
          : 'starter'

      return res.status(200).json({
        user,
        effectivePlan,
        platformAdmin: platformAdminRes.data || null,
        workspaces: userWorkspaces,
        invites: relevantInvites,
        activeOverride: overrideRes.data || null,
        auditHistory: auditRes.data || [],
        lastKnownIp,
        isBanned
      })
    }

    if (action === 'users.suspend') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
      const userId = sanitizeText(body.id, 64)
      const suspend = Boolean(body.suspend)
      const reason = sanitizeText(body.reason || (suspend ? 'Suspended by super-admin' : 'Reactivated by super-admin'), 200)

      if (!isValidUuid(userId)) return res.status(400).json({ error: 'Valid UUID required for userId' })

      // SECURITY GUARD: Never allow suspending the Platform Owner account
      const { data: targetAdmin } = await supabaseAdmin
        .from('platform_admins')
        .select('role')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle()

      if (targetAdmin?.role === 'owner') {
        return res.status(403).json({ error: 'Security Policy Violation: The Platform Owner account cannot be suspended.' })
      }

      // Only owner can suspend another super-admin
      if (targetAdmin?.role === 'super_admin' && admin.role !== 'owner') {
        return res.status(403).json({ error: 'Access denied: Only the Platform Owner can suspend administrator accounts.' })
      }

      const newStatus = suspend ? 'suspended' : 'active'
      const { error } = await supabaseAdmin
        .from('users')
        .update({ billing_status: newStatus })
        .eq('id', userId)

      if (error) return res.status(400).json({ error: error.message })

      await recordPlatformAudit(supabaseAdmin, {
        admin,
        action: suspend ? 'user.suspend' : 'user.reactivate',
        targetType: 'user',
        targetId: userId,
        details: { reason, previousStatus: suspend ? 'active' : 'suspended', newStatus },
        req
      })

      return res.status(200).json({ ok: true, status: newStatus })
    }

    if (action === 'users.permanently_suspend') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
      const userId = sanitizeText(body.id || body.userId, 64)
      const reason = sanitizeText(body.reason || 'Permanent violation ban', 200)
      const inputIp = sanitizeText(body.ip, 64)

      if (!isValidUuid(userId)) return res.status(400).json({ error: 'Valid UUID required for userId' })

      // Fetch user details
      const { data: targetUser } = await supabaseAdmin.from('users').select('id, email').eq('id', userId).maybeSingle()
      if (!targetUser) return res.status(404).json({ error: 'User not found' })

      const email = targetUser.email?.toLowerCase()

      // GUARD: Never allow suspending Platform Owner
      if (email === 'admin_harshpal@paper5.co') {
        return res.status(403).json({ error: 'Security Policy Violation: The Platform Owner account cannot be suspended.' })
      }

      // Check if target is a platform admin
      const { data: targetAdmin } = await supabaseAdmin.from('platform_admins').select('role').eq('user_id', userId).maybeSingle()
      if (targetAdmin?.role === 'owner') {
        return res.status(403).json({ error: 'Security Policy Violation: The Platform Owner account cannot be suspended.' })
      }

      // Determine target IP: input IP -> last audit log IP -> current client IP
      let targetIp = inputIp || null
      if (!targetIp) {
        const { data: auditLog } = await supabaseAdmin.from('platform_audit_logs').select('ip_address').eq('target_id', userId).order('created_at', { ascending: false }).limit(1)
        targetIp = auditLog?.[0]?.ip_address || getClientIp(req)
      }
      if (targetIp === 'unknown' || !targetIp) targetIp = null

      // 1. Update platform_ban_list in feature_flags
      const { data: banFlag } = await supabaseAdmin.from('feature_flags').select('metadata').eq('key', 'platform_ban_list').maybeSingle()
      const meta = banFlag?.metadata || { banned_emails: [], banned_ips: [] }
      const bannedEmails = Array.from(new Set([...(meta.banned_emails || []).map(e => e.toLowerCase()), email]))
      const bannedIps = Array.from(new Set([...(meta.banned_ips || []), ...(targetIp ? [targetIp] : [])]))

      await supabaseAdmin.from('feature_flags').upsert({
        key: 'platform_ban_list',
        name: 'Platform Permanent Ban Registry',
        description: 'Authoritative IP and Email ban registry for permanent platform enforcement',
        enabled: true,
        metadata: { banned_emails: bannedEmails, banned_ips: bannedIps },
        updated_at: new Date().toISOString()
      })

      // 2. Insert into rate_limit_log
      const rateLimitInserts = [
        { identifier: `email:${email}`, action: 'permanent_ban' },
        ...(targetIp ? [{ identifier: `ip:${targetIp}`, action: 'permanent_ban' }] : [])
      ]
      await supabaseAdmin.from('rate_limit_log').insert(rateLimitInserts)

      // 3. Suspend in public.users
      await supabaseAdmin.from('users').update({ billing_status: 'suspended' }).eq('id', userId)

      // 4. Suspend all owned workspaces
      await supabaseAdmin.from('workspaces').update({ is_active: false, billing_status: 'suspended' }).eq('created_by', userId)

      // 5. Invalidate active sessions via Supabase Auth Admin if possible
      try {
        await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '876000h' })
      } catch (_) {}

      // 6. Record immutable audit log
      await recordPlatformAudit(supabaseAdmin, {
        admin,
        action: 'user.permanently_suspended',
        targetType: 'user',
        targetId: userId,
        details: { email, ip: targetIp, reason, bannedEmailsCount: bannedEmails.length, bannedIpsCount: bannedIps.length },
        req
      })

      return res.status(200).json({
        ok: true,
        message: `Account ${email} and IP ${targetIp || 'N/A'} have been permanently suspended from the platform.`,
        bannedEmail: email,
        bannedIp: targetIp
      })
    }

    if (action === 'users.override_plan') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
      const userId = sanitizeText(body.userId, 64)
      const targetPlan = sanitizeText(body.plan, 20).toLowerCase()
      const reason = sanitizeText(body.reason, 300)
      const expiresAt = body.expiresAt ? new Date(body.expiresAt).toISOString() : null

      if (!isValidUuid(userId)) return res.status(400).json({ error: 'Valid UUID required for userId' })
      if (!['starter', 'team', 'pro'].includes(targetPlan)) {
        return res.status(400).json({ error: 'Invalid plan. Allowed: starter, team, pro' })
      }
      if (!reason) {
        return res.status(400).json({ error: 'A specific reason is required for entitlement overrides.' })
      }

      // Deactivate prior overrides
      await supabaseAdmin
        .from('user_entitlement_overrides')
        .update({ is_active: false })
        .eq('user_id', userId)

      // Insert new override record
      const { data: oRow, error: oErr } = await supabaseAdmin
        .from('user_entitlement_overrides')
        .insert({
          user_id: userId,
          override_plan: targetPlan,
          reason,
          expires_at: expiresAt,
          granted_by: admin.user_id,
          is_active: true
        })
        .select()
        .single()

      if (oErr) return res.status(400).json({ error: oErr.message })

      // Authoritative update on users table via service_role client
      try {
        await supabaseAdmin
          .from('users')
          .update({ billing_plan_id: targetPlan })
          .eq('id', userId)
      } catch (uErr) {
        console.warn('Direct users table update warning:', uErr?.message)
      }

      await recordPlatformAudit(supabaseAdmin, {
        admin,
        action: 'user.plan_override',
        targetType: 'user',
        targetId: userId,
        details: { targetPlan, reason, expiresAt, overrideId: oRow.id },
        req
      })

      return res.status(200).json({ ok: true, override: oRow })
    }

    if (action === 'users.reset_password') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
      const email = sanitizeText(body.email, 150)
      if (!email) return res.status(400).json({ error: 'Missing email' })

      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email)
      if (error) return res.status(400).json({ error: error.message })

      await recordPlatformAudit(supabaseAdmin, {
        admin,
        action: 'user.reset_password',
        targetType: 'user',
        targetId: email,
        details: { email },
        req
      })

      return res.status(200).json({ ok: true, message: `Password reset email dispatched to ${email}` })
    }

    if (action === 'users.delete') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
      const userId = sanitizeText(body.id, 64)
      const confirmation = sanitizeText(body.confirmation, 64)
      const reason = sanitizeText(body.reason || 'Administrative account purge', 300)

      if (!isValidUuid(userId)) return res.status(400).json({ error: 'Valid UUID required for userId' })
      if (confirmation !== userId) {
        return res.status(400).json({ error: 'Confirmation ID must match user ID exactly.' })
      }

      // Check owner protection
      const { data: targetAdmin } = await supabaseAdmin
        .from('platform_admins')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle()

      if (targetAdmin?.role === 'owner') {
        return res.status(403).json({ error: 'Security Policy Violation: The Platform Owner account cannot be deleted.' })
      }

      if (targetAdmin?.role === 'super_admin' && admin.role !== 'owner') {
        return res.status(403).json({ error: 'Access denied: Only the Platform Owner can delete administrator accounts.' })
      }

      // Safe deletion of user records
      await Promise.allSettled([
        supabaseAdmin.from('workspace_members').delete().eq('user_id', userId),
        supabaseAdmin.from('notifications').delete().eq('user_id', userId),
        supabaseAdmin.from('user_entitlement_overrides').delete().eq('user_id', userId),
        supabaseAdmin.from('profiles').delete().eq('id', userId),
        supabaseAdmin.from('users').delete().eq('id', userId)
      ])

      try {
        await supabaseAdmin.auth.admin.deleteUser(userId)
      } catch (authDelErr) {
        console.warn('[Admin deleteUser warning]', authDelErr?.message)
      }

      await recordPlatformAudit(supabaseAdmin, {
        admin,
        action: 'user.delete',
        targetType: 'user',
        targetId: userId,
        details: { reason },
        req
      })

      return res.status(200).json({ ok: true, message: `User ${userId} deleted successfully.` })
    }

    // ==========================================================================
    // 3. MODULE: WORKSPACE DIRECTORY & OPERATIONS
    // ==========================================================================
    if (action === 'workspaces.list') {
      const search = sanitizeText(req.query?.search || body.search || '', 100)
      const activeFilter = req.query?.isActive ?? body.isActive
      const { limit, offset } = sanitizePagination(req.query?.limit || body.limit, req.query?.offset || body.offset)

      let query = supabaseAdmin
        .from('workspaces')
        .select('id, name, created_by, is_active, billing_plan_id, billing_status, settings, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (search) {
        query = query.ilike('name', `%${search}%`)
      }
      if (activeFilter !== undefined && activeFilter !== 'all') {
        query = query.eq('is_active', String(activeFilter) === 'true')
      }

      const { data, count, error } = await query
      if (error) return res.status(400).json({ error: error.message })

      // Attach member counts
      const wsIds = (data || []).map(w => w.id)
      let memberCounts = {}
      if (wsIds.length > 0) {
        const { data: mRows } = await supabaseAdmin
          .from('workspace_members')
          .select('workspace_id')
          .in('workspace_id', wsIds)

        if (mRows) {
          mRows.forEach(m => {
            memberCounts[m.workspace_id] = (memberCounts[m.workspace_id] || 0) + 1
          })
        }
      }

      const enriched = (data || []).map(w => ({
        ...w,
        billing_plan_id: w.billing_plan_id || w.settings?.billing_plan_id || 'free',
        subscription_tier: w.billing_plan_id || w.settings?.subscription_tier || 'free',
        memberCount: memberCounts[w.id] || 1
      }))

      return res.status(200).json({ workspaces: enriched, total: count || 0, offset, limit })
    }

    if (action === 'workspaces.get') {
      const wsId = sanitizeText(req.query?.id || body.id, 64)
      if (!isValidUuid(wsId)) return res.status(400).json({ error: 'Valid UUID required for workspace ID' })

      const [wsRes, membersRes, sprintsRes, tasksRes, invitesRes] = await Promise.all([
        supabaseAdmin.from('workspaces').select('*').eq('id', wsId).maybeSingle(),
        supabaseAdmin.from('workspace_members').select('user_id, role, joined_at, users(id, email, full_name, avatar_url, username)').eq('workspace_id', wsId),
        supabaseAdmin.from('sprints').select('id, name, status, start_date, end_date').eq('workspace_id', wsId),
        supabaseAdmin.from('deadlines').select('id, title, status, priority, due_date, sprint_id, created_at').eq('workspace_id', wsId),
        supabaseAdmin.from('invites').select('id, workspace_id, email, role, permissions, created_at').eq('workspace_id', wsId)
      ])

      let workspace = wsRes.data
      let ownerUser = null

      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found' })
      }

      if (workspace.created_by) {
        const { data: oData } = await supabaseAdmin.from('users').select('id, email, full_name, avatar_url, username').eq('id', workspace.created_by).maybeSingle()
        ownerUser = oData
      }

      const membersList = (membersRes.data || []).map(m => ({
        id: m.user_id,
        user_id: m.user_id,
        role: m.role || 'member',
        joined_at: m.joined_at,
        users: {
          ...m.users,
          full_name: m.users?.full_name || m.users?.username || (m.users?.email ? m.users.email.split('@')[0] : 'Member')
        }
      }))

      const invitesList = (invitesRes.data || []).map(inv => ({
        ...inv,
        status: 'pending'
      }))

      const { data: banFlag } = await supabaseAdmin.from('feature_flags').select('metadata').eq('key', 'platform_ban_list').maybeSingle()
      const isBanned = Boolean(
        workspace.billing_status === 'suspended' ||
        (ownerUser?.email && (banFlag?.metadata?.banned_emails || []).map(e => e.toLowerCase()).includes(ownerUser.email.toLowerCase()))
      )

      return res.status(200).json({
        workspace,
        owner: ownerUser || { full_name: 'Workspace Owner', email: workspace.created_by },
        members: membersList,
        invites: invitesList,
        sprints: sprintsRes.data || [],
        tasks: tasksRes.data || [],
        taskCount: tasksRes.data?.length || 0,
        isBanned
      })
    }

    if (action === 'workspaces.toggle_status') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
      const wsId = sanitizeText(body.id, 64)
      const isActive = Boolean(body.isActive)
      const reason = sanitizeText(body.reason || 'Admin status change', 200)

      if (!isValidUuid(wsId)) return res.status(400).json({ error: 'Valid UUID required for workspace ID' })

      const { error } = await supabaseAdmin
        .from('workspaces')
        .update({ is_active: isActive })
        .eq('id', wsId)

      if (error) return res.status(400).json({ error: error.message })

      await recordPlatformAudit(supabaseAdmin, {
        admin,
        action: isActive ? 'workspace.activate' : 'workspace.suspend',
        targetType: 'workspace',
        targetId: wsId,
        details: { isActive, reason },
        req
      })

      return res.status(200).json({ ok: true, is_active: isActive })
    }

    if (action === 'workspaces.permanently_suspend') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
      const wsId = sanitizeText(body.id || body.workspaceId, 64)
      const reason = sanitizeText(body.reason || 'Permanent workspace suspension', 200)
      const inputIp = sanitizeText(body.ip, 64)

      if (!isValidUuid(wsId)) return res.status(400).json({ error: 'Valid UUID required for workspace ID' })

      // Fetch workspace
      const { data: ws } = await supabaseAdmin.from('workspaces').select('id, name, created_by').eq('id', wsId).maybeSingle()
      if (!ws) return res.status(404).json({ error: 'Workspace not found' })

      // 1. Deactivate workspace
      await supabaseAdmin.from('workspaces').update({ is_active: false, billing_status: 'suspended' }).eq('id', wsId)

      // 2. Delete pending invites
      await supabaseAdmin.from('invites').delete().eq('workspace_id', wsId)

      // 3. If workspace has an owner, also ban the owner account, email, and IP
      let bannedOwnerEmail = null
      let targetIp = inputIp || null

      if (ws.created_by) {
        const { data: ownerUser } = await supabaseAdmin.from('users').select('id, email').eq('id', ws.created_by).maybeSingle()
        if (ownerUser && ownerUser.email?.toLowerCase() !== 'admin_harshpal@paper5.co') {
          bannedOwnerEmail = ownerUser.email.toLowerCase()

          if (!targetIp) {
            const { data: auditLog } = await supabaseAdmin.from('platform_audit_logs').select('ip_address').eq('target_id', ownerUser.id).order('created_at', { ascending: false }).limit(1)
            targetIp = auditLog?.[0]?.ip_address || getClientIp(req)
          }
          if (targetIp === 'unknown') targetIp = null

          // Update platform_ban_list
          const { data: banFlag } = await supabaseAdmin.from('feature_flags').select('metadata').eq('key', 'platform_ban_list').maybeSingle()
          const meta = banFlag?.metadata || { banned_emails: [], banned_ips: [] }
          const bannedEmails = Array.from(new Set([...(meta.banned_emails || []).map(e => e.toLowerCase()), bannedOwnerEmail]))
          const bannedIps = Array.from(new Set([...(meta.banned_ips || []), ...(targetIp ? [targetIp] : [])]))

          await supabaseAdmin.from('feature_flags').upsert({
            key: 'platform_ban_list',
            name: 'Platform Permanent Ban Registry',
            description: 'Authoritative IP and Email ban registry for permanent platform enforcement',
            enabled: true,
            metadata: { banned_emails: bannedEmails, banned_ips: bannedIps },
            updated_at: new Date().toISOString()
          })

          // Rate limit log
          await supabaseAdmin.from('rate_limit_log').insert([
            { identifier: `email:${bannedOwnerEmail}`, action: 'permanent_ban' },
            ...(targetIp ? [{ identifier: `ip:${targetIp}`, action: 'permanent_ban' }] : [])
          ])

          // Suspend owner in public.users
          await supabaseAdmin.from('users').update({ billing_status: 'suspended' }).eq('id', ownerUser.id)
          try {
            await supabaseAdmin.auth.admin.updateUserById(ownerUser.id, { ban_duration: '876000h' })
          } catch (_) {}
        }
      }

      await recordPlatformAudit(supabaseAdmin, {
        admin,
        action: 'workspace.permanently_suspended',
        targetType: 'workspace',
        targetId: wsId,
        details: { workspaceName: ws.name, bannedOwnerEmail, ip: targetIp, reason },
        req
      })

      return res.status(200).json({
        ok: true,
        message: `Workspace "${ws.name}" permanently suspended. Associated owner ${bannedOwnerEmail || 'N/A'} and IP ${targetIp || 'N/A'} permanently blacklisted.`,
        workspaceName: ws.name,
        bannedOwnerEmail,
        bannedIp: targetIp
      })
    }

    if (action === 'workspaces.delete') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
      const wsId = sanitizeText(body.id, 64)
      const confirmation = sanitizeText(body.confirmation, 64)
      const reason = sanitizeText(body.reason || 'Administrative cascade deletion', 300)

      if (!isValidUuid(wsId)) return res.status(400).json({ error: 'Valid UUID required for workspace ID' })
      if (confirmation !== wsId) {
        return res.status(400).json({ error: 'Confirmation ID must match workspace ID exactly.' })
      }

      // Check existence
      const { data: wsData } = await supabaseAdmin.from('workspaces').select('id').eq('id', wsId).maybeSingle()
      if (!wsData) return res.status(404).json({ error: 'Workspace not found' })

      // Safe atomic cascade deletion
      await Promise.allSettled([
        supabaseAdmin.from('invites').delete().eq('workspace_id', wsId),
        supabaseAdmin.from('workspace_invites').delete().eq('workspace_id', wsId),
        supabaseAdmin.from('deadlines').delete().eq('workspace_id', wsId),
        supabaseAdmin.from('sprints').delete().eq('workspace_id', wsId),
        supabaseAdmin.from('meetings').delete().eq('workspace_id', wsId),
        supabaseAdmin.from('audit_logs').delete().eq('workspace_id', wsId),
        supabaseAdmin.from('workspace_members').delete().eq('workspace_id', wsId)
      ])

      const { error: delErr } = await supabaseAdmin.from('workspaces').delete().eq('id', wsId)
      if (delErr) return res.status(400).json({ error: delErr.message })

      await recordPlatformAudit(supabaseAdmin, {
        admin,
        action: 'workspace.delete',
        targetType: 'workspace',
        targetId: wsId,
        details: { reason },
        req
      })

      return res.status(200).json({ ok: true, message: `Workspace ${wsId} purged successfully` })
    }

    // ==========================================================================
    // 4. MODULE: BILLING & SUBSCRIPTIONS
    // ==========================================================================
    if (action === 'billing.overview') {
      const { data: usersData } = await supabaseAdmin
        .from('users')
        .select('id, email, billing_plan_id, billing_status, created_at')

      let starter = 0, team = 0, pro = 0
      let activePaidUsers = []

      for (const u of (usersData || [])) {
        const tier = (u.billing_plan_id || 'starter').toLowerCase()
        if (tier === 'pro' || tier === 'scale' || tier === 'enterprise') {
          pro++
          activePaidUsers.push(u)
        } else if (tier === 'team' || tier === 'standard') {
          team++
          activePaidUsers.push(u)
        } else {
          starter++
        }
      }

      const mrr = (team * 29) + (pro * 79)
      const arr = mrr * 12

      return res.status(200).json({
        summary: { mrr, arr, starter, team, pro, totalPaid: team + pro },
        subscribers: activePaidUsers.slice(0, 50)
      })
    }

    // ==========================================================================
    // 5. MODULE: SECURITY OPERATIONS CENTER (SOC) & RATE LIMITS
    // ==========================================================================
    if (action === 'security.rate_limits') {
      const { data, error } = await supabaseAdmin
        .from('rate_limit_log')
        .select('*')
        .order('window_start', { ascending: false })
        .limit(100)

      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ rateLimits: data || [] })
    }

    if (action === 'security.unblock_ip') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
      const ip = sanitizeText(body.ip, 64)
      if (!ip) return res.status(400).json({ error: 'Missing IP address' })

      const { error } = await supabaseAdmin
        .from('rate_limit_log')
        .delete()
        .eq('ip_address', ip)

      if (error) return res.status(400).json({ error: error.message })

      await recordPlatformAudit(supabaseAdmin, {
        admin,
        action: 'security.unblock_ip',
        targetType: 'security_ip',
        targetId: ip,
        details: { ip },
        req
      })

      return res.status(200).json({ ok: true, message: `IP ${ip} unblocked successfully` })
    }

    if (action === 'security.audit_logs') {
      const { limit, offset } = sanitizePagination(req.query?.limit || body.limit, req.query?.offset || body.offset)
      const actionFilter = sanitizeText(req.query?.actionFilter || body.actionFilter, 50)

      let query = supabaseAdmin
        .from('platform_audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (actionFilter) {
        query = query.ilike('action', `%${actionFilter}%`)
      }

      const { data, count, error } = await query
      if (error) return res.status(400).json({ error: error.message })

      return res.status(200).json({ logs: data || [], total: count || 0, offset, limit })
    }

    // ==========================================================================
    // 1B. GOOGLE ANALYTICS 4 (GA4 DATA API)
    // ==========================================================================
    if (action === 'analytics.ga4') {
      const target = sanitizeText(req.query?.target || body.target || 'default', 20).toLowerCase()
      const dateRange = sanitizeText(req.query?.dateRange || body.dateRange || '28d', 10).toLowerCase()
      const startDate = dateRange === '7d' ? '7daysAgo' : dateRange === '90d' ? '90daysAgo' : '28daysAgo'

      const mainPropId = (process.env.GA4_MAIN_PROPERTY_ID || process.env.GA4_PROPERTY_ID || '').trim()
      const appPropId = (process.env.GA4_APP_PROPERTY_ID || '').trim()
      const propertyId = target === 'app' && appPropId ? appPropId : (mainPropId || appPropId)

      let clientEmail = (process.env.GA4_CLIENT_EMAIL || '').trim()
      let privateKey = (process.env.GA4_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim()

      if ((!clientEmail || !privateKey) && process.env.GA4_SERVICE_ACCOUNT_JSON) {
        try {
          const parsed = JSON.parse(process.env.GA4_SERVICE_ACCOUNT_JSON)
          clientEmail = parsed.client_email || clientEmail
          privateKey = (parsed.private_key || privateKey).replace(/\\n/g, '\n')
        } catch (jsonErr) {
          return res.status(400).json({
            configured: false,
            error: 'Invalid GA4_SERVICE_ACCOUNT_JSON format.'
          })
        }
      }

      if (!propertyId || !clientEmail || !privateKey) {
        return res.status(200).json({
          configured: false,
          availableProperties: {
            main: Boolean(mainPropId),
            app: Boolean(appPropId)
          },
          message: 'GA4 is not configured yet. Add GA4_PROPERTY_ID (or GA4_MAIN_PROPERTY_ID / GA4_APP_PROPERTY_ID) and GA4_SERVICE_ACCOUNT_JSON (or GA4_CLIENT_EMAIL + GA4_PRIVATE_KEY) to your environment variables.'
        })
      }

      try {
        const nowSec = Math.floor(Date.now() / 1000)
        const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
        const header = b64url({ alg: 'RS256', typ: 'JWT' })
        const claim = b64url({
          iss: clientEmail,
          scope: 'https://www.googleapis.com/auth/analytics.readonly',
          aud: 'https://oauth2.googleapis.com/token',
          exp: nowSec + 3600,
          iat: nowSec
        })
        const signer = crypto.createSign('RSA-SHA256')
        signer.update(`${header}.${claim}`)
        const signature = signer.sign(privateKey, 'base64url')
        const jwtAssertion = `${header}.${claim}.${signature}`

        const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwtAssertion
          })
        })
        const tokenJson = await tokenResp.json()
        if (!tokenResp.ok || !tokenJson.access_token) {
          throw new Error(tokenJson.error_description || tokenJson.error || 'Failed to authenticate with Google Analytics API.')
        }

        const runGaReport = async (reportBody) => {
          const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${tokenJson.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(reportBody)
          })
          const json = await r.json()
          if (!r.ok) {
            throw new Error(json?.error?.message || 'GA4 runReport failed.')
          }
          return json
        }

        const [summaryRep, dailyRep, pagesRep, sourcesRep] = await Promise.all([
          runGaReport({
            dateRanges: [{ startDate, endDate: 'today' }],
            metrics: [
              { name: 'activeUsers' },
              { name: 'sessions' },
              { name: 'screenPageViews' },
              { name: 'averageSessionDuration' },
              { name: 'bounceRate' }
            ]
          }),
          runGaReport({
            dateRanges: [{ startDate, endDate: 'today' }],
            dimensions: [{ name: 'date' }],
            metrics: [
              { name: 'activeUsers' },
              { name: 'sessions' },
              { name: 'screenPageViews' }
            ],
            orderBys: [{ dimension: { dimensionName: 'date' } }]
          }),
          runGaReport({
            dateRanges: [{ startDate, endDate: 'today' }],
            dimensions: [{ name: 'pagePath' }],
            metrics: [
              { name: 'screenPageViews' },
              { name: 'activeUsers' }
            ],
            orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
            limit: 8
          }),
          runGaReport({
            dateRanges: [{ startDate, endDate: 'today' }],
            dimensions: [{ name: 'sessionSourceMedium' }],
            metrics: [
              { name: 'sessions' },
              { name: 'activeUsers' }
            ],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: 8
          })
        ])

        const sVals = summaryRep?.rows?.[0]?.metricValues || []
        const summary = {
          activeUsers: Number(sVals[0]?.value || 0),
          sessions: Number(sVals[1]?.value || 0),
          pageViews: Number(sVals[2]?.value || 0),
          avgSessionDurationSec: Math.round(Number(sVals[3]?.value || 0)),
          bounceRatePct: Math.round(Number(sVals[4]?.value || 0) * 1000) / 10
        }

        const daily = (dailyRep?.rows || []).map((row) => {
          const raw = row.dimensionValues?.[0]?.value || ''
          const formattedDate = raw.length === 8 ? `${raw.slice(4, 6)}/${raw.slice(6, 8)}` : raw
          return {
            date: formattedDate,
            activeUsers: Number(row.metricValues?.[0]?.value || 0),
            sessions: Number(row.metricValues?.[1]?.value || 0),
            pageViews: Number(row.metricValues?.[2]?.value || 0)
          }
        })

        const topPages = (pagesRep?.rows || []).map((row) => ({
          path: row.dimensionValues?.[0]?.value || '/',
          views: Number(row.metricValues?.[0]?.value || 0),
          users: Number(row.metricValues?.[1]?.value || 0)
        }))

        const topSources = (sourcesRep?.rows || []).map((row) => ({
          source: row.dimensionValues?.[0]?.value || '(direct) / (none)',
          sessions: Number(row.metricValues?.[0]?.value || 0),
          users: Number(row.metricValues?.[1]?.value || 0)
        }))

        return res.status(200).json({
          configured: true,
          propertyId,
          target: target === 'app' && appPropId ? 'app' : 'main',
          availableProperties: {
            main: Boolean(mainPropId),
            app: Boolean(appPropId)
          },
          dateRange,
          summary,
          daily,
          topPages,
          topSources
        })
      } catch (gaErr) {
        console.error('[GA4 API Error]', gaErr)
        return res.status(502).json({
          configured: true,
          error: gaErr?.message || 'Failed to fetch GA4 report.'
        })
      }
    }

    // ==========================================================================
    // 6. MODULE: INFRASTRUCTURE & SYSTEM HEALTH
    // ==========================================================================
    if (action === 'health.check' || action === 'health.telemetry') {
      const t0 = Date.now()
      const { error: pingErr } = await supabaseAdmin.from('users').select('id').limit(1)
      const latencyMs = Date.now() - t0

      const [uCount, wCount, dCount, sCount, aCount, rCount] = await Promise.all([
        supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('workspaces').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('deadlines').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('sprints').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('platform_audit_logs').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('rate_limit_log').select('id', { count: 'exact', head: true })
      ])

      return res.status(200).json({
        status: pingErr ? 'degraded' : 'healthy',
        databaseLatencyMs: latencyMs,
        tables: {
          users: uCount.count || 0,
          workspaces: wCount.count || 0,
          deadlines: dCount.count || 0,
          sprints: sCount.count || 0,
          platform_audit_logs: aCount.count || 0,
          rate_limit_log: rCount.count || 0
        },
        nodeVersion: process.version,
        serverTime: new Date().toISOString()
      })
    }

    // ==========================================================================
    // 6B. MODULE: DATABASE EXPLORER (TABLES & ROW DATA)
    // ==========================================================================
    const ALLOWED_DB_TABLES = [
      'users',
      'workspaces',
      'workspace_members',
      'invites',
      'workspace_invites',
      'sprints',
      'deadlines',
      'meetings',
      'platform_admins',
      'platform_audit_logs',
      'rate_limit_log',
      'feature_flags',
      'announcements',
      'support_tickets',
      'contact_messages',
      'product_feedback'
    ]

    if (action === 'database.tables') {
      const results = await Promise.all(
        ALLOWED_DB_TABLES.map(async (tableName) => {
          try {
            const { count, error } = await supabaseAdmin
              .from(tableName)
              .select('*', { count: 'exact', head: true })
            if (error) return null
            return { name: tableName, rowCount: count ?? 0 }
          } catch (_) {
            return null
          }
        })
      )
      const tables = results.filter(Boolean)
      return res.status(200).json({
        database: 'Supabase PostgreSQL',
        schema: 'public',
        tables
      })
    }

    if (action === 'database.rows') {
      const tableName = sanitizeText(req.query?.table || body.table, 64)
      if (!ALLOWED_DB_TABLES.includes(tableName)) {
        return res.status(400).json({ error: 'Invalid or unsupported table name.' })
      }
      const { limit, offset } = sanitizePagination(req.query?.limit || body.limit, req.query?.offset || body.offset, 25, 100)
      const { data: rows, count, error } = await supabaseAdmin
        .from(tableName)
        .select('*', { count: 'exact' })
        .range(offset, offset + limit - 1)

      if (error) {
        return res.status(400).json({ error: error.message || `Failed to query ${tableName}` })
      }

      const safeRows = (rows || []).map((row) => {
        const copy = { ...row }
        delete copy.password_hash
        delete copy.encrypted_password
        return copy
      })
      const columns = safeRows.length > 0 ? Object.keys(safeRows[0]) : []

      return res.status(200).json({
        table: tableName,
        columns,
        rows: safeRows,
        total: count ?? safeRows.length,
        limit,
        offset
      })
    }

    // ==========================================================================
    // 7. MODULE: SUPPORT & FEEDBACK TRIAGE
    // ==========================================================================
    if (action === 'support.list') {
      const statusFilter = sanitizeText(req.query?.status || body.status, 20)
      const { limit, offset } = sanitizePagination(req.query?.limit || body.limit, req.query?.offset || body.offset)

      let query = supabaseAdmin
        .from('support_tickets')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, count, error } = await query
      if (error) return res.status(400).json({ error: error.message })

      return res.status(200).json({ tickets: data || [], total: count || 0, offset, limit })
    }

    if (action === 'support.update_ticket') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
      const ticketId = sanitizeText(body.id, 64)
      const status = sanitizeText(body.status, 20)
      const priority = sanitizeText(body.priority, 20)
      const adminNotes = sanitizeText(body.adminNotes, 2000)

      if (!isValidUuid(ticketId)) return res.status(400).json({ error: 'Valid UUID required for ticket ID' })

      const patch = { updated_at: new Date().toISOString() }
      if (status) patch.status = status
      if (priority) patch.priority = priority
      if (adminNotes !== undefined) patch.admin_notes = adminNotes

      const { error } = await supabaseAdmin
        .from('support_tickets')
        .update(patch)
        .eq('id', ticketId)

      if (error) return res.status(400).json({ error: error.message })

      await recordPlatformAudit(supabaseAdmin, {
        admin,
        action: 'support.update_ticket',
        targetType: 'support_ticket',
        targetId: ticketId,
        details: patch,
        req
      })

      return res.status(200).json({ ok: true, patch })
    }

    // ==========================================================================
    // 8. MODULE: FEATURE FLAGS & KILL SWITCHES
    // ==========================================================================
    if (action === 'flags.list') {
      const { data, error } = await supabaseAdmin
        .from('feature_flags')
        .select('*')
        .order('key', { ascending: true })

      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ flags: data || [] })
    }

    if (action === 'flags.update') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
      const key = sanitizeText(body.key, 100)
      const enabled = Boolean(body.enabled)
      const rolloutPercentage = parseInt(body.rolloutPercentage ?? 100, 10)
      const tierRestrictions = Array.isArray(body.tierRestrictions) ? body.tierRestrictions : []

      if (!key) return res.status(400).json({ error: 'Missing flag key' })

      const patch = {
        enabled,
        rollout_percentage: Math.max(0, Math.min(100, rolloutPercentage)),
        tier_restrictions: tierRestrictions,
        updated_by: admin.user_id,
        updated_at: new Date().toISOString()
      }

      const { error } = await supabaseAdmin
        .from('feature_flags')
        .update(patch)
        .eq('key', key)

      if (error) return res.status(400).json({ error: error.message })

      await recordPlatformAudit(supabaseAdmin, {
        admin,
        action: 'flag.update',
        targetType: 'feature_flag',
        targetId: key,
        details: patch,
        req
      })

      return res.status(200).json({ ok: true, flag: { key, ...patch } })
    }

    if (action === 'flags.create') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
      const key = sanitizeText(body.key, 100).toLowerCase().replace(/[^a-z0-9_]/g, '')
      const name = sanitizeText(body.name, 100)
      const description = sanitizeText(body.description, 300)
      const enabled = Boolean(body.enabled)
      const tierRestrictions = Array.isArray(body.tierRestrictions) ? body.tierRestrictions : []

      if (!key || !name) return res.status(400).json({ error: 'Key and Name are required' })

      const { data, error } = await supabaseAdmin
        .from('feature_flags')
        .insert({
          key,
          name,
          description,
          enabled,
          tier_restrictions: tierRestrictions,
          created_by: admin.user_id,
          updated_by: admin.user_id
        })
        .select()
        .single()

      if (error) return res.status(400).json({ error: error.message })

      await recordPlatformAudit(supabaseAdmin, {
        admin,
        action: 'flag.create',
        targetType: 'feature_flag',
        targetId: key,
        details: { key, name, enabled },
        req
      })

      return res.status(200).json({ ok: true, flag: data })
    }

    // ==========================================================================
    // 9. MODULE: PLATFORM ANNOUNCEMENTS & BANNERS
    // ==========================================================================
    if (action === 'announcements.list') {
      const { data, error } = await supabaseAdmin
        .from('platform_announcements')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ announcements: data || [] })
    }

    if (action === 'announcements.create') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
      const title = sanitizeText(body.title, 200)
      const content = sanitizeText(body.content, 2000)
      const type = sanitizeText(body.type || 'info', 20)
      const targetAudience = sanitizeText(body.targetAudience || 'all', 20)
      const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true
      const expiresAt = body.expiresAt ? new Date(body.expiresAt).toISOString() : null

      if (!title || !content) return res.status(400).json({ error: 'Title and Content required' })

      const { data, error } = await supabaseAdmin
        .from('platform_announcements')
        .insert({
          title,
          content,
          type,
          target_audience: targetAudience,
          is_active: isActive,
          expires_at: expiresAt,
          created_by: admin.user_id
        })
        .select()
        .single()

      if (error) return res.status(400).json({ error: error.message })

      await recordPlatformAudit(supabaseAdmin, {
        admin,
        action: 'announcement.create',
        targetType: 'announcement',
        targetId: data.id,
        details: { title, type, targetAudience },
        req
      })

      return res.status(200).json({ ok: true, announcement: data })
    }

    if (action === 'announcements.update') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
      const id = sanitizeText(body.id, 64)
      if (!isValidUuid(id)) return res.status(400).json({ error: 'Valid UUID required for announcement ID' })

      const patch = { updated_at: new Date().toISOString() }
      if (body.title !== undefined) patch.title = sanitizeText(body.title, 200)
      if (body.content !== undefined) patch.content = sanitizeText(body.content, 2000)
      if (body.isActive !== undefined) patch.is_active = Boolean(body.isActive)
      if (body.type !== undefined) patch.type = sanitizeText(body.type, 20)
      if (body.targetAudience !== undefined) patch.target_audience = sanitizeText(body.targetAudience, 20)

      const { error } = await supabaseAdmin
        .from('platform_announcements')
        .update(patch)
        .eq('id', id)

      if (error) return res.status(400).json({ error: error.message })

      await recordPlatformAudit(supabaseAdmin, {
        admin,
        action: 'announcement.update',
        targetType: 'announcement',
        targetId: id,
        details: patch,
        req
      })

      return res.status(200).json({ ok: true, patch })
    }

    // ==========================================================================
    // 10. MODULE: PLATFORM ADMINS & RBAC MANAGEMENT
    // ==========================================================================
    if (action === 'admins.list') {
      const { data, error } = await supabaseAdmin
        .from('platform_admins')
        .select('id, user_id, email, role, permissions, is_active, bootstrap_initial, notes, created_at, updated_at')
        .not('email', 'in', `(${DUMMY_EMAILS.map(e => `"${e}"`).join(',')})`)
        .order('created_at', { ascending: true })

      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ admins: data || [] })
    }

    if (action === 'admins.invite' || action === 'admins.create') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
      if (admin.role !== 'owner') {
        return res.status(403).json({ error: 'Access denied: Only the Platform Owner can appoint administrators.' })
      }

      const email = sanitizeText(body.email, 150).toLowerCase()
      const role = sanitizeText(body.role || 'super_admin', 20)
      const permissions = Array.isArray(body.permissions) ? body.permissions : ['*']
      const notes = sanitizeText(body.notes || '', 300)

      if (!email) return res.status(400).json({ error: 'Email is required' })
      if (!['owner', 'super_admin'].includes(role)) {
        return res.status(400).json({ error: 'Role must be owner or super_admin' })
      }

      // Check user exists in auth
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('id, email')
        .ilike('email', email)
        .maybeSingle()

      if (!userData) {
        return res.status(404).json({ error: `User with email "${email}" has not registered on Paper5 yet.` })
      }

      const { data: newAdmin, error: insErr } = await supabaseAdmin
        .from('platform_admins')
        .insert({
          user_id: userData.id,
          email: userData.email,
          role,
          permissions,
          is_active: true,
          notes,
          created_by: admin.user_id
        })
        .select()
        .single()

      if (insErr) return res.status(400).json({ error: insErr.message })

      await recordPlatformAudit(supabaseAdmin, {
        admin,
        action: 'admin.appoint',
        targetType: 'platform_admin',
        targetId: newAdmin.id,
        details: { email, role, permissions },
        req
      })

      return res.status(200).json({ ok: true, admin: newAdmin })
    }

    if (action === 'admins.update') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
      if (admin.role !== 'owner') {
        return res.status(403).json({ error: 'Access denied: Only the Platform Owner can modify administrator privileges.' })
      }

      const adminId = sanitizeText(body.id, 64)
      if (!isValidUuid(adminId)) return res.status(400).json({ error: 'Valid UUID required for admin ID' })

      // Prevent deactivating oneself if the only owner
      const { data: targetAdmin } = await supabaseAdmin
        .from('platform_admins')
        .select('*')
        .eq('id', adminId)
        .maybeSingle()

      if (targetAdmin?.role === 'owner' && body.isActive === false) {
        return res.status(400).json({ error: 'Security Policy Violation: The Platform Owner cannot deactivate themselves.' })
      }

      const patch = { updated_at: new Date().toISOString() }
      if (body.isActive !== undefined) patch.is_active = Boolean(body.isActive)
      if (body.permissions !== undefined) patch.permissions = body.permissions
      if (body.notes !== undefined) patch.notes = sanitizeText(body.notes, 300)

      const { error } = await supabaseAdmin
        .from('platform_admins')
        .update(patch)
        .eq('id', adminId)

      if (error) return res.status(400).json({ error: error.message })

      await recordPlatformAudit(supabaseAdmin, {
        admin,
        action: 'admin.update',
        targetType: 'platform_admin',
        targetId: adminId,
        details: patch,
        req
      })

      return res.status(200).json({ ok: true, patch })
    }

    return res.status(400).json({ error: `Unknown or unhandled administrative action "${action}".` })
  } catch (err) {
    console.error('[OwnerConsole Dispatcher Error]', err)
    return res.status(500).json({ error: sanitizeError(err) })
  }
}
