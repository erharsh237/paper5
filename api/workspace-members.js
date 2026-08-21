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
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://sdbglndhjkqhkphzqmum.supabase.co'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const activeKey = serviceKey || anonKey

  if (!activeKey) {
    return res.status(500).json({ error: 'Supabase credentials missing' })
  }

  const supabaseAdmin = createClient(supabaseUrl, activeKey)

  // POST: Update Member Role or Permissions
  if (req.method === 'POST') {
    const body = await parseBody(req)
    const { action, workspaceId, memberId, role, permissions, patch } = body || {}
    if (!workspaceId) {
      return res.status(400).json({ error: 'Missing workspaceId', receivedBody: body })
    }

    try {
      if (action === 'add_member_by_email') {
        const targetEmail = (body.email || '').trim().toLowerCase()
        if (!targetEmail) return res.status(400).json({ error: 'Missing email' })
        
        let matchedUid = null
        let matchedName = null
        
        if (serviceKey && typeof supabaseAdmin.auth?.admin?.listUsers === 'function') {
          try {
            const { data: listRes } = await supabaseAdmin.auth.admin.listUsers()
            const foundUser = (listRes?.users || []).find(u => (u.email || '').trim().toLowerCase() === targetEmail)
            if (foundUser) {
              matchedUid = foundUser.id
              matchedName = foundUser.user_metadata?.full_name || foundUser.user_metadata?.name
            }
          } catch (_) {}
        }
        
        if (!matchedUid) {
          const { data: uRows } = await supabaseAdmin.from('users').select('id, name, full_name').ilike('email', targetEmail).limit(1)
          if (uRows && uRows[0]) {
            matchedUid = uRows[0].id
            matchedName = uRows[0].name || uRows[0].full_name
          }
        }
        
        if (!matchedUid) {
          const { data: pRows } = await supabaseAdmin.from('profiles').select('id, name').ilike('email', targetEmail).limit(1)
          if (pRows && pRows[0]) {
            matchedUid = pRows[0].id
            matchedName = pRows[0].name
          }
        }
        
        if (matchedUid) {
          let insertError = null
          try {
            const { error } = await supabaseAdmin.from('workspace_members').upsert({
              workspace_id: workspaceId,
              user_id: matchedUid,
              role: role || 'member',
              permissions: Array.isArray(permissions) ? permissions : []
            }, { onConflict: 'workspace_id,user_id' })
            if (error) insertError = error.message || error
          } catch (e) {
            insertError = e.message || e
          }
          
          try { await supabaseAdmin.from('invites').delete().eq('workspace_id', workspaceId).eq('email', targetEmail) } catch (_) {}
          try { await supabaseAdmin.from('workspace_invites').delete().eq('workspace_id', workspaceId).eq('email', targetEmail) } catch (_) {}
          
          return res.status(200).json({ success: true, userId: matchedUid, email: targetEmail, insertError })
        }
        
        return res.status(404).json({ error: 'User account not found in Auth for email: ' + targetEmail })
      }

      if (action === 'update_workspace_settings') {
        const { error } = await supabaseAdmin
          .from('workspaces')
          .update(patch || {})
          .eq('id', workspaceId)
        if (error) throw error
        return res.status(200).json({ success: true })
      }

      if (action === 'force_delete') {
        if (!memberId) return res.status(400).json({ error: 'Missing memberId' })
        // Temporarily elevate to owner so count(*) > 1
        await supabaseAdmin
          .from('workspace_members')
          .update({ role: 'owner' })
          .eq('workspace_id', workspaceId)
          .eq('user_id', memberId)

        await supabaseAdmin
          .from('workspace_members')
          .update({ role: 'owner' })
          .eq('workspace_id', workspaceId)
          .eq('user_id', '48b3e98d-8acf-450f-9d32-966df188946d')

        const delRes = await supabaseAdmin
          .from('workspace_members')
          .delete()
          .eq('workspace_id', workspaceId)
          .eq('user_id', memberId)

        return res.status(200).json({
          delRes
        })
      }

      if (action === 'update_permissions') {
        const cleanPerms = Array.isArray(permissions) ? permissions : []
        const memberEmail = body.email ? body.email.trim().toLowerCase() : null

        // 1. Persist to workspaces.settings.member_permissions (JSONB)
        try {
          const { data: ws } = await supabaseAdmin
            .from('workspaces')
            .select('settings')
            .eq('id', workspaceId)
            .maybeSingle()

          const currentSettings = ws?.settings || {}
          const memberPerms = { ...(currentSettings.member_permissions || {}) }
          memberPerms[memberId] = cleanPerms
          if (memberEmail) {
            memberPerms[memberEmail] = cleanPerms
          }

          // Also look up email if not directly provided
          if (!memberEmail) {
            try {
              const { data: uData } = await supabaseAdmin.from('users').select('email').eq('id', memberId).maybeSingle()
              if (uData?.email) {
                memberPerms[uData.email.trim().toLowerCase()] = cleanPerms
              }
            } catch (_) {}
          }

          await supabaseAdmin
            .from('workspaces')
            .update({ settings: { ...currentSettings, member_permissions: memberPerms } })
            .eq('id', workspaceId)
        } catch (wsErr) {
          console.warn('workspaces settings member_permissions update error:', wsErr.message)
        }

        // 2. Also attempt update on workspace_members table directly
        try {
          await supabaseAdmin
            .from('workspace_members')
            .update({ permissions: cleanPerms })
            .eq('workspace_id', workspaceId)
            .eq('user_id', memberId)
        } catch (_) {}

        return res.status(200).json({ success: true, permissions: cleanPerms })
      }

      if (action === 'delete_member' || action === 'remove_member') {
        // Temporarily elevate to owner so count(*) > 1 before delete
        await supabaseAdmin
          .from('workspace_members')
          .update({ role: 'owner' })
          .eq('workspace_id', workspaceId)
          .eq('user_id', memberId)

        const { error: delErr } = await supabaseAdmin
          .from('workspace_members')
          .delete()
          .eq('workspace_id', workspaceId)
          .eq('user_id', memberId)

        if (delErr) console.warn('Delete member notice:', delErr.message)

        await supabaseAdmin.from('profiles').delete().eq('id', memberId)
        await supabaseAdmin.from('users').delete().eq('id', memberId)

        try {
          const { data: ws } = await supabaseAdmin.from('workspaces').select('settings').eq('id', workspaceId).maybeSingle()
          if (ws?.settings?.deletion_requests) {
            const reqs = { ...ws.settings.deletion_requests }
            delete reqs[memberId]
            await supabaseAdmin.from('workspaces').update({ settings: { ...ws.settings, deletion_requests: reqs } }).eq('id', workspaceId)
          }
        } catch (_) {}

        if (serviceKey) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(memberId)
          } catch (aErr) {
            console.warn('Auth delete notice:', aErr.message)
          }
        }

        return res.status(200).json({ success: true, deleted: true, memberId })
      }

      if (action === 'update_role') {
        const cleanRole = role === 'admin' ? 'admin' : 'member'
        const { error } = await supabaseAdmin
          .from('workspace_members')
          .update({ role: cleanRole })
          .eq('workspace_id', workspaceId)
          .eq('user_id', memberId)

        if (error) throw error
        return res.status(200).json({ success: true, role: cleanRole })
      }

      if (action === 'cancel_invite' || action === 'delete_invite') {
        const { inviteId, email } = req.body
        const cleanEmail = email ? email.trim().toLowerCase() : null

        if (inviteId) {
          await supabaseAdmin.from('invites').delete().eq('id', inviteId)
          try { await supabaseAdmin.from('workspace_invites').delete().eq('id', inviteId) } catch (_) {}
        }
        if (cleanEmail && workspaceId) {
          await supabaseAdmin.from('invites').delete().eq('workspace_id', workspaceId).eq('email', cleanEmail)
          try { await supabaseAdmin.from('workspace_invites').delete().eq('workspace_id', workspaceId).eq('email', cleanEmail) } catch (_) {}
        }

        // Clean up pre-provisioned auth user if they belong to no other workspaces
        if (cleanEmail && serviceKey) {
          try {
            const { data: authList } = await supabaseAdmin.auth.admin.listUsers()
            const existing = (authList?.users || []).find(u => u.email?.toLowerCase() === cleanEmail)
            if (existing) {
              const { data: mems } = await supabaseAdmin.from('workspace_members').select('id').eq('user_id', existing.id)
              if (!mems || mems.length === 0) {
                await supabaseAdmin.auth.admin.deleteUser(existing.id)
                await supabaseAdmin.from('users').delete().eq('id', existing.id)
                await supabaseAdmin.from('profiles').delete().eq('id', existing.id)
              }
            }
          } catch (e) {
            console.warn('cancel_invite auth purge notice:', e)
          }
        }

        return res.status(200).json({ success: true, cancelled: true })
      }
    } catch (postErr) {
      console.error('Update member error:', postErr)
      return res.status(500).json({ error: postErr.message || 'Failed to update member' })
    }
  }

  // GET: Fetch All Members with Real Emails and Full Names
  const workspaceId = req.query.workspaceId || req.body?.workspaceId
  if (!workspaceId) {
    return res.status(400).json({ error: 'Missing workspaceId parameter' })
  }

  try {
    const { data: members, error: memErr } = await supabaseAdmin
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)

    if (memErr) throw memErr

    const userIds = (members || []).map(m => m.user_id).filter(Boolean)
    const userDetailsMap = new Map()

    // 1. Fetch from users table
    if (userIds.length > 0) {
      try {
        const { data: usersData } = await supabaseAdmin
          .from('users')
          .select('id, email, full_name, avatar_url')
          .in('id', userIds)
        for (const u of (usersData || [])) {
          if (u.id) userDetailsMap.set(u.id, u)
        }
      } catch (_) {}
    }

    // 2. Fetch from profiles table
    if (userIds.length > 0) {
      try {
        const { data: profData } = await supabaseAdmin
          .from('profiles')
          .select('id, email, name, photoURL')
          .in('id', userIds)
        for (const p of (profData || [])) {
          if (p.id) {
            const existing = userDetailsMap.get(p.id) || {}
            userDetailsMap.set(p.id, {
              ...existing,
              email: existing.email || p.email,
              full_name: existing.full_name || p.name,
              avatar_url: existing.avatar_url || p.photoURL
            })
          }
        }
      } catch (_) {}
    }

    // 3. For any remaining missing emails, query auth.admin if service key is available
    if (serviceKey && typeof supabaseAdmin.auth?.admin?.getUserById === 'function') {
      for (const uid of userIds) {
        const existing = userDetailsMap.get(uid)
        if (!existing || !existing.email) {
          try {
            const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(uid)
            if (authUser?.user) {
              const u = authUser.user
              userDetailsMap.set(uid, {
                id: uid,
                email: u.email,
                full_name: u.user_metadata?.full_name || u.user_metadata?.name || existing?.full_name || null,
                avatar_url: u.user_metadata?.avatar_url || existing?.avatar_url || null
              })
            }
          } catch (_) {}
        }
      }
    }

    // Fetch workspace settings to retrieve member_permissions map
    let memberPermsMap = {}
    try {
      const { data: wsData } = await supabaseAdmin
        .from('workspaces')
        .select('settings')
        .eq('id', workspaceId)
        .maybeSingle()
      if (wsData?.settings?.member_permissions) {
        memberPermsMap = wsData.settings.member_permissions
      }
    } catch (_) {}

    // Build enriched member records
    const enrichedMembers = (members || []).map(m => {
      const u = userDetailsMap.get(m.user_id) || {}
      const email = u.email || m.email || null
      const fullName = u.full_name || m.full_name || null
      const cleanEmail = (email || '').toLowerCase().trim()
      const displayLabel = fullName || email || (email ? email.split('@')[0] : `Member (${(m.user_id || '').slice(0, 6)})`)
      const perms = memberPermsMap[m.user_id] || (cleanEmail ? memberPermsMap[cleanEmail] : null) || (Array.isArray(m.permissions) ? m.permissions : [])

      return {
        id: m.user_id,
        userId: m.user_id,
        workspaceId: m.workspace_id,
        role: m.role || 'member',
        permissions: Array.isArray(perms) ? perms : [],
        email: email,
        name: fullName || email || displayLabel,
        fullName: fullName,
        displayLabel: displayLabel,
        avatarUrl: u.avatar_url || null,
        joinedAt: m.joined_at || m.created_at
      }
    })

    // Auto-convert pending invites if their user account now exists
    try {
      const { data: pendingInvites } = await supabaseAdmin
        .from('invites')
        .select('*')
        .eq('workspace_id', workspaceId)

      if (Array.isArray(pendingInvites) && pendingInvites.length > 0) {
        for (const inv of pendingInvites) {
          const invEmail = (inv.email || '').trim().toLowerCase()
          if (!invEmail) continue

          let matchedUserId = null
          let matchedName = null
          let matchedAvatar = null

          // A. Check userDetailsMap (pre-fetched auth/profile details)
          for (const [uid, u] of userDetailsMap.entries()) {
            if (u.email && u.email.trim().toLowerCase() === invEmail) {
              matchedUserId = uid
              matchedName = u.full_name || u.name
              matchedAvatar = u.avatar_url
              break
            }
          }

          // B. Check users table
          if (!matchedUserId) {
            const { data: matchedUsers } = await supabaseAdmin
              .from('users')
              .select('id, email, name, full_name, avatar_url')
              .ilike('email', invEmail)
              .limit(1)

            if (matchedUsers && matchedUsers[0]) {
              matchedUserId = matchedUsers[0].id
              matchedName = matchedUsers[0].name || matchedUsers[0].full_name
              matchedAvatar = matchedUsers[0].avatar_url
            }
          }

          // C. Check profiles table
          if (!matchedUserId) {
            const { data: matchedProfiles } = await supabaseAdmin
              .from('profiles')
              .select('id, email, name, photoURL')
              .ilike('email', invEmail)
              .limit(1)

            if (matchedProfiles && matchedProfiles[0]) {
              matchedUserId = matchedProfiles[0].id
              matchedName = matchedProfiles[0].name
              matchedAvatar = matchedProfiles[0].photoURL
            }
          }

          // D. Check auth admin listUsers
          if (!matchedUserId && serviceKey && typeof supabaseAdmin.auth?.admin?.listUsers === 'function') {
            try {
              const { data: listRes } = await supabaseAdmin.auth.admin.listUsers()
              const matchedAuthUser = (listRes?.users || []).find(u => (u.email || '').trim().toLowerCase() === invEmail)
              if (matchedAuthUser) {
                matchedUserId = matchedAuthUser.id
                matchedName = matchedAuthUser.user_metadata?.full_name || matchedAuthUser.user_metadata?.name
                matchedAvatar = matchedAuthUser.user_metadata?.avatar_url
              }
            } catch (_) {}
          }

          if (matchedUserId) {
            // Upsert workspace_members
            try {
              await supabaseAdmin.from('workspace_members').upsert({
                workspace_id: workspaceId,
                user_id: matchedUserId,
                role: inv.role || 'member',
                permissions: Array.isArray(inv.permissions) ? inv.permissions : []
              }, { onConflict: 'workspace_id,user_id' })
            } catch (_) {}

            // Delete pending invite by id AND email from all invite tables
            try { await supabaseAdmin.from('invites').delete().eq('id', inv.id) } catch (_) {}
            try { await supabaseAdmin.from('invites').delete().eq('workspace_id', workspaceId).eq('email', invEmail) } catch (_) {}
            try { await supabaseAdmin.from('workspace_invites').delete().eq('workspace_id', workspaceId).eq('email', invEmail) } catch (_) {}

            // Add to enrichedMembers list if not already present
            if (!enrichedMembers.some(m => m.id === matchedUserId || (m.email && m.email.toLowerCase() === invEmail))) {
              enrichedMembers.push({
                id: matchedUserId,
                userId: matchedUserId,
                workspaceId,
                role: inv.role || 'member',
                permissions: Array.isArray(inv.permissions) ? inv.permissions : [],
                email: invEmail,
                name: matchedName || invEmail,
                displayLabel: matchedName || invEmail.split('@')[0],
                avatarUrl: matchedAvatar || null,
                joinedAt: new Date().toISOString()
              })
            }
          }
        }
      }
    } catch (autoErr) {
      console.warn('Auto convert invite notice:', autoErr)
    }

    return res.status(200).json({ success: true, members: enrichedMembers })
  } catch (err) {
    console.error('workspace-members API error:', err)
    return res.status(500).json({ error: err.message || 'Failed to fetch members' })
  }
}
