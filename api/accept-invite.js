import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch (_) { body = {} }
  }

  const { email, userId, workspaceId, fetchWorkspace } = body || {}
  if (!email && !userId) {
    return res.status(400).json({ error: 'Missing email or userId parameter' })
  }

  const cleanEmail = email ? email.trim().toLowerCase() : ''
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
    let targetUserId = userId || null

    if (!targetUserId && cleanEmail && hasElevatedAccess) {
      try {
        const { data: listRes } = await supabaseAdmin.auth.admin.listUsers()
        const matched = (listRes?.users || []).find(u => (u.email || '').trim().toLowerCase() === cleanEmail)
        if (matched) {
          targetUserId = matched.id
        }
      } catch (_) {}
    }

    if (hasElevatedAccess && targetUserId) {
      // --- Elevated path: full insert using service role key ---

      // 1. Fetch pending invites from both invites & workspace_invites tables
      try {
        const [{ data: inv1 }, { data: inv2 }] = await Promise.all([
          supabaseAdmin.from('invites').select('*').ilike('email', cleanEmail),
          supabaseAdmin.from('workspace_invites').select('*').ilike('email', cleanEmail)
        ])

        const allInvites = [...(inv1 || []), ...(inv2 || [])]

        for (const inv of allInvites) {
          if (inv.workspace_id) {
            if (!acceptedWorkspaceId) acceptedWorkspaceId = inv.workspace_id
            const rawPerms = Array.isArray(inv.permissions) ? inv.permissions : []

            // A. Upsert workspace_members with role AND permissions
            await supabaseAdmin.from('workspace_members').upsert({
              workspace_id: inv.workspace_id,
              user_id: userId,
              role: inv.role || 'member',
              permissions: rawPerms
            }, { onConflict: 'workspace_id,user_id' })

            // B. Also persist into workspaces.settings.member_permissions
            if (rawPerms.length > 0) {
              try {
                const { data: ws } = await supabaseAdmin
                  .from('workspaces')
                  .select('settings')
                  .eq('id', inv.workspace_id)
                  .maybeSingle()
                
                const currentSettings = ws?.settings || {}
                const currentPermsMap = { ...(currentSettings.member_permissions || {}) }
                currentPermsMap[userId] = rawPerms
                currentPermsMap[cleanEmail] = rawPerms

                await supabaseAdmin
                  .from('workspaces')
                  .update({
                    settings: { ...currentSettings, member_permissions: currentPermsMap }
                  })
                  .eq('id', inv.workspace_id)
              } catch (wsErr) {
                console.warn('Persist member_permissions into workspace settings error:', wsErr)
              }
            }
          }
        }

        if (allInvites.length > 0) {
          try { await supabaseAdmin.from('invites').delete().ilike('email', cleanEmail) } catch (_) {}
          try { await supabaseAdmin.from('workspace_invites').delete().ilike('email', cleanEmail) } catch (_) {}
        }
      } catch (e1) {
        console.warn('Invites lookup notice:', e1)
      }

      // 2. If workspaceId was passed, ensure workspace_members row exists for this user
      if (workspaceId && targetUserId) {
        if (!acceptedWorkspaceId) acceptedWorkspaceId = workspaceId
        try {
          await supabaseAdmin.from('workspace_members').upsert({
            workspace_id: workspaceId,
            user_id: targetUserId,
            role: 'member',
            permissions: []
          }, { onConflict: 'workspace_id,user_id' })
        } catch (_) {}
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
