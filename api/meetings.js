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

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const activeKey = serviceKey || anonKey

  if (!rawUrl || !activeKey) return res.status(500).json({ error: 'Supabase credentials missing' })

  const supabaseUrl = rawUrl.replace(/["']/g, '').trim()
  const supabaseAdmin = createClient(supabaseUrl, activeKey.replace(/["']/g, '').trim())
  const body = parseBody(req)
  const { action, workspaceId, eventId, notesObj } = body || {}

  if (!workspaceId) return res.status(400).json({ error: 'Missing workspaceId' })

  const authRes = await verifyWorkspaceAccess(req, supabaseAdmin, workspaceId)
  if (authRes.error) {
    return res.status(authRes.status || 403).json({ error: authRes.error })
  }

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
    console.error('API meetings error:', err?.message || err)
    return res.status(500).json({ error: sanitizeError(err, 'Failed to process meeting action') })
  }
}
