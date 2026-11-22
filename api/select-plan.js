import { createClient } from '@supabase/supabase-js'
import { setCorsHeaders } from './_cors.js'
import { authenticateUser } from './_auth.js'
import { checkRateLimit } from './_rateLimit.js'
import { sanitizeError } from './_errors.js'

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (req.body && typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch (_) { return {} }
  }
  return req.body || {}
}

const ALLOWED_PLANS = ['starter', 'team', 'pro', 'scale', 'free']

export default async function handler(req, res) {
  setCorsHeaders(req, res)
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (checkRateLimit(req, res, { max: 30, windowMs: 60000 })) return

  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const rawKey = serviceKey || anonKey

  if (!rawUrl || !rawKey) {
    return res.status(500).json({ error: 'Supabase credentials missing' })
  }

  const supabaseUrl = rawUrl.replace(/["']/g, '').trim()
  const activeKey = rawKey.replace(/["']/g, '').trim()
  const supabaseAdmin = createClient(supabaseUrl, activeKey)

  try {
    const authRes = await authenticateUser(req, supabaseAdmin)
    if (authRes.error) {
      return res.status(authRes.status || 401).json({ error: authRes.error })
    }

    const callerUid = authRes.user.id
    const body = parseBody(req)
    const rawPlan = (body.planId || body.plan || '').toLowerCase().trim()
    const rawCycle = (body.billingInterval || body.cycle || 'monthly').toLowerCase().trim()

    if (!rawPlan || !ALLOWED_PLANS.includes(rawPlan)) {
      return res.status(400).json({ error: `Invalid plan selection: ${rawPlan}. Allowed tiers: starter, team, pro.` })
    }

    // Normalize plan tier
    const normalizedPlan = (rawPlan === 'free' ? 'starter' : (rawPlan === 'scale' ? 'pro' : rawPlan))
    const normalizedCycle = (rawCycle === 'annual' ? 'annual' : 'monthly')

    // Update public.users via trusted service role
    const { data: updatedUser, error: updateErr } = await supabaseAdmin
      .from('users')
      .update({
        billing_plan_id: normalizedPlan,
        billing_status: 'active',
        billing_interval: normalizedCycle,
        updated_at: new Date().toISOString()
      })
      .eq('id', callerUid)
      .select('*')
      .maybeSingle()

    if (updateErr) {
      console.error('Plan selection update error:', updateErr)
      return res.status(500).json({ error: sanitizeError(updateErr) })
    }

    // Sync active plan to workspaces directly owned by this user
    try {
      await supabaseAdmin
        .from('workspaces')
        .update({
          billing_plan_id: normalizedPlan,
          billing_status: 'active'
        })
        .or(`created_by.eq.${callerUid},owner_id.eq.${callerUid}`)
    } catch (wsErr) {
      console.warn('Workspace tier sync notice:', wsErr)
    }

    return res.status(200).json({
      success: true,
      plan: normalizedPlan,
      billingInterval: normalizedCycle,
      user: updatedUser
    })
  } catch (err) {
    console.error('Plan selection handler exception:', err)
    return res.status(500).json({ error: sanitizeError(err) })
  }
}
