import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
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

  const body = await parseBody(req)
  const action = (body.action || req.query?.action || (req.method === 'DELETE' ? 'delete_workspace' : '')).toLowerCase().trim()
  const workspaceId = body.workspaceId || body.workspace_id || req.query?.workspaceId || req.query?.workspace_id

  // ─────────────────────────────────────────────────────────────
  // 1. ACTION: ENSURE USER IN public.users (Rewritten from /api/ensure-user)
  // ─────────────────────────────────────────────────────────────
  if (action === 'ensure_user' || action === 'ensure-user') {
    const targetUid = body.userId || body.uid || body.id
    const targetEmail = (body.email || '').trim().toLowerCase()
    if (!targetUid) {
      return res.status(400).json({ error: 'Missing userId in request' })
    }

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
        if (body.legal_accepted_version || body.legal_accepted_at) {
          const updateData = {}
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
        billing_plan_id: 'starter',
        billing_status: 'active',
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

  // ── CREATE WORKSPACE (Schema-safe server-side provisioning fallback) ───────
  if (req.method === 'POST' && action === 'create_workspace') {
    const callerAuth = await authenticateUser(req, supabaseAdmin)
    if (callerAuth.error) {
      return res.status(callerAuth.status || 401).json({ error: callerAuth.error })
    }
    const uid = callerAuth.user.id
    const wsName = (body.name || '').trim()
    if (!wsName) {
      return res.status(400).json({ error: 'Workspace name is required' })
    }

    try {
      const { data: userRow } = await supabaseAdmin
        .from('users')
        .select('billing_plan_id')
        .eq('id', uid)
        .maybeSingle()

      const rawTier = (userRow?.billing_plan_id || body.planId || 'starter').toLowerCase().trim()
      const userTier = rawTier === 'scale' ? 'pro' : (rawTier === 'free' ? 'starter' : (['starter', 'team', 'pro'].includes(rawTier) ? rawTier : 'starter'))
      const maxWs = userTier === 'pro' ? 10 : (userTier === 'team' ? 5 : 1)

      const { count: existingCount } = await supabaseAdmin
        .from('workspaces')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', uid)

      if (existingCount !== null && existingCount >= maxWs) {
        return res.status(403).json({
          error: `Workspace quota exceeded: Your ${userTier.toUpperCase()} plan allows up to ${maxWs} workspace${maxWs === 1 ? '' : 's'}.`
        })
      }

      const newWsId = crypto.randomUUID()
      const cleanCycle = body.billingInterval === 'annual' ? 'annual' : 'monthly'
      const now = new Date()
      const expDate = new Date(now)
      if (cleanCycle === 'annual') expDate.setFullYear(expDate.getFullYear() + 1)
      else expDate.setMonth(expDate.getMonth() + 1)

      const initialInvoice = {
        id: `INV-${userTier.toUpperCase()}-${cleanCycle.toUpperCase()}-${now.getFullYear()}-001`,
        invoiceNumber: `INV-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
        date: now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        rawDate: now.toISOString(),
        expiryDate: expDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        cycle: cleanCycle === 'annual' ? 'Annual (12 Months)' : 'Monthly (1 Month)',
        plan: `${userTier.charAt(0).toUpperCase() + userTier.slice(1)} Plan (${cleanCycle === 'annual' ? 'Annual' : 'Monthly'})`,
        planId: userTier,
        changeType: 'Initial Workspace Setup',
        amount: '₹0',
        status: 'Paid',
        workspaceName: wsName
      }

      const { error: wsErr } = await supabaseAdmin.from('workspaces').insert({
        id: newWsId,
        name: wsName,
        created_by: uid,
        billing_plan_id: userTier,
        billing_status: 'active',
        is_active: true,
        settings: {
          team_size: body.teamSize || '2-5',
          agile_workflow: body.agileWorkflow || 'kanban',
          save_data: Boolean(body.saveData),
          billing_interval: cleanCycle,
          invoices: [initialInvoice]
        },
        created_at: now.toISOString()
      })
      if (wsErr) {
        return res.status(400).json({ error: wsErr.message || 'Failed to create workspace' })
      }

      const { error: memErr } = await supabaseAdmin.from('workspace_members').insert({
        workspace_id: newWsId,
        user_id: uid,
        role: 'owner',
        joined_at: now.toISOString()
      })
      if (memErr) {
        await supabaseAdmin.from('workspaces').delete().eq('id', newWsId)
        return res.status(400).json({ error: memErr.message || 'Failed to assign workspace owner' })
      }

      return res.status(200).json({ success: true, workspaceId: newWsId, id: newWsId })
    } catch (err) {
      return res.status(500).json({ error: sanitizeError(err, 'Failed to create workspace') })
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ACTION: DELETE USER / SELF ACCOUNT PURGE (Rewritten from /api/delete-user)
  // ─────────────────────────────────────────────────────────────
  if (action === 'delete_user' || action === 'delete-user') {
    const { userId, email, memberId, fullDelete = true } = body || {}
    const targetId = userId || memberId
    const cleanEmail = email ? email.trim().toLowerCase() : ''

    if (!targetId && !cleanEmail) {
      return res.status(400).json({ error: 'Missing userId, memberId or email parameter' })
    }

    const authRes = await authenticateUser(req, supabaseAdmin)
    if (authRes.error) {
      return res.status(authRes.status || 401).json({ error: authRes.error })
    }

    const isSelf = (targetId && targetId === authRes.user.id) || (cleanEmail && cleanEmail === authRes.user.email?.toLowerCase())
    if (!isSelf) {
      if (!workspaceId) {
        return res.status(403).json({ error: 'Access denied: Workspace ID required for administrative user removal.' })
      }
      const wsAuth = await verifyWorkspaceAccess(req, supabaseAdmin, workspaceId, { requireAdmin: true })
      if (wsAuth.error) {
        return res.status(wsAuth.status || 403).json({ error: wsAuth.error })
      }
    }

    try {
      const targetUserIds = new Set()
      if (targetId && !targetId.includes('@')) targetUserIds.add(targetId)

      if (cleanEmail) {
        try {
          const { data: uData } = await supabaseAdmin.from('users').select('id').ilike('email', cleanEmail)
          for (const u of (uData || [])) { if (u.id) targetUserIds.add(u.id) }
        } catch (_) {}

        try {
          const { data: pData } = await supabaseAdmin.from('profiles').select('id').ilike('email', cleanEmail)
          for (const p of (pData || [])) { if (p.id) targetUserIds.add(p.id) }
        } catch (_) {}

        if (serviceKey && typeof supabaseAdmin.auth?.admin?.listUsers === 'function') {
          try {
            const { data: authList } = await supabaseAdmin.auth.admin.listUsers()
            for (const au of (authList?.users || [])) {
              if (au.email?.toLowerCase() === cleanEmail) {
                targetUserIds.add(au.id)
              }
            }
          } catch (_) {}
        }
      }

      const idsList = Array.from(targetUserIds)

      // Admin removing member from workspace only
      if (!isSelf) {
        for (const id of idsList) {
          await supabaseAdmin.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', id)
        }

        try {
          const { data: wsRecord } = await supabaseAdmin.from('workspaces').select('settings').eq('id', workspaceId).maybeSingle()
          if (wsRecord?.settings) {
            const s = { ...wsRecord.settings }
            if (Array.isArray(s.members)) {
              s.members = s.members.filter(m => !idsList.includes(m.id) && !idsList.includes(m.userId) && (m.email?.toLowerCase() !== cleanEmail))
            }
            if (s.member_permissions) {
              for (const id of idsList) delete s.member_permissions[id]
              if (cleanEmail) delete s.member_permissions[cleanEmail]
            }
            await supabaseAdmin.from('workspaces').update({ settings: s }).eq('id', workspaceId)
          }
        } catch (_) {}

        return res.status(200).json({ success: true, message: 'Member removed from workspace successfully.', workspaceId })
      }

      // Self account deletion: Purge user's owned workspaces
      const ownedWorkspaceIds = new Set()
      for (const id of idsList) {
        try {
          const { data: createdWs } = await supabaseAdmin.from('workspaces').select('id').or(`created_by.eq.${id}`)
          for (const w of (createdWs || [])) { if (w.id) ownedWorkspaceIds.add(w.id) }
        } catch (_) {}

        try {
          const { data: memberOwnedWs } = await supabaseAdmin.from('workspace_members').select('workspace_id').eq('user_id', id).eq('role', 'owner')
          for (const w of (memberOwnedWs || [])) { if (w.workspace_id) ownedWorkspaceIds.add(w.workspace_id) }
        } catch (_) {}
      }

      for (const wsId of ownedWorkspaceIds) {
        try {
          try { await supabaseAdmin.rpc('delete_workspace_completely', { target_workspace_id: wsId }) } catch (_) {}
          await Promise.allSettled([
            supabaseAdmin.from('invites').delete().eq('workspace_id', wsId),
            supabaseAdmin.from('workspace_invites').delete().eq('workspace_id', wsId),
            supabaseAdmin.from('deadlines').delete().eq('workspace_id', wsId),
            supabaseAdmin.from('sprints').delete().eq('workspace_id', wsId),
            supabaseAdmin.from('meetings').delete().eq('workspace_id', wsId),
            supabaseAdmin.from('audit_logs').delete().eq('workspace_id', wsId),
            supabaseAdmin.from('evidence').delete().eq('workspace_id', wsId),
            supabaseAdmin.from('extra_work').delete().eq('workspace_id', wsId),
            supabaseAdmin.from('workspace_members').delete().eq('workspace_id', wsId),
            supabaseAdmin.from('workspaces').delete().eq('id', wsId)
          ])
        } catch (wsErr) {
          console.warn('Error purging owned workspace in delete-user:', wsErr.message)
        }
      }

      // Clean workspaces metadata
      try {
        const { data: wsList } = await supabaseAdmin.from('workspaces').select('id, settings')
        for (const ws of (wsList || [])) {
          if (!ws.settings) continue
          let settingsChanged = false
          const currentSettings = { ...ws.settings }
          if (Array.isArray(currentSettings.members)) {
            const filtered = currentSettings.members.filter(m => {
              const mId = m.id || m.userId
              const mEmail = (m.email || '').trim().toLowerCase()
              if (mId && (idsList.includes(mId) || mId === targetId)) return false
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
            if (targetId && perms[targetId]) { delete perms[targetId]; settingsChanged = true }
            if (cleanEmail && perms[cleanEmail]) { delete perms[cleanEmail]; settingsChanged = true }
            currentSettings.member_permissions = perms
          }
          if (settingsChanged) {
            await supabaseAdmin.from('workspaces').update({ settings: currentSettings }).eq('id', ws.id)
          }
        }
      } catch (_) {}

      // Delete from workspace_members, profiles, users
      for (const id of idsList) {
        try { await supabaseAdmin.from('workspace_members').delete().eq('user_id', id) } catch (_) {}
        try { await supabaseAdmin.from('notifications').delete().eq('user_id', id) } catch (_) {}
        try { await supabaseAdmin.from('audit_logs').delete().eq('actor_id', id) } catch (_) {}
        try { await supabaseAdmin.from('profiles').delete().eq('id', id) } catch (_) {}
        try { await supabaseAdmin.from('users').delete().eq('id', id) } catch (_) {}
      }
      if (cleanEmail) {
        try { await supabaseAdmin.from('invites').delete().ilike('email', cleanEmail) } catch (_) {}
        try { await supabaseAdmin.from('workspace_invites').delete().ilike('email', cleanEmail) } catch (_) {}
        try { await supabaseAdmin.from('notifications').delete().ilike('forEmail', cleanEmail) } catch (_) {}
        try { await supabaseAdmin.from('profiles').delete().ilike('email', cleanEmail) } catch (_) {}
        try { await supabaseAdmin.from('users').delete().ilike('email', cleanEmail) } catch (_) {}
      }

      // Purge from Supabase Auth
      let authDeleted = false
      let authError = null
      if (serviceKey && typeof supabaseAdmin.auth?.admin?.deleteUser === 'function') {
        for (const id of idsList) {
          try {
            const { error: aErr } = await supabaseAdmin.auth.admin.deleteUser(id)
            if (aErr) authError = aErr.message
            else authDeleted = true
          } catch (authCatchErr) {
            authError = authCatchErr.message
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: 'User account and all associated workspace records permanently deleted',
        accountPurged: true,
        deletedUserIds: idsList,
        authDeleted,
        authError
      })
    } catch (err) {
      console.error('Delete user error:', err?.message || err)
      return res.status(500).json({ error: sanitizeError(err, 'Failed to delete account') })
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. ACTION: REQUEST ACCOUNT DELETION (Rewritten from /api/request-account-deletion)
  // ─────────────────────────────────────────────────────────────
  if (action === 'request_account_deletion' || action === 'request-account-deletion') {
    const { userId, email, reason = '' } = body || {}
    const subAction = (body.subAction || body.mode || (action === 'request_account_deletion' ? body.action : 'request') || 'request').toLowerCase().trim()

    if (!workspaceId || (!userId && !email)) {
      return res.status(400).json({ error: 'Missing workspaceId, userId, or email parameter' })
    }

    const authRes = await authenticateUser(req, supabaseAdmin)
    if (authRes.error) {
      return res.status(authRes.status || 401).json({ error: authRes.error })
    }

    try {
      const { data: ws, error: wsErr } = await supabaseAdmin.from('workspaces').select('id, name, settings').eq('id', workspaceId).maybeSingle()
      if (wsErr) throw wsErr
      if (!ws) return res.status(404).json({ error: 'Workspace not found' })

      const currentSettings = ws.settings || {}
      const deletionRequests = { ...(currentSettings.deletion_requests || {}) }
      const targetKey = userId || email.trim().toLowerCase()

      if (subAction === 'cancel' || subAction === 'reject') {
        delete deletionRequests[targetKey]
        if (userId && deletionRequests[userId]) delete deletionRequests[userId]
        if (email && deletionRequests[email.trim().toLowerCase()]) delete deletionRequests[email.trim().toLowerCase()]

        await supabaseAdmin.from('workspaces').update({ settings: { ...currentSettings, deletion_requests: deletionRequests } }).eq('id', workspaceId)
        return res.status(200).json({ success: true, message: 'Deletion request cancelled', deletionRequests })
      }

      const requestData = {
        userId: userId || null,
        email: email ? email.trim().toLowerCase() : '',
        requestedAt: new Date().toISOString(),
        status: 'pending',
        reason: reason || 'User requested account deletion'
      }

      deletionRequests[targetKey] = requestData
      await supabaseAdmin.from('workspaces').update({ settings: { ...currentSettings, deletion_requests: deletionRequests } }).eq('id', workspaceId)

      // Notify workspace admins
      try {
        const { data: adminMembers } = await supabaseAdmin.from('workspace_members').select('user_id').eq('workspace_id', workspaceId).in('role', ['admin', 'owner'])
        const adminUserIds = (adminMembers || []).map(m => m.user_id).filter(Boolean)
        let adminEmails = []
        if (adminUserIds.length > 0) {
          const { data: usersData } = await supabaseAdmin.from('users').select('email').in('id', adminUserIds)
          adminEmails = (usersData || []).map(u => u.email).filter(Boolean)
        }
        const notifPromises = adminEmails.map(adminEmail => {
          return supabaseAdmin.from('notifications').insert({
            workspace_id: workspaceId,
            type: 'account_deletion_request',
            message: `${email || 'A user'} has requested account deletion. Review and approve in Settings.`,
            forEmail: adminEmail.toLowerCase(),
            createdBy: (email || '').toLowerCase(),
            readBy: []
          })
        })
        await Promise.allSettled(notifPromises)
      } catch (_) {}

      return res.status(200).json({
        success: true,
        message: 'Account deletion request submitted. An admin will review and finalize your deletion.',
        request: requestData,
        deletionRequests
      })
    } catch (err) {
      console.error('Request account deletion error:', err?.message || err)
      return res.status(500).json({ error: sanitizeError(err, 'Failed to submit account deletion request') })
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. ACTION: DELETE WORKSPACE (Rewritten from /api/delete-workspace)
  // ─────────────────────────────────────────────────────────────
  if (action === 'delete_workspace' || action === 'delete-workspace' || req.method === 'DELETE') {
    if (!workspaceId) {
      return res.status(400).json({ error: 'Missing required workspaceId parameter' })
    }

    const authRes = await verifyWorkspaceAccess(req, supabaseAdmin, workspaceId, { requireAdmin: true })
    if (authRes.error) {
      return res.status(authRes.status || 403).json({ error: authRes.error })
    }

    if (!authRes.isOwner) {
      return res.status(403).json({ error: 'Forbidden: Only the workspace owner is authorized to permanently delete this workspace.' })
    }

    try {
      try {
        const { error: rpcError } = await supabaseAdmin.rpc('delete_workspace_completely', { target_workspace_id: workspaceId })
        if (!rpcError) {
          return res.status(200).json({ success: true, message: 'Workspace and all associated data permanently deleted.', workspaceId })
        }
      } catch (_) {}

      // Permanent purge
      await Promise.allSettled([
        supabaseAdmin.from('invites').delete().eq('workspace_id', workspaceId),
        supabaseAdmin.from('workspace_invites').delete().eq('workspace_id', workspaceId),
        supabaseAdmin.from('deadlines').delete().eq('workspace_id', workspaceId),
        supabaseAdmin.from('sprints').delete().eq('workspace_id', workspaceId),
        supabaseAdmin.from('meetings').delete().eq('workspace_id', workspaceId),
        supabaseAdmin.from('audit_logs').delete().eq('workspace_id', workspaceId),
        supabaseAdmin.from('evidence').delete().eq('workspace_id', workspaceId),
        supabaseAdmin.from('extra_work').delete().eq('workspace_id', workspaceId),
        supabaseAdmin.from('workspace_members').delete().eq('workspace_id', workspaceId)
      ])

      const { error: wsDelErr } = await supabaseAdmin.from('workspaces').delete().eq('id', workspaceId)
      if (wsDelErr) throw wsDelErr

      return res.status(200).json({ success: true, message: 'Workspace permanently deleted.', workspaceId })
    } catch (wsErr) {
      console.error('Delete workspace error:', wsErr?.message || wsErr)
      return res.status(500).json({ error: sanitizeError(wsErr, 'Failed to delete workspace') })
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 5. POST: WORKSPACE MEMBER ADMINISTRATION
  // ─────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { memberId, role, permissions, patch } = body || {}

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

    // All modification actions REQUIRE workspace admin or owner privileges and active workspace
    const authRes = await verifyWorkspaceAccess(req, supabaseAdmin, workspaceId, { requireAdmin: true, requireActive: true })
    if (authRes.error) {
      return res.status(authRes.status || 403).json({ error: authRes.error })
    }

    try {
      if (action === 'create_invite' || action === 'add_member_by_email') {
        const targetEmail = (body.email || '').trim().toLowerCase()
        if (!targetEmail) return res.status(400).json({ error: 'Missing email' })
        
        // Enforce member quota server-side
        const { count: currentMemberCount } = await supabaseAdmin
          .from('workspace_members')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)

        if (currentMemberCount !== null && currentMemberCount >= authRes.maxMembers) {
          return res.status(403).json({
            error: `Member quota exceeded: Your ${authRes.plan.toUpperCase()} plan allows up to ${authRes.maxMembers} members per workspace. Please upgrade to add more squad members.`
          })
        }
        
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
        
        // Save as Pending Invite
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
        const { error } = await supabaseAdmin.from('workspaces').update(patch || {}).eq('id', workspaceId)
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
        const delRes = await supabaseAdmin.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', memberId)

        try {
          const { data: ws } = await supabaseAdmin.from('workspaces').select('settings').eq('id', workspaceId).maybeSingle()
          if (ws?.settings) {
            let updated = false
            const s = { ...ws.settings }
            if (Array.isArray(s.members)) {
              s.members = s.members.filter(m => (m.id || m.userId) !== memberId)
              updated = true
            }
            if (s.member_permissions?.[memberId]) {
              delete s.member_permissions[memberId]
              updated = true
            }
            if (updated) {
              await supabaseAdmin.from('workspaces').update({ settings: s }).eq('id', workspaceId)
            }
          }
        } catch (_) {}

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
          const { data: ws } = await supabaseAdmin.from('workspaces').select('settings').eq('id', workspaceId).maybeSingle()
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

          await supabaseAdmin.from('workspaces').update({ settings: { ...currentSettings, member_permissions: memberPerms } }).eq('id', workspaceId)
        } catch (wsErr) {
          console.warn('workspaces settings member_permissions update error:', wsErr.message)
        }

        try {
          await supabaseAdmin.from('workspace_members').update({ permissions: cleanPerms }).eq('workspace_id', workspaceId).eq('user_id', memberId)
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
          if (serviceKey && typeof supabaseAdmin.auth?.admin?.listUsers === 'function') {
            try {
              const { data: authList } = await supabaseAdmin.auth.admin.listUsers()
              for (const au of (authList?.users || [])) {
                if (au.email?.toLowerCase() === cleanEmail) targetUserIds.add(au.id)
              }
            } catch (_) {}
          }
        }

        const idsList = Array.from(targetUserIds)

        // 1. Clean settings.members
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

        return res.status(200).json({ success: true, deleted: true, memberId, deletedUserIds: idsList })
      }

      if (action === 'update_role') {
        const cleanRole = role === 'admin' ? 'admin' : 'member'
        const { error } = await supabaseAdmin.from('workspace_members').update({ role: cleanRole }).eq('workspace_id', workspaceId).eq('user_id', memberId)
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

      if (action === 'resend_invite') {
        const { inviteId, email } = req.body
        const cleanEmail = email ? email.trim().toLowerCase() : null

        let targetInvite = null
        if (inviteId) {
          const { data } = await supabaseAdmin.from('invites').select('*').eq('id', inviteId).maybeSingle()
          targetInvite = data
        } else if (cleanEmail) {
          const { data } = await supabaseAdmin.from('invites').select('*').eq('workspace_id', workspaceId).eq('email', cleanEmail).maybeSingle()
          targetInvite = data
        }

        if (!targetInvite) {
          return res.status(404).json({ error: 'Invite not found' })
        }

        // 1. Instantly deactivate old invite by deleting previous records
        await Promise.allSettled([
          supabaseAdmin.from('invites').delete().eq('id', targetInvite.id),
          supabaseAdmin.from('workspace_invites').delete().eq('workspace_id', workspaceId).eq('email', targetInvite.email)
        ])

        // 2. Insert new invite record with a brand-new ID and fresh timestamp
        const newInviteId = crypto.randomUUID()
        const { data: newInvite, error: insErr } = await supabaseAdmin.from('invites').insert({
          id: newInviteId,
          workspace_id: workspaceId,
          email: targetInvite.email,
          role: targetInvite.role || 'member',
          permissions: Array.isArray(targetInvite.permissions) ? targetInvite.permissions : [],
          invited_by: authRes.user.id,
          sent_count: (targetInvite.sent_count || 1) + 1,
          created_at: new Date().toISOString()
        }).select().maybeSingle()

        if (insErr) {
          throw new Error(insErr.message || 'Failed to generate new invitation record')
        }

        // Ensure member_permissions settings map is preserved
        try {
          const { data: wsData } = await supabaseAdmin.from('workspaces').select('settings, name').eq('id', workspaceId).maybeSingle()
          if (wsData?.settings && Array.isArray(targetInvite.permissions)) {
            const currentSettings = wsData.settings || {}
            const permsMap = { ...(currentSettings.member_permissions || {}) }
            permsMap[targetInvite.email] = targetInvite.permissions
            await supabaseAdmin.from('workspaces').update({
              settings: { ...currentSettings, member_permissions: permsMap }
            }).eq('id', workspaceId)
          }
        } catch (_) {}

        // 3. Dispatch fresh email with the new invite link containing newInviteId
        try {
          const { data: wsInfo } = await supabaseAdmin.from('workspaces').select('name').eq('id', workspaceId).maybeSingle()
          const targetUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'https://app.paper5.co'
          const newInviteLink = `${targetUrl}/join?workspace=${encodeURIComponent(workspaceId)}&inviteId=${encodeURIComponent(newInviteId)}&email=${encodeURIComponent(targetInvite.email)}`
          
          const resendApiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY
          if (resendApiKey) {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: process.env.SENDER_EMAIL || 'Paper5 <no-reply@paper5.co>',
                to: [targetInvite.email],
                reply_to: process.env.REPLY_TO_EMAIL || 'support@paper5.co',
                subject: `You've been invited to join ${wsInfo?.name || 'a team workspace'} on Paper5`,
                html: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;background:#f8fafc;"><div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0;"><div style="display:inline-block;background:#e0e7ff;color:#4338ca;padding:4px 10px;border-radius:9999px;font-weight:700;font-size:12px;margin-bottom:12px;">NEW INVITATION LINK</div><h2 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 12px;">Join ${wsInfo?.name || 'your team'} on Paper5</h2><p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 20px;">A fresh invitation link has been generated for you to collaborate in <strong>${wsInfo?.name || 'a private workspace'}</strong> as a <strong>${targetInvite.role || 'member'}</strong>.<br/><br/><em>Note: Any previous invitation links have been deactivated for security.</em></p><a href="${newInviteLink}" style="display:inline-block;background:#4f46e5;color:#fff!important;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px;margin:16px 0;">Accept Invitation &rarr;</a></div></body></html>`,
                text: `Join ${wsInfo?.name || 'your team'} on Paper5\n\nA fresh invitation link has been generated for you. Previous links have been deactivated.\n\nAccept invitation:\n${newInviteLink}`
              })
            })
          }
        } catch (emailErr) {
          console.warn('Resend invite email dispatch warning:', emailErr)
        }

        await logAdminAction(supabaseAdmin, {
          workspaceId,
          actorId: authRes.user.id,
          action: 'invite.resend',
          resource: 'invites',
          metadata: { email: targetInvite.email, oldInviteId: targetInvite.id, newInviteId }
        })

        return res.status(200).json({
          success: true,
          newInvite,
          message: 'New invitation sent. Previous link deactivated instantly.'
        })
      }
    } catch (postErr) {
      console.error('Update member error:', postErr?.message || postErr)
      return res.status(500).json({ error: sanitizeError(postErr, 'Failed to update member') })
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 6. GET: FETCH MEMBERS
  // ─────────────────────────────────────────────────────────────
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

    const [usersRes, profRes, wsRes] = await Promise.all([
      userIds.length > 0 
        ? supabaseAdmin.from('users').select('id, email, full_name, avatar_url').in('id', userIds)
        : Promise.resolve({ data: [] }),
      userIds.length > 0
        ? supabaseAdmin.from('profiles').select('id, email, name, photoURL').in('id', userIds)
        : Promise.resolve({ data: [] }),
      supabaseAdmin.from('workspaces').select('settings').eq('id', workspaceId).maybeSingle()
    ])

    for (const u of (usersRes?.data || [])) {
      if (u.id) userDetailsMap.set(u.id, u)
    }

    for (const p of (profRes?.data || [])) {
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

    let memberPermsMap = {}
    const wsData = wsRes?.data || null
    if (wsData?.settings?.member_permissions) {
      memberPermsMap = wsData.settings.member_permissions
    }

    const isCallerAdmin = authRes.isAdmin
    const callerUid = authRes.user.id

    const enrichedMembers = (members || []).map(m => {
      const u = userDetailsMap.get(m.user_id) || {}
      const rawEmail = u.email || m.email || null
      const fullName = u.full_name || m.full_name || null
      const cleanEmail = (rawEmail || '').toLowerCase().trim()
      const displayLabel = fullName || (rawEmail ? rawEmail.split('@')[0] : `Member (${(m.user_id || '').slice(0, 6)})`)
      const perms = memberPermsMap[m.user_id] || (cleanEmail ? memberPermsMap[cleanEmail] : null) || (Array.isArray(m.permissions) ? m.permissions : [])

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
