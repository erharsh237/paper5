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
  const { action, workspaceId, id, deadlineData, patch, teamId, status, blockerInfo, reviewData, extraWorkData } = body || {}

  if (!workspaceId) {
    return res.status(400).json({ error: 'Missing workspaceId' })
  }

  // Verify caller identity and workspace tenant membership
  const authRes = await verifyWorkspaceAccess(req, supabaseAdmin, workspaceId)
  if (authRes.error) {
    return res.status(authRes.status || 403).json({ error: authRes.error })
  }

  try {
    if (action === 'create_deadline') {
      const payload = {
        workspace_id: workspaceId,
        team_id: teamId || null,
        title: sanitizeText(deadlineData?.title, { maxLen: 200 }),
        description: sanitizeText(deadlineData?.description || '', { maxLen: 5000, preserveNewlines: true }),
        priority: deadlineData?.priority || 'medium',
        status: deadlineData?.status || 'not_started',
        due_date: deadlineData?.dueDate || deadlineData?.due_date,
        assignee_id: deadlineData?.assigneeId || deadlineData?.assignee_id,
        assignee_name: sanitizeText(deadlineData?.assigneeName || deadlineData?.assignee_name || '', { maxLen: 100 }),
        assignee_email: (deadlineData?.assigneeEmail || deadlineData?.assignee_email || '').toLowerCase().trim(),
        created_by: authRes.user.id || deadlineData?.createdBy || deadlineData?.created_by || '',
        created_by_name: sanitizeText(deadlineData?.createdByName || deadlineData?.created_by_name || 'Team Member', { maxLen: 100 }),
        created_at: new Date().toISOString(),
        percent_complete: 0,
        sprint_id: deadlineData?.sprintId || deadlineData?.sprint_id || null,
        estimated_hours: deadlineData?.estimatedHours || null,
        actual_hours: 0,
      }
      const { data, error } = await supabaseAdmin.from('deadlines').insert([payload]).select()
      if (error) throw error
      return res.status(200).json({ success: true, data: data[0] })
    }

    if (action === 'update_deadline') {
      const sanitizedPatch = { ...patch }
      if (typeof sanitizedPatch.title === 'string') {
        sanitizedPatch.title = sanitizeText(sanitizedPatch.title, { maxLen: 200 })
      }
      if (typeof sanitizedPatch.description === 'string') {
        sanitizedPatch.description = sanitizeText(sanitizedPatch.description, { maxLen: 5000, preserveNewlines: true })
      }
      const { data, error } = await supabaseAdmin
        .from('deadlines')
        .update(sanitizedPatch)
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .select()
      if (error) throw error
      return res.status(200).json({ success: true, data: data[0] })
    }

    if (action === 'delete_deadline') {
      // Require admin privileges or being the creator of the task
      if (!authRes.isAdmin) {
        const { data: existingTask } = await supabaseAdmin
          .from('deadlines')
          .select('created_by')
          .eq('id', id)
          .eq('workspace_id', workspaceId)
          .maybeSingle()
        if (existingTask && existingTask.created_by !== authRes.user.id) {
          return res.status(403).json({ error: 'Only admins or task creators can delete deadlines.' })
        }
      }

      const { error } = await supabaseAdmin
        .from('deadlines')
        .delete()
        .eq('id', id)
        .eq('workspace_id', workspaceId)
      if (error) throw error

      await logAdminAction(supabaseAdmin, {
        workspaceId,
        actorId: authRes.user.id,
        action: 'deadline.delete',
        resource: 'deadlines',
        metadata: { deadlineId: id }
      })

      return res.status(200).json({ success: true })
    }

    if (action === 'claim_deadline') {
      const { data, error } = await supabaseAdmin
        .from('deadlines')
        .update({
          assignee_id: authRes.user.id,
          assignee_name: body.user?.displayName || body.user?.name || authRes.user.email?.split('@')[0],
          assignee_email: authRes.user.email?.toLowerCase(),
          status: 'in_progress',
        })
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .select()
      if (error) throw error
      return res.status(200).json({ success: true, data: data[0] })
    }

    if (action === 'update_status') {
      const updatePayload = { status }
      if (status === 'done') {
        updatePayload.completed_at = new Date().toISOString()
        updatePayload.percent_complete = 100
      }
      const { data, error } = await supabaseAdmin
        .from('deadlines')
        .update(updatePayload)
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .select()
      if (error) throw error
      return res.status(200).json({ success: true, data: data[0] })
    }

    if (action === 'flag_blocker') {
      const { error } = await supabaseAdmin
        .from('deadlines')
        .update({
          status: 'blocked',
          blocker_reason: blockerInfo?.reason,
          blocked_at: new Date().toISOString(),
          blocked_by: authRes.user.id,
          blocked_by_name: blockerInfo?.flaggedByName || authRes.user.email?.split('@')[0],
        })
        .eq('id', id)
        .eq('workspace_id', workspaceId)
      if (error) throw error
      return res.status(200).json({ success: true })
    }

    if (action === 'resolve_blocker') {
      const { error } = await supabaseAdmin
        .from('deadlines')
        .update({
          status: 'in_progress',
          blocker_reason: null,
          blocked_at: null,
          blocked_by: null,
          blocked_by_name: null,
        })
        .eq('id', id)
        .eq('workspace_id', workspaceId)
      if (error) throw error
      return res.status(200).json({ success: true })
    }

    if (action === 'submit_for_review') {
      const { error } = await supabaseAdmin
        .from('deadlines')
        .update({
          status: 'review',
          evidence_url: reviewData?.evidenceUrl,
          evidence_type: reviewData?.evidenceType,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('workspace_id', workspaceId)
      if (error) throw error
      return res.status(200).json({ success: true })
    }

    if (action === 'review_deadline') {
      if (!authRes.isAdmin) {
        return res.status(403).json({ error: 'Administrator privileges required to review tasks.' })
      }
      const isApproved = reviewData?.approved
      const { error } = await supabaseAdmin
        .from('deadlines')
        .update({
          status: isApproved ? 'done' : 'in_progress',
          review_feedback: reviewData?.feedback || null,
          reviewed_by: authRes.user.id,
          reviewed_at: new Date().toISOString(),
          completed_at: isApproved ? new Date().toISOString() : null,
          percent_complete: isApproved ? 100 : undefined,
        })
        .eq('id', id)
        .eq('workspace_id', workspaceId)
      if (error) throw error

      await logAdminAction(supabaseAdmin, {
        workspaceId,
        actorId: authRes.user.id,
        action: isApproved ? 'deadline.approve' : 'deadline.reject',
        resource: 'deadlines',
        metadata: { deadlineId: id, isApproved }
      })

      return res.status(200).json({ success: true })
    }

    if (action === 'add_extra_work') {
      const { data, error } = await supabaseAdmin.from('extra_work').insert([{
        workspace_id: workspaceId,
        deadline_id: id,
        note: extraWorkData?.note,
        added_by: authRes.user.id,
        added_by_name: extraWorkData?.addedByName || authRes.user.email?.split('@')[0],
        added_at: new Date().toISOString(),
      }]).select()
      if (error) throw error
      return res.status(200).json({ success: true, data: data[0] })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    console.error('API deadlines error:', err?.message || err)
    return res.status(500).json({ error: sanitizeError(err, 'Failed to process deadline action') })
  }
}
