import { createClient } from '@supabase/supabase-js'

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (req.body && typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch (_) { return {} }
  }
  return req.body || {}
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key')
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
  const body = parseBody(req)
  const { action, workspaceId, id, sprintData, patch, teamId, sprintId } = body || {}

  if (!workspaceId) {
    return res.status(400).json({ error: 'Missing workspaceId' })
  }

  try {
    if (action === 'create_sprint') {
      const payload = {
        workspace_id: workspaceId,
        team_id: teamId || null,
        number: sprintData?.number,
        goal: sprintData?.goal || '',
        start_date: sprintData?.startDate || sprintData?.start_date,
        end_date: sprintData?.endDate || sprintData?.end_date,
        status: sprintData?.status || 'active',
        created_at: new Date().toISOString(),
      }
      const { data, error } = await supabaseAdmin.from('sprints').insert([payload]).select()
      if (error) throw error
      return res.status(200).json({ success: true, data: data[0] })
    }

    if (action === 'update_sprint') {
      const { error } = await supabaseAdmin.from('sprints').update(patch).eq('id', id).eq('workspace_id', workspaceId)
      if (error) throw error
      return res.status(200).json({ success: true })
    }

    if (action === 'delete_sprint') {
      try {
        await supabaseAdmin.from('deadlines').update({ sprint_id: null }).eq('sprint_id', id).eq('workspace_id', workspaceId)
      } catch (_) {}
      const { error } = await supabaseAdmin.from('sprints').delete().eq('id', id).eq('workspace_id', workspaceId)
      if (error) throw error
      return res.status(200).json({ success: true })
    }

    if (action === 'set_active_sprint') {
      const { error } = await supabaseAdmin.from('sprints').update({ status: 'active' }).eq('id', sprintId || id).eq('workspace_id', workspaceId)
      if (error) throw error
      return res.status(200).json({ success: true })
    }

    if (action === 'close_sprint') {
      const { error } = await supabaseAdmin.from('sprints').update({ status: 'completed' }).eq('id', id).eq('workspace_id', workspaceId)
      if (error) throw error
      return res.status(200).json({ success: true })
    }

    if (action === 'reopen_sprint') {
      const { error } = await supabaseAdmin.from('sprints').update({ status: 'active' }).eq('id', id).eq('workspace_id', workspaceId)
      if (error) throw error
      return res.status(200).json({ success: true })
    }

    if (action === 'lock_sprint') {
      const { error } = await supabaseAdmin.from('sprints').update({ locked: true }).eq('id', id).eq('workspace_id', workspaceId)
      if (error) throw error
      return res.status(200).json({ success: true })
    }

    if (action === 'unlock_sprint') {
      const { error } = await supabaseAdmin.from('sprints').update({ locked: false }).eq('id', id).eq('workspace_id', workspaceId)
      if (error) throw error
      return res.status(200).json({ success: true })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    console.error('API sprints error:', err)
    return res.status(500).json({ error: err.message || 'Failed to process sprint action' })
  }
}
