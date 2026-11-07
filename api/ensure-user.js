import { createClient } from '@supabase/supabase-js'
import { setCorsHeaders } from './_cors.js'

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
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://sdbglndhjkqhkphzqmum.supabase.co'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const activeKey = serviceKey || anonKey

  if (!activeKey) {
    return res.status(500).json({ error: 'Supabase credentials missing' })
  }

  const supabaseAdmin = createClient(supabaseUrl, activeKey)

  try {
    const body = await parseBody(req)
    const targetUid = body.userId || body.uid || body.id
    const targetEmail = (body.email || '').trim().toLowerCase()

    if (!targetUid) {
      return res.status(400).json({ error: 'Missing userId in request body' })
    }

    // 1. Check if user already exists in public.users
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', targetUid)
      .maybeSingle()

    if (existing) {
      if (body.billing_plan_id || body.billing_status || body.legal_accepted_at) {
        const updateData = {}
        if (body.billing_plan_id) updateData.billing_plan_id = body.billing_plan_id
        if (body.billing_status) updateData.billing_status = body.billing_status
        if (body.legal_accepted_version) updateData.legal_accepted_version = body.legal_accepted_version
        if (body.legal_accepted_at) updateData.legal_accepted_at = body.legal_accepted_at
        updateData.updated_at = new Date().toISOString()
        
        await supabaseAdmin.from('users').update(updateData).eq('id', targetUid)
      }
      return res.status(200).json({ success: true, user: existing })
    }

    // 2. Compute unique username
    let username = body.username || (targetEmail ? targetEmail.split('@')[0].replace(/[^a-z0-9_]/g, '') : `user_${targetUid.slice(0, 6)}`)
    if (!username || username.length < 3) {
      username = `user_${targetUid.slice(0, 6)}`
    }

    const payload = {
      id: targetUid,
      email: targetEmail,
      username,
      billing_plan_id: body.billing_plan_id || 'unselected',
      billing_status: body.billing_status || 'active',
      legal_accepted_version: body.legal_accepted_version || '1.0.0',
      legal_accepted_at: body.legal_accepted_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    let { data: inserted, error: insertErr } = await supabaseAdmin
      .from('users')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .maybeSingle()

    if (insertErr && (insertErr.code === '23505' || insertErr.message?.includes('unique') || insertErr.message?.includes('username'))) {
      payload.username = `${username.slice(0, 14)}_${targetUid.slice(0, 5)}`
      const retryRes = await supabaseAdmin
        .from('users')
        .upsert(payload, { onConflict: 'id' })
        .select('*')
        .maybeSingle()
      inserted = retryRes.data
      insertErr = retryRes.error
    }

    if (insertErr) {
      return res.status(500).json({ error: insertErr.message, code: insertErr.code })
    }

    return res.status(200).json({ success: true, user: inserted })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' })
  }
}
