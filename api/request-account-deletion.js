import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { workspaceId, userId, email, action = 'request', reason = '' } = req.body || {}
  if (!workspaceId || (!userId && !email)) {
    return res.status(400).json({ error: 'Missing workspaceId, userId, or email parameter' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://sdbglndhjkqhkphzqmum.supabase.co'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const activeKey = serviceKey || anonKey

  if (!activeKey) {
    return res.status(500).json({ error: 'Supabase credentials missing' })
  }

  const supabaseAdmin = createClient(supabaseUrl, activeKey)

  try {
    // 1. Fetch current workspace settings
    const { data: ws, error: wsErr } = await supabaseAdmin
      .from('workspaces')
      .select('id, name, settings')
      .eq('id', workspaceId)
      .maybeSingle()

    if (wsErr) throw wsErr
    if (!ws) return res.status(404).json({ error: 'Workspace not found' })

    const currentSettings = ws.settings || {}
    const deletionRequests = { ...(currentSettings.deletion_requests || {}) }
    const targetKey = userId || email.trim().toLowerCase()

    if (action === 'cancel' || action === 'reject') {
      delete deletionRequests[targetKey]
      if (userId && deletionRequests[userId]) delete deletionRequests[userId]
      if (email && deletionRequests[email.trim().toLowerCase()]) delete deletionRequests[email.trim().toLowerCase()]

      await supabaseAdmin
        .from('workspaces')
        .update({
          settings: {
            ...currentSettings,
            deletion_requests: deletionRequests
          }
        })
        .eq('id', workspaceId)

      return res.status(200).json({ success: true, message: 'Deletion request cancelled', deletionRequests })
    }

    // Action: 'request'
    const requestData = {
      userId: userId || null,
      email: email ? email.trim().toLowerCase() : '',
      requestedAt: new Date().toISOString(),
      status: 'pending',
      reason: reason || 'User requested account deletion'
    }

    deletionRequests[targetKey] = requestData

    // Update workspace settings
    await supabaseAdmin
      .from('workspaces')
      .update({
        settings: {
          ...currentSettings,
          deletion_requests: deletionRequests
        }
      })
      .eq('id', workspaceId)

    // 2. Fetch workspace admins & owners to notify them
    try {
      const { data: adminMembers } = await supabaseAdmin
        .from('workspace_members')
        .select('user_id, role')
        .eq('workspace_id', workspaceId)
        .in('role', ['admin', 'owner'])

      const adminUserIds = (adminMembers || []).map(m => m.user_id).filter(Boolean)
      let adminEmails = []

      if (adminUserIds.length > 0) {
        const { data: usersData } = await supabaseAdmin
          .from('users')
          .select('email')
          .in('id', adminUserIds)

        adminEmails = (usersData || []).map(u => u.email).filter(Boolean)
      }

      // Also get profile emails if users table is sparse
      if (adminEmails.length === 0 && adminUserIds.length > 0) {
        const { data: profData } = await supabaseAdmin
          .from('profiles')
          .select('email')
          .in('id', adminUserIds)
        adminEmails = (profData || []).map(p => p.email).filter(Boolean)
      }

      // 3. Create notifications for all admins
      const notifPromises = adminEmails.map(adminEmail => {
        return supabaseAdmin.from('notifications').insert({
          workspace_id: workspaceId,
          type: 'account_deletion_request',
          message: `${email || 'A user'} has requested account deletion. Review and approve in Settings.`,
          forEmail: adminEmail.toLowerCase(),
          createdBy: (email || '').toLowerCase(),
          readBy: [],
        })
      })

      // Also create a confirmation notification for the user
      if (email) {
        notifPromises.push(
          supabaseAdmin.from('notifications').insert({
            workspace_id: workspaceId,
            type: 'account_deletion_request',
            message: 'Your account deletion request has been submitted to your workspace Administrator for review.',
            forEmail: email.toLowerCase(),
            createdBy: (email || '').toLowerCase(),
            readBy: [],
          })
        )
      }

      await Promise.allSettled(notifPromises)
    } catch (notifErr) {
      console.warn('Admin notification notice:', notifErr.message)
    }

    return res.status(200).json({
      success: true,
      message: 'Account deletion request submitted. An admin will review and finalize your deletion.',
      request: requestData,
      deletionRequests
    })
  } catch (err) {
    console.error('Request account deletion error:', err)
    return res.status(500).json({ error: err.message || 'Failed to submit account deletion request' })
  }
}
