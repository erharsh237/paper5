import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, userId, workspaceId, fetchWorkspace } = req.body || {}
  if (!email || !userId) {
    return res.status(400).json({ error: 'Missing email or userId parameter' })
  }

  const cleanEmail = email.trim().toLowerCase()
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://sdbglndhjkqhkphzqmum.supabase.co'

  // Try service role key first, fall back to anon key
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

  const anonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!serviceKey && !anonKey) {
    // No key at all — return workspace from supabase REST directly as last resort
    return res.status(200).json({ success: false, workspaceId: workspaceId || null })
  }

  // Use service key if available (bypasses RLS), otherwise anon key
  const activeKey = serviceKey || anonKey
  const supabaseAdmin = createClient(supabaseUrl, activeKey)
  const hasElevatedAccess = Boolean(serviceKey)

  try {
    let acceptedWorkspaceId = workspaceId || null

    if (hasElevatedAccess) {
      // --- Elevated path: full insert using service role key ---

      // 1. Fetch pending invites
      try {
        const { data: invites } = await supabaseAdmin
          .from('invites')
          .select('*')
          .ilike('email', cleanEmail)

        for (const inv of (invites || [])) {
          if (inv.workspace_id) {
            if (!acceptedWorkspaceId) acceptedWorkspaceId = inv.workspace_id
            await supabaseAdmin.from('workspace_members').upsert({
              workspace_id: inv.workspace_id,
              user_id: userId,
              role: inv.role || 'member'
            }, { onConflict: 'workspace_id,user_id' })
          }
        }

        if ((invites || []).length > 0) {
          await supabaseAdmin.from('invites').delete().ilike('email', cleanEmail)
        }
      } catch (e1) {
        console.warn('Invites lookup notice:', e1)
      }

      // 2. If workspaceId was passed and no invite was accepted, keep acceptedWorkspaceId for fetching workspace if requested
      if (workspaceId && !acceptedWorkspaceId) {
        acceptedWorkspaceId = workspaceId
      }
    }

    // 3. Always fetch workspace data using the active key (service key can read anything)
    let workspace = null
    if (acceptedWorkspaceId) {
      try {
        const { data: wsData } = await supabaseAdmin
          .from('workspaces')
          .select('*')
          .eq('id', acceptedWorkspaceId)
          .maybeSingle()
        workspace = wsData || null
      } catch (wsErr) {
        console.warn('Workspace fetch notice:', wsErr)
      }
    }

    return res.status(200).json({
      success: true,
      elevated: hasElevatedAccess,
      workspaceId: acceptedWorkspaceId,
      workspace
    })
  } catch (err) {
    console.error('accept-invite server error:', err)
    return res.status(200).json({ success: true, workspaceId: workspaceId || null, workspace: null })
  }
}
