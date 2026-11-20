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
  
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const rawKey = serviceKey || anonKey

  if (!rawUrl || !rawKey) {
    return res.status(500).json({ error: 'Supabase credentials missing' })
  }

  const supabaseUrl = rawUrl.replace(/["']/g, '').trim()
  const activeKey = rawKey.replace(/["']/g, '').trim()
  const supabaseAdmin = createClient(supabaseUrl, activeKey)

  // POST: Member Administration or Profile Sync
  if (req.method === 'POST') {
    const body = await parseBody(req)
    const { action, workspaceId, memberId, role, permissions, patch } = body || {}

    // Special action: Ensure user record exists in public.users (does not require workspaceId)
    if (action === 'ensure_user') {
      const targetUid = body.userId || body.uid || body.id
      const targetEmail = (body.email || '').trim().toLowerCase()
      if (!targetUid) {
        return res.status(400).json({ error: 'Missing userId' })
      }

      // Verify caller is authenticating as themselves
      const callerAuth = await authenticateUser(req, supabaseAdmin)
      if (callerAuth.error) {
        return res.status(callerAuth.status || 401).json({ error: callerAuth.error })
      }
      if (callerAuth.user.id !== targetUid) {
        return res.status(403).json({ error: 'Forbidden: You cannot modify other user identities.' })
      }

      try {
        const { data: existing } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('id', targetUid)
          .maybeSingle()

        if (existing) {
          if (body.billing_plan_id || body.billing_status || body.legal_accepted_at) {
            const updateData = {}
            if (body.billing_plan_id) updateData.billing_plan_id = body.billing_plan_id
            if (body.billing_status) updateData.billing_status = body.billing_status
            if (body.legal_accepted_version) updateData.legal_accepted_version = body.legal_accepted_version
            if (body.legal_accepted_at) updateData.legal_accepted_at = body.legal_accepted_at
            await supabaseAdmin.from('users').update(updateData).eq('id', targetUid)
          }
          return res.status(200).json({ success: true, user: existing })
        }

        let username = body.username || (targetEmail ? targetEmail.split('@')[0].replace(/[^a-z0-9_]/g, '') : `user_${targetUid.slice(0, 6)}`)
        if (!username || username.length < 3) username = `user_${targetUid.slice(0, 6)}`

        const payload = {
          id: targetUid,
          email: targetEmail,
          username,
          billing_plan_id: body.billing_plan_id || 'unselected',
          billing_status: body.billing_status || 'active',
          legal_accepted_version: body.legal_accepted_version || '1.0.0',
          legal_accepted_at: body.legal_accepted_at || new Date().toISOString()
        }

        let { data: inserted, error: insertErr } = await supabaseAdmin
          .from('users')
          .upsert(payload, { onConflict: 'id' })
          .select('*')
          .maybeSingle()

        if (insertErr && (insertErr.code === '23505' || insertErr.message?.includes('unique') || insertErr.message?.includes('username'))) {
          payload.username = `${username.slice(0, 14)}_${targetUid.slice(0, 5)}`
          const retryRes = await supabaseAdmin
            .from('users')
            .upsert(payload, { onConflict: 'id' })
            .select('*')
            .maybeSingle()
          inserted = retryRes.data
          insertErr = retryRes.error
        }

        if (insertErr) {
          return res.status(500).json({ error: sanitizeError(insertErr) })
        }

        return res.status(200).json({ success: true, user: inserted })
      } catch (err) {
        return res.status(500).json({ error: sanitizeError(err, 'Failed to ensure user') })
      }
    }

    if (!workspaceId) {
      return res.status(400).json({ error: 'Missing workspaceId' })
    }

    // Handle read action via POST
    if (action === 'fetch_members') {
      const authRes = await verifyWorkspaceAccess(req, supabaseAdmin, workspaceId, { requireAdmin: false })
      if (authRes.error) {
        return res.status(authRes.status || 403).json({ error: authRes.error })
      }
      return await handleGetMembers(req, res, supabaseAdmin, workspaceId, serviceKey, authRes)
    }

    // All modification actions REQUIRE workspace admin or owner privileges
    const authRes = await verifyWorkspaceAccess(req, supabaseAdmin, workspaceId, { requireAdmin: true })
    if (authRes.error) {
      return res.status(authRes.status || 403).json({ error: authRes.error })
    }

    try {
      if (action === 'create_invite' || action === 'add_member_by_email') {
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
        
        // If user already exists in the system, add directly as member
        if (matchedUid) {
          let insertError = null
          try {
            const { error: insErr } = await supabaseAdmin.from('workspace_members').insert({
              workspace_id: workspaceId,
              user_id: matchedUid,
              role: role || 'member',
              permissions: Array.isArray(permissions) ? permissions : []
            })
            if (insErr) {
              await supabaseAdmin.from('workspace_members').update({
                role: role || 'member',
                permissions: Array.isArray(permissions) ? permissions : []
              }).eq('workspace_id', workspaceId).eq('user_id', matchedUid)
            }
          } catch (e) {
            insertError = e.message || e
          }
          
          // Persist directly into workspace settings.members array
          try {
            const { data: wsData } = await supabaseAdmin.from('workspaces').select('settings').eq('id', workspaceId).maybeSingle()
            const currentSettings = wsData?.settings || {}
            const existingMembersArr = Array.isArray(currentSettings.members) ? [...currentSettings.members] : []
            if (!existingMembersArr.some(m => m.id === matchedUid || (m.email && m.email.toLowerCase() === targetEmail))) {
              existingMembersArr.push({
                id: matchedUid,
                userId: matchedUid,
                email: targetEmail,
                role: role || 'member',
                name: matchedName || targetEmail,
                joinedAt: new Date().toISOString()
              })
              await supabaseAdmin.from('workspaces').update({
                settings: { ...currentSettings, members: existingMembersArr }
              }).eq('id', workspaceId)
            }
          } catch (_) {}

          try { await supabaseAdmin.from('invites').delete().eq('workspace_id', workspaceId).eq('email', targetEmail) } catch (_) {}
          try { await supabaseAdmin.from('workspace_invites').delete().eq('workspace_id', workspaceId).eq('email', targetEmail) } catch (_) {}
          
          await logAdminAction(supabaseAdmin, {
            workspaceId,
            actorId: authRes.user.id,
            action: 'member.add',
            resource: 'workspace_members',
            metadata: { targetUserId: matchedUid, email: targetEmail, role: role || 'member' }
          })

          return res.status(200).json({ success: true, addedAsMember: true, userId: matchedUid, email: targetEmail, insertError })
        }
        
        // If user does not exist yet, save as a Pending Invite
        try {
          await supabaseAdmin.from('invites').delete().eq('workspace_id', workspaceId).eq('email', targetEmail)
        } catch (_) {}

        const { data: inviteRow, error: invErr } = await supabaseAdmin.from('invites').insert({
          workspace_id: workspaceId,
          email: targetEmail,
          role: role || 'member',
          permissions: Array.isArray(permissions) ? permissions : [],
          sent_count: 1,
          created_at: new Date().toISOString()
        }).select().maybeSingle()

        if (invErr) throw invErr

        try {
          await supabaseAdmin.from('workspace_invites').insert({
            workspace_id: workspaceId,
            email: targetEmail,
            role: role || 'member',
            created_at: new Date().toISOString()
          })
        } catch (_) {}

        await logAdminAction(supabaseAdmin, {
          workspaceId,
          actorId: authRes.user.id,
          action: 'invite.create',
          resource: 'invites',
          metadata: { email: targetEmail, role: role || 'member' }
        })

        return res.status(200).json({ success: true, pendingInvite: true, invite: inviteRow || { email: targetEmail, role: role || 'member' } })
      }

      if (action === 'update_workspace_settings') {
        const { error } = await supabaseAdmin
          .from('workspaces')
          .update(patch || {})
          .eq('id', workspaceId)
        if (error) throw error

        await logAdminAction(supabaseAdmin, {
          workspaceId,
          actorId: authRes.user.id,
          action: 'workspace.update_settings',
          resource: 'workspaces',
          metadata: { updatedFields: Object.keys(patch || {}) }
        })

        return res.status(200).json({ success: true })
      }

      if (action === 'force_delete') {
        if (!memberId) return res.status(400).json({ error: 'Missing memberId' })
        const delRes = await supabaseAdmin
          .from('workspace_members')
          .delete()
          .eq('workspace_id', workspaceId)
          .eq('user_id', memberId)

        await logAdminAction(supabaseAdmin, {
          workspaceId,
          actorId: authRes.user.id,
          action: 'member.force_delete',
          resource: 'workspace_members',
          metadata: { targetMemberId: memberId }
        })

        return res.status(200).json({ delRes })
      }

      if (action === 'update_permissions') {
        const cleanPerms = Array.isArray(permissions) ? permissions : []
        const memberEmail = body.email ? body.email.trim().toLowerCase() : null

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

        try {
          await supabaseAdmin
            .from('workspace_members')
            .update({ permissions: cleanPerms })
            .eq('workspace_id', workspaceId)
            .eq('user_id', memberId)
        } catch (_) {}

        await logAdminAction(supabaseAdmin, {
          workspaceId,
          actorId: authRes.user.id,
          action: 'member.update_permissions',
          resource: 'workspace_members',
          metadata: { targetMemberId: memberId, permissionsCount: cleanPerms.length }
        })

        return res.status(200).json({ success: true, permissions: cleanPerms })
      }

      if (action === 'delete_member' || action === 'remove_member') {
        const cleanEmail = body.email ? body.email.trim().toLowerCase() : ''
        const targetUserIds = new Set()
        if (memberId && !memberId.includes('@')) targetUserIds.add(memberId)

        if (cleanEmail) {
          try {
            const { data: uData } = await supabaseAdmin.from('users').select('id').ilike('email', cleanEmail)
            for (const u of (uData || [])) { if (u.id) targetUserIds.add(u.id) }
          } catch (_) {}
          try {
            const { data: pData } = await supabaseAdmin.from('profiles').select('id').ilike('email', cleanEmail)
            for (const p of (pData || [])) { if (p.id) targetUserIds.add(p.id) }
          } catch (_) {}
          if (serviceKey) {
            try {
              const { data: authList } = await supabaseAdmin.auth.admin.listUsers()
              for (const au of (authList?.users || [])) {
                if (au.email?.toLowerCase() === cleanEmail) targetUserIds.add(au.id)
              }
            } catch (_) {}
          }
        }

        const idsList = Array.from(targetUserIds)

        // 1. Clean up workspaces.settings
        try {
          const { data: ws } = await supabaseAdmin.from('workspaces').select('settings').eq('id', workspaceId).maybeSingle()
          const currentSettings = { ...(ws?.settings || {}) }
          let settingsChanged = false

          if (Array.isArray(currentSettings.members)) {
            const filtered = currentSettings.members.filter(m => {
              const mId = m.id || m.userId
              const mEmail = (m.email || '').trim().toLowerCase()
              if (mId && (idsList.includes(mId) || mId === memberId)) return false
              if (mEmail && cleanEmail && mEmail === cleanEmail) return false
              return true
            })
            if (filtered.length !== currentSettings.members.length) {
              currentSettings.members = filtered
              settingsChanged = true
            }
          }

          if (currentSettings.member_permissions) {
            const perms = { ...currentSettings.member_permissions }
            for (const id of idsList) { if (perms[id]) { delete perms[id]; settingsChanged = true } }
            if (memberId && perms[memberId]) { delete perms[memberId]; settingsChanged = true }
            if (cleanEmail && perms[cleanEmail]) { delete perms[cleanEmail]; settingsChanged = true }
            currentSettings.member_permissions = perms
          }

          if (settingsChanged) {
            await supabaseAdmin.from('workspaces').update({ settings: currentSettings }).eq('id', workspaceId)
          }
        } catch (_) {}

        // 2. Delete from workspace_members table
        if (memberId) {
          try { await supabaseAdmin.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', memberId) } catch (_) {}
        }
        for (const id of idsList) {
          try { await supabaseAdmin.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', id) } catch (_) {}
        }

        await logAdminAction(supabaseAdmin, {
          workspaceId,
          actorId: authRes.user.id,
          action: 'member.remove',
          resource: 'workspace_members',
          metadata: { targetMemberId: memberId, email: cleanEmail }
        })

        return res.status(200).json({
          success: true,
          deleted: true,
          memberId,
          deletedUserIds: idsList
        })
      }

      if (action === 'update_role') {
        const cleanRole = role === 'admin' ? 'admin' : 'member'
        const { error } = await supabaseAdmin
          .from('workspace_members')
          .update({ role: cleanRole })
          .eq('workspace_id', workspaceId)
          .eq('user_id', memberId)

        if (error) throw error

        await logAdminAction(supabaseAdmin, {
          workspaceId,
          actorId: authRes.user.id,
          action: 'member.update_role',
          resource: 'workspace_members',
          metadata: { targetMemberId: memberId, newRole: cleanRole }
        })

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

        await logAdminAction(supabaseAdmin, {
          workspaceId,
          actorId: authRes.user.id,
          action: 'invite.cancel',
          resource: 'invites',
          metadata: { email: cleanEmail, inviteId }
        })

        return res.status(200).json({ success: true, cancelled: true })
      }
    } catch (postErr) {
      console.error('Update member error:', postErr?.message || postErr)
      return res.status(500).json({ error: sanitizeError(postErr, 'Failed to update member') })
    }
  }

  // GET: Fetch Members
  const workspaceId = req.query.workspaceId || req.body?.workspaceId
  if (!workspaceId) {
    return res.status(400).json({ error: 'Missing workspaceId parameter' })
  }

  const authRes = await verifyWorkspaceAccess(req, supabaseAdmin, workspaceId, { requireAdmin: false })
  if (authRes.error) {
    return res.status(authRes.status || 403).json({ error: authRes.error })
  }

  return await handleGetMembers(req, res, supabaseAdmin, workspaceId, serviceKey, authRes)
}

async function handleGetMembers(req, res, supabaseAdmin, workspaceId, serviceKey, authRes) {
  try {
    const { data: members, error: memErr } = await supabaseAdmin
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)

    if (memErr) throw memErr

    const userIds = (members || []).map(m => m.user_id).filter(Boolean)
    const userDetailsMap = new Map()

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

    let memberPermsMap = {}
    let wsData = null
    try {
      const { data } = await supabaseAdmin
        .from('workspaces')
        .select('settings')
        .eq('id', workspaceId)
        .maybeSingle()
      wsData = data
      if (wsData?.settings?.member_permissions) {
        memberPermsMap = wsData.settings.member_permissions
      }
    } catch (_) {}

    const isCallerAdmin = authRes.isAdmin
    const callerUid = authRes.user.id

    const enrichedMembers = (members || []).map(m => {
      const u = userDetailsMap.get(m.user_id) || {}
      const rawEmail = u.email || m.email || null
      const fullName = u.full_name || m.full_name || null
      const cleanEmail = (rawEmail || '').toLowerCase().trim()
      const displayLabel = fullName || (rawEmail ? rawEmail.split('@')[0] : `Member (${(m.user_id || '').slice(0, 6)})`)
      const perms = memberPermsMap[m.user_id] || (cleanEmail ? memberPermsMap[cleanEmail] : null) || (Array.isArray(m.permissions) ? m.permissions : [])

      // Privacy Isolation: Only admins see all members' real email addresses.
      // Non-admin members see display name and only their own email address.
      const safeEmail = isCallerAdmin || m.user_id === callerUid ? rawEmail : null

      return {
        id: m.user_id,
        userId: m.user_id,
        workspaceId: m.workspace_id,
        role: m.role || 'member',
        permissions: Array.isArray(perms) ? perms : [],
        email: safeEmail,
        name: fullName || displayLabel,
        fullName: fullName,
        displayLabel: displayLabel,
        avatarUrl: u.avatar_url || null,
        joinedAt: m.joined_at || m.created_at
      }
    })

    return res.status(200).json({ success: true, members: enrichedMembers })
  } catch (err) {
    console.error('workspace-members API error:', err?.message || err)
    return res.status(500).json({ error: sanitizeError(err, 'Failed to fetch members') })
  }
}
