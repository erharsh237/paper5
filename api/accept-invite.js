import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, userId, workspaceId } = req.body || {}
  if (!email || !userId) {
    return res.status(400).json({ error: 'Missing email or userId parameter' })
  }

  const cleanEmail = email.trim().toLowerCase()
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sdbglndhjkqhkphzqmum.supabase.co'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY missing on Vercel')
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey)

  try {
    // 1. Fetch all pending invites matching cleanEmail
    const { data: invites } = await supabaseAdmin
      .from('invites')
      .select('*')
      .ilike('email', cleanEmail)

    const { data: legacyInvites } = await supabaseAdmin
      .from('workspace_invites')
      .select('*')
      .ilike('email', cleanEmail)

    const combined = [...(invites || []), ...(legacyInvites || [])]
    let acceptedWorkspaceId = workspaceId || null

    for (const inv of combined) {
      const wsId = inv.workspace_id
      if (wsId) {
        if (!acceptedWorkspaceId) acceptedWorkspaceId = wsId
        await supabaseAdmin.from('workspace_members').upsert({
          workspace_id: wsId,
          user_id: userId,
          role: inv.role || 'member'
        }, { onConflict: 'workspace_id,user_id' })
      }
    }

    // Clean up accepted invites
    if (combined.length > 0) {
      await supabaseAdmin.from('invites').delete().ilike('email', cleanEmail)
      await supabaseAdmin.from('workspace_invites').delete().ilike('email', cleanEmail)
    }

    // 2. If a specific workspaceId was requested, verify/grant membership
    if (workspaceId) {
      const { data: existing } = await supabaseAdmin
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .maybeSingle()

      if (!existing) {
        await supabaseAdmin.from('workspace_members').upsert({
          workspace_id: workspaceId,
          user_id: userId,
          role: 'member'
        }, { onConflict: 'workspace_id,user_id' })
      }
      acceptedWorkspaceId = workspaceId
    }

    return res.status(200).json({ success: true, workspaceId: acceptedWorkspaceId })
  } catch (err) {
    console.error('accept-invite server error:', err)
    return res.status(500).json({ error: err?.message || 'Server error' })
  }
}
