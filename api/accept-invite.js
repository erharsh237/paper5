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

  const { email, userId, workspaceId } = body || {}
  if (!email && !userId) {
    return res.status(400).json({ error: 'Missing email or userId parameter' })
  }

  const cleanEmail = email ? email.trim().toLowerCase() : ''
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL

  // Try service role key first, fall back to anon key
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

  const anonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!rawUrl || (!serviceKey && !anonKey)) {
    return res.status(200).json({ success: false, workspaceId: workspaceId || null })
  }

  const supabaseUrl = rawUrl.replace(/["']/g, '').trim()
  const activeKey = (serviceKey || anonKey).replace(/["']/g, '').trim()
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

            // A. Safely add or update member in workspace_members table
            try {
              const { data: existingMember } = await supabaseAdmin
                .from('workspace_members')
                .select('id')
                .eq('workspace_id', inv.workspace_id)
                .eq('user_id', targetUserId)
                .maybeSingle()

              if (existingMember) {
                await supabaseAdmin
                  .from('workspace_members')
                  .update({
                    role: inv.role || 'member',
                    permissions: rawPerms
                  })
                  .eq('id', existingMember.id)
              } else {
                await supabaseAdmin
                  .from('workspace_members')
                  .insert({
                    workspace_id: inv.workspace_id,
                    user_id: targetUserId,
                    role: inv.role || 'member',
                    permissions: rawPerms
                  })
              }
            } catch (memErr) {
              console.warn('workspace_members insert/update notice:', memErr)
            }

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
                currentPermsMap[targetUserId] = rawPerms
                if (cleanEmail) currentPermsMap[cleanEmail] = rawPerms

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

      // 2. If no workspaceId yet, check if user already belongs to any workspace as a member
      if (!acceptedWorkspaceId) {
        try {
          const { data: memberRows } = await supabaseAdmin
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', targetUserId)
            .limit(1)

          if (memberRows && memberRows.length > 0 && memberRows[0].workspace_id) {
            acceptedWorkspaceId = memberRows[0].workspace_id
          }
        } catch (_) {}
      }

      // 3. If workspaceId was explicitly passed, ensure workspace_members row exists
      if (workspaceId && targetUserId) {
        if (!acceptedWorkspaceId) acceptedWorkspaceId = workspaceId
        try {
          const { data: existingMember } = await supabaseAdmin
            .from('workspace_members')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('user_id', targetUserId)
            .maybeSingle()

          if (!existingMember) {
            await supabaseAdmin.from('workspace_members').insert({
              workspace_id: workspaceId,
              user_id: targetUserId,
              role: 'member',
              permissions: []
            })
          }
        } catch (_) {}
      }

      // 4. Mark user as an invited team member so they never see the workspace tier selection
      if (targetUserId) {
        try {
          // Check if this user is the direct owner of the workspace
          let isOwner = false
          if (acceptedWorkspaceId) {
            const { data: wsOwner } = await supabaseAdmin
              .from('workspaces')
              .select('id')
              .eq('id', acceptedWorkspaceId)
              .eq('owner_id', targetUserId)
              .maybeSingle()
            if (wsOwner) isOwner = true
          }

          // If not owner, ensure users table has billing_plan_id: 'member'
          if (!isOwner) {
            const { data: existingUser } = await supabaseAdmin
              .from('users')
              .select('id, billing_plan_id')
              .eq('id', targetUserId)
              .maybeSingle()

            if (existingUser) {
              await supabaseAdmin.from('users').update({
                billing_plan_id: 'member',
                billing_status: 'active',
                legal_accepted_at: new Date().toISOString()
              }).eq('id', targetUserId)
            } else {
              const defaultUsername = cleanEmail ? cleanEmail.split('@')[0].replace(/[^a-z0-9_]/g, '') : `user_${targetUserId.slice(0, 6)}`
              await supabaseAdmin.from('users').insert({
                id: targetUserId,
                email: cleanEmail,
                username: defaultUsername || `user_${targetUserId.slice(0, 6)}`,
                billing_plan_id: 'member',
                billing_status: 'active',
                legal_accepted_at: new Date().toISOString()
              })
            }
          }
        } catch (uErr) {
          console.warn('User record stamp error in accept-invite:', uErr)
        }
      }
    }

    // 5. Always fetch workspace data if resolved
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
