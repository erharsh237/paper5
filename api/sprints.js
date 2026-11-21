import { createClient } from '@supabase/supabase-js'
import { setCorsHeaders } from './_cors.js'
import { checkRateLimit } from './_rateLimit.js'
import { verifyWorkspaceAccess } from './_auth.js'
import { sanitizeError } from './_errors.js'
import { logAdminAction } from './_audit.js'
import { sanitizeText } from './_formSecurity.js'

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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const activeKey = serviceKey || anonKey

  if (!rawUrl || !activeKey) {
    return res.status(500).json({ error: 'Supabase credentials missing' })
  }

  const supabaseUrl = rawUrl.replace(/["']/g, '').trim()
  const supabaseAdmin = createClient(supabaseUrl, activeKey.replace(/["']/g, '').trim())
  const body = parseBody(req)
  const { action, workspaceId, id, sprintData, patch, teamId, sprintId } = body || {}

  if (!workspaceId) {
    return res.status(400).json({ error: 'Missing workspaceId' })
  }

  // Sprints are managerial: deleting, locking, closing, archiving require workspace admin privileges
  const requireAdmin = ['delete_sprint', 'lock_sprint', 'unlock_sprint', 'close_sprint', 'reopen_sprint', 'archive_sprint', 'unarchive_sprint'].includes(action)
  const authRes = await verifyWorkspaceAccess(req, supabaseAdmin, workspaceId, { requireAdmin })
  if (authRes.error) {
    return res.status(authRes.status || 403).json({ error: authRes.error })
  }

  try {
    if (action === 'create_sprint') {
      const payload = {
        workspace_id: workspaceId,
        team_id: teamId || null,
        number: sprintData?.number,
        name: sanitizeText(sprintData?.name || sprintData?.title || (sprintData?.goal ? sprintData.goal.slice(0, 50) : `Sprint #${sprintData?.number || 1}`), { maxLen: 120 }),
        goal: sanitizeText(sprintData?.goal || '', { maxLen: 1000 }),
        owner_id: sprintData?.ownerId || sprintData?.owner_id || authRes.user.id,
        priority: ['low', 'medium', 'high', 'critical'].includes(sprintData?.priority) ? sprintData.priority : 'medium',
        member_ids: Array.isArray(sprintData?.memberIds || sprintData?.member_ids) ? (sprintData.memberIds || sprintData.member_ids) : [],
        start_date: sprintData?.startDate || sprintData?.start_date,
        end_date: sprintData?.endDate || sprintData?.end_date,
        status: sprintData?.status || 'active',
        archived: Boolean(sprintData?.archived),
        created_at: new Date().toISOString(),
      }
      const { data, error } = await supabaseAdmin.from('sprints').insert([payload]).select()
      if (error) throw error

      await logAdminAction(supabaseAdmin, {
        workspaceId,
        actorId: authRes.user.id,
        action: 'project.create',
        resource: 'sprints',
        metadata: { sprintId: data[0]?.id, name: payload.name }
      })

      return res.status(200).json({ success: true, data: data[0] })
    }

    if (action === 'update_sprint') {
      const sanitizedPatch = { ...patch }
      if (typeof sanitizedPatch.name === 'string') {
        sanitizedPatch.name = sanitizeText(sanitizedPatch.name, { maxLen: 120 })
      }
      if (typeof sanitizedPatch.goal === 'string') {
        sanitizedPatch.goal = sanitizeText(sanitizedPatch.goal, { maxLen: 1000 })
      }
      if (sanitizedPatch.priority && !['low', 'medium', 'high', 'critical'].includes(sanitizedPatch.priority)) {
        delete sanitizedPatch.priority
      }
      const { error } = await supabaseAdmin.from('sprints').update(sanitizedPatch).eq('id', id).eq('workspace_id', workspaceId)
      if (error) throw error

      await logAdminAction(supabaseAdmin, {
        workspaceId,
        actorId: authRes.user.id,
        action: 'project.update',
        resource: 'sprints',
        metadata: { sprintId: id, patch: sanitizedPatch }
      })

      return res.status(200).json({ success: true })
    }

    if (action === 'archive_sprint') {
      const { error } = await supabaseAdmin.from('sprints').update({ archived: true }).eq('id', id).eq('workspace_id', workspaceId)
      if (error) throw error

      await logAdminAction(supabaseAdmin, {
        workspaceId,
        actorId: authRes.user.id,
        action: 'project.archive',
        resource: 'sprints',
        metadata: { sprintId: id }
      })

      return res.status(200).json({ success: true })
    }

    if (action === 'unarchive_sprint') {
      const { error } = await supabaseAdmin.from('sprints').update({ archived: false }).eq('id', id).eq('workspace_id', workspaceId)
      if (error) throw error

      await logAdminAction(supabaseAdmin, {
        workspaceId,
        actorId: authRes.user.id,
        action: 'project.unarchive',
        resource: 'sprints',
        metadata: { sprintId: id }
      })

      return res.status(200).json({ success: true })
    }

    if (action === 'delete_sprint') {
      try {
        await supabaseAdmin.from('deadlines').update({ sprint_id: null }).eq('sprint_id', id).eq('workspace_id', workspaceId)
      } catch (_) {}
      const { error } = await supabaseAdmin.from('sprints').delete().eq('id', id).eq('workspace_id', workspaceId)
      if (error) throw error

      await logAdminAction(supabaseAdmin, {
        workspaceId,
        actorId: authRes.user.id,
        action: 'sprint.delete',
        resource: 'sprints',
        metadata: { sprintId: id }
      })

      return res.status(200).json({ success: true })
    }

    if (action === 'set_active_sprint') {
      const { error } = await supabaseAdmin.from('sprints').update({ status: 'active' }).eq('id', sprintId || id).eq('workspace_id', workspaceId)
      if (error) throw error

      await logAdminAction(supabaseAdmin, {
        workspaceId,
        actorId: authRes.user.id,
        action: 'sprint.set_active',
        resource: 'sprints',
        metadata: { sprintId: sprintId || id }
      })

      return res.status(200).json({ success: true })
    }

    if (action === 'close_sprint') {
      const { error } = await supabaseAdmin.from('sprints').update({ status: 'completed' }).eq('id', id).eq('workspace_id', workspaceId)
      if (error) throw error

      await logAdminAction(supabaseAdmin, {
        workspaceId,
        actorId: authRes.user.id,
        action: 'sprint.close',
        resource: 'sprints',
        metadata: { sprintId: id }
      })

      return res.status(200).json({ success: true })
    }

    if (action === 'reopen_sprint') {
      const { error } = await supabaseAdmin.from('sprints').update({ status: 'active' }).eq('id', id).eq('workspace_id', workspaceId)
      if (error) throw error

      await logAdminAction(supabaseAdmin, {
        workspaceId,
        actorId: authRes.user.id,
        action: 'sprint.reopen',
        resource: 'sprints',
        metadata: { sprintId: id }
      })

      return res.status(200).json({ success: true })
    }

    if (action === 'lock_sprint') {
      const { error } = await supabaseAdmin.from('sprints').update({ locked: true }).eq('id', id).eq('workspace_id', workspaceId)
      if (error) throw error

      await logAdminAction(supabaseAdmin, {
        workspaceId,
        actorId: authRes.user.id,
        action: 'sprint.lock',
        resource: 'sprints',
        metadata: { sprintId: id }
      })

      return res.status(200).json({ success: true })
    }

    if (action === 'unlock_sprint') {
      const { error } = await supabaseAdmin.from('sprints').update({ locked: false }).eq('id', id).eq('workspace_id', workspaceId)
      if (error) throw error

      await logAdminAction(supabaseAdmin, {
        workspaceId,
        actorId: authRes.user.id,
        action: 'sprint.unlock',
        resource: 'sprints',
        metadata: { sprintId: id }
      })

      return res.status(200).json({ success: true })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    console.error('API sprints error:', err?.message || err)
    return res.status(500).json({ error: sanitizeError(err, 'Failed to process sprint action') })
  }
}
