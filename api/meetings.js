import { createClient } from '@supabase/supabase-js'

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (req.body && typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch (_) { return {} }
  }
  return req.body || {}
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://sdbglndhjkqhkphzqmum.supabase.co'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const activeKey = serviceKey || anonKey

  if (!activeKey) return res.status(500).json({ error: 'Supabase credentials missing' })

  const supabaseAdmin = createClient(supabaseUrl, activeKey)
  const body = parseBody(req)
  const { action, workspaceId, eventId, notesObj } = body || {}

  if (!workspaceId) return res.status(400).json({ error: 'Missing workspaceId' })

  try {
    if (action === 'save_event_note') {
      const { data: wsData } = await supabaseAdmin.from('workspaces').select('settings').eq('id', workspaceId).maybeSingle()
      const currentWsSettings = wsData?.settings || {}
      const currentNotes = currentWsSettings.eventNotes || {}
      const updatedNotes = { ...currentNotes, [eventId]: notesObj }

      await supabaseAdmin.from('workspaces').update({
        settings: { ...currentWsSettings, eventNotes: updatedNotes }
      }).eq('id', workspaceId)

      return res.status(200).json({ success: true, eventNotes: updatedNotes })
    }

    if (action === 'delete_event_note') {
      const { data: wsData } = await supabaseAdmin.from('workspaces').select('settings').eq('id', workspaceId).maybeSingle()
      const currentWsSettings = wsData?.settings || {}
      const currentNotes = { ...(currentWsSettings.eventNotes || {}) }
      delete currentNotes[eventId]

      await supabaseAdmin.from('workspaces').update({
        settings: { ...currentWsSettings, eventNotes: currentNotes }
      }).eq('id', workspaceId)

      return res.status(200).json({ success: true, eventNotes: currentNotes })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    console.error('API meetings error:', err)
    return res.status(500).json({ error: err.message || 'Failed to process meeting note action' })
  }
}
