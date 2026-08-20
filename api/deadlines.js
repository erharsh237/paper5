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
  const { action, workspaceId, id, deadlineData, patch, teamId, status, blockerInfo, reviewData, extraWorkData } = body || {}

  if (!workspaceId) {
    return res.status(400).json({ error: 'Missing workspaceId' })
  }

  try {
    if (action === 'create_deadline') {
      const payload = {
        workspace_id: workspaceId,
        team_id: teamId || null,
        title: deadlineData?.title,
        description: deadlineData?.description || '',
        priority: deadlineData?.priority || 'medium',
        status: deadlineData?.status || 'not_started',
        due_date: deadlineData?.dueDate || deadlineData?.due_date,
        assignee_id: deadlineData?.assigneeId || deadlineData?.assignee_id,
        assignee_name: deadlineData?.assigneeName || deadlineData?.assignee_name,
        assignee_email: (deadlineData?.assigneeEmail || deadlineData?.assignee_email || '').toLowerCase(),
        created_by: deadlineData?.createdBy || deadlineData?.created_by || '',
        created_by_name: deadlineData?.createdByName || deadlineData?.created_by_name || 'Team Lead',
        created_at: new Date().toISOString(),
        percent_complete: 0,
        sprint_id: deadlineData?.sprintId || deadlineData?.sprint_id || null,
        estimated_hours: deadlineData?.estimatedHours ?? deadlineData?.estimated_hours ?? null,
        actual_hours: deadlineData?.actualHours ?? deadlineData?.actual_hours ?? 0,
        dependencies: deadlineData?.dependencies || [],
        labels: deadlineData?.labels || [],
        definition_of_done: deadlineData?.definitionOfDone || deadlineData?.definition_of_done || '',
        required_evidence: deadlineData?.requiredEvidence || deadlineData?.required_evidence || [],
      }
      const { data, error } = await supabaseAdmin.from('deadlines').insert([payload]).select()
      if (error) throw error
      return res.status(200).json({ success: true, data: data[0] })
    }

    if (action === 'claim_deadline') {
      const { user } = body || {}
      const claimPatch = {
        assignee_id: user?.id || user?.uid || null,
        assignee_name: user?.displayName || user?.name || (user?.email ? user.email.split('@')[0] : 'Member'),
        assignee_email: (user?.email || '').toLowerCase(),
        status: 'in_progress',
      }
      const { data, error } = await supabaseAdmin
        .from('deadlines')
        .update(claimPatch)
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .select()
      if (error) throw error
      return res.status(200).json({ success: true, data: data?.[0] })
    }

    if (action === 'update_deadline') {
      const { error } = await supabaseAdmin.from('deadlines').update(patch).eq('id', id).eq('workspace_id', workspaceId)
      if (error) throw error
      return res.status(200).json({ success: true })
    }

    if (action === 'update_status') {
      const updatePatch = { status }
      if (status === 'done') updatePatch.percent_complete = 100
      if (status === 'not_started') updatePatch.percent_complete = 0
      const { error } = await supabaseAdmin.from('deadlines').update(updatePatch).eq('id', id).eq('workspace_id', workspaceId)
      if (error) throw error
      return res.status(200).json({ success: true })
    }

    if (action === 'delete_deadline') {
      const { error } = await supabaseAdmin.from('deadlines').delete().eq('id', id).eq('workspace_id', workspaceId)
      if (error) throw error
      return res.status(200).json({ success: true })
    }

    if (action === 'set_blocked') {
      const { error } = await supabaseAdmin.from('deadlines').update({
        status: 'blocked',
        blocker_info: blockerInfo,
      }).eq('id', id).eq('workspace_id', workspaceId)
      if (error) throw error
      return res.status(200).json({ success: true })
    }

    if (action === 'clear_blocked') {
      const { error } = await supabaseAdmin.from('deadlines').update({
        status: status || 'in_progress',
        blocker_info: null,
      }).eq('id', id).eq('workspace_id', workspaceId)
      if (error) throw error
      return res.status(200).json({ success: true })
    }

    if (action === 'approve_review') {
      const { error } = await supabaseAdmin.from('deadlines').update({
        status: 'done',
        reviewer_email: (reviewData?.reviewerEmail || '').toLowerCase(),
        reviewer_name: reviewData?.reviewerName || '',
        review_note: reviewData?.reviewNote || '',
        percent_complete: 100,
      }).eq('id', id).eq('workspace_id', workspaceId)
      if (error) throw error
      return res.status(200).json({ success: true })
    }

    if (action === 'reject_review') {
      const { error } = await supabaseAdmin.from('deadlines').update({
        status: 'in_progress',
        reviewer_email: (reviewData?.reviewerEmail || '').toLowerCase(),
        reviewer_name: reviewData?.reviewerName,
        review_note: reviewData?.reviewNote || '',
      }).eq('id', id).eq('workspace_id', workspaceId)
      if (error) throw error
      return res.status(200).json({ success: true })
    }

    if (action === 'add_extra_work') {
      const { data, error } = await supabaseAdmin.from('extra_work').insert([{
        workspace_id: workspaceId,
        deadline_id: id,
        note: extraWorkData?.note,
        added_by: extraWorkData?.addedBy,
        added_by_name: extraWorkData?.addedByName,
        added_at: new Date().toISOString(),
      }]).select()
      if (error) throw error
      return res.status(200).json({ success: true, data: data[0] })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    console.error('API deadlines error:', err)
    return res.status(500).json({ error: err.message || 'Failed to process deadline action' })
  }
}
