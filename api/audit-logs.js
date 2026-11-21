import { createClient } from '@supabase/supabase-js'
import { setCorsHeaders } from './_cors.js'
import { checkRateLimit } from './_rateLimit.js'
import { verifyWorkspaceAccess } from './_auth.js'
import { sanitizeError } from './_errors.js'

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (req.body && typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch (_) { return {} }
  }
  return req.body || {}
}

export default async function handler(req, res) {
  setCorsHeaders(req, res)
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (checkRateLimit(req, res, { max: 120, windowMs: 60000 })) return

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const activeKey = serviceKey || anonKey

  if (!rawUrl || !activeKey) {
    return res.status(500).json({ error: 'Supabase configuration missing' })
  }

  const supabaseUrl = rawUrl.replace(/["']/g, '').trim()
  const supabaseAdmin = createClient(supabaseUrl, activeKey.replace(/["']/g, '').trim())

  const body = parseBody(req)
  const workspaceId = req.query?.workspaceId || body.workspaceId || body.workspace_id
  const limit = Math.min(parseInt(req.query?.limit || body.limit || '50', 10), 100)
  const offset = parseInt(req.query?.offset || body.offset || '0', 10)
  const resource = req.query?.resource || body.resource

  if (!workspaceId) {
    return res.status(400).json({ error: 'Missing required workspaceId parameter' })
  }

  // Restrict audit logs strictly to workspace administrators and owners
  const authRes = await verifyWorkspaceAccess(req, supabaseAdmin, workspaceId, { requireAdmin: true })
  if (authRes.error) {
    return res.status(authRes.status || 403).json({ error: authRes.error })
  }

  try {
    let query = supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (resource && resource !== 'all') {
      query = query.eq('resource', resource)
    }

    const { data: logs, error } = await query
    if (error) throw error

    // Fetch actor profiles for enriching the logs with names/emails
    const actorIds = [...new Set((logs || []).map((l) => l.actor_id).filter(Boolean))]
    const actorsMap = {}

    if (actorIds.length > 0) {
      try {
        const { data: users } = await supabaseAdmin
          .from('users')
          .select('id, email, raw_user_meta_data')
          .in('id', actorIds)

        ;(users || []).forEach((u) => {
          const meta = u.raw_user_meta_data || {}
          actorsMap[u.id] = {
            id: u.id,
            email: u.email,
            name: meta.full_name || meta.name || u.email?.split('@')[0] || 'Admin',
            avatarUrl: meta.avatar_url || null
          }
        })
      } catch (_) {}
    }

    const enrichedLogs = (logs || []).map((l) => ({
      id: l.id,
      action: l.action,
      resource: l.resource,
      metadata: l.metadata || {},
      createdAt: l.created_at,
      actor: actorsMap[l.actor_id] || {
        id: l.actor_id,
        name: l.actor_id === authRes.user.id ? 'You' : 'System / Member',
        email: ''
      }
    }))

    return res.status(200).json({
      success: true,
      logs: enrichedLogs,
      hasMore: (logs || []).length === limit
    })
  } catch (err) {
    console.error('API audit-logs error:', err)
    return res.status(500).json({ error: sanitizeError(err, 'Failed to retrieve workspace audit logs') })
  }
}
