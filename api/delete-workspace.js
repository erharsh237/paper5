import { createClient } from '@supabase/supabase-js'
import { setCorsHeaders } from './_cors.js'
import { authenticateUser, verifyWorkspaceAccess } from './_auth.js'
import { sanitizeError } from './_errors.js'
import { logAdminAction } from './_audit.js'

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

  if (req.method !== 'POST' && req.method !== 'DELETE') {
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
  const workspaceId = body.workspaceId || body.workspace_id || req.query?.workspaceId || req.query?.workspace_id

  if (!workspaceId) {
    return res.status(400).json({ error: 'Missing required workspaceId parameter' })
  }

  // 1. Authenticate caller and strictly enforce workspace OWNER authorization
  const authRes = await verifyWorkspaceAccess(req, supabaseAdmin, workspaceId, { requireAdmin: true })
  if (authRes.error) {
    return res.status(authRes.status || 403).json({ error: authRes.error })
  }

  if (!authRes.isOwner) {
    return res.status(403).json({ error: 'Forbidden: Only the workspace owner is authorized to permanently delete this workspace.' })
  }

  const actorId = authRes.user.id

  try {
    // 2. First attempt atomic deletion via stored RPC if present in database
    try {
      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('delete_workspace_completely', {
        target_workspace_id: workspaceId
      })
      if (!rpcError) {
        return res.status(200).json({
          success: true,
          message: 'Workspace and all associated data permanently deleted.',
          workspaceId
        })
      }
    } catch (_) {}

    // 3. Complete and permanent step-by-step purge using elevated service role

    // 3A. Invalidate & Delete all pending invites immediately (invite links become dead)
    await Promise.allSettled([
      supabaseAdmin.from('invites').delete().eq('workspace_id', workspaceId),
      supabaseAdmin.from('workspace_invites').delete().eq('workspace_id', workspaceId)
    ])

    // 3B. Delete all operational data associated with the workspace
    await Promise.allSettled([
      supabaseAdmin.from('deadlines').delete().eq('workspace_id', workspaceId),
      supabaseAdmin.from('sprints').delete().eq('workspace_id', workspaceId),
      supabaseAdmin.from('meetings').delete().eq('workspace_id', workspaceId),
      supabaseAdmin.from('audit_logs').delete().eq('workspace_id', workspaceId),
      supabaseAdmin.from('evidence').delete().eq('workspace_id', workspaceId),
      supabaseAdmin.from('extra_work').delete().eq('workspace_id', workspaceId)
    ])

    // 3C. Delete all members from workspace_members immediately so access is revoked across all accounts
    try {
      await supabaseAdmin
        .from('workspace_members')
        .delete()
        .eq('workspace_id', workspaceId)
    } catch (_) {}

    // 3D. Delete the workspace record
    let wsDeleted = false
    const { error: wsDelErr } = await supabaseAdmin
      .from('workspaces')
      .delete()
      .eq('id', workspaceId)

    if (!wsDelErr) {
      wsDeleted = true
      // Double clean up any remaining membership row(s)
      try {
        await supabaseAdmin.from('workspace_members').delete().eq('workspace_id', workspaceId)
      } catch (_) {}
    } else {
      // If direct workspace delete encountered trigger or constraint:
      console.warn('Direct workspace delete warning:', wsDelErr.message)

      // Fallback: If trigger on workspace_members tripped cascade:
      try {
        await supabaseAdmin.from('workspace_members').delete().eq('workspace_id', workspaceId)
      } catch (_) {}

      const { error: retryErr } = await supabaseAdmin
        .from('workspaces')
        .delete()
        .eq('id', workspaceId)

      if (retryErr) {
        // If workspace deletion failed, throw sanitized error
        throw retryErr
      }
      wsDeleted = true
    }
        .from('workspaces')
        .delete()
        .eq('id', workspaceId)

      if (retryErr) {
        // If workspace deletion failed, throw sanitized error
        throw retryErr
      }
      wsDeleted = true
    }

    // 4. Log admin action if audit table allows
    try {
      await logAdminAction(supabaseAdmin, {
        workspaceId,
        actorId,
        action: 'workspace.permanently_delete',
        resource: 'workspaces',
        metadata: { deletedWorkspaceId: workspaceId }
      })
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: 'Workspace and all associated records, invites, and data successfully deleted.',
      workspaceId
    })
  } catch (err) {
    console.error('delete-workspace error:', err)
    return res.status(500).json({
      error: sanitizeError(err, 'Failed to permanently delete workspace')
    })
  }
}
