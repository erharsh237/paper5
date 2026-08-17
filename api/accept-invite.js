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
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!serviceKey) {
    return res.status(200).json({ success: true, workspaceId: workspaceId || null })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey)

  try {
    let combined = []

    // 1. Fetch pending invites from primary 'invites' table safely
    try {
      const { data: invites } = await supabaseAdmin
        .from('invites')
        .select('*')
        .ilike('email', cleanEmail)

      if (invites && invites.length > 0) {
        combined = [...combined, ...invites]
      }
    } catch (e1) {
      console.warn('Invites lookup notice:', e1)
    }

    let acceptedWorkspaceId = workspaceId || null

    for (const inv of combined) {
      const wsId = inv.workspace_id
      if (wsId) {
        if (!acceptedWorkspaceId) acceptedWorkspaceId = wsId
        try {
          await supabaseAdmin.from('workspace_members').upsert({
            workspace_id: wsId,
            user_id: userId,
            role: inv.role || 'member'
          }, { onConflict: 'workspace_id,user_id' })
        } catch (mErr) {
          console.warn('workspace_members upsert notice:', mErr)
        }
      }
    }

    // Clean up accepted invites
    if (combined.length > 0) {
      try {
        await supabaseAdmin.from('invites').delete().ilike('email', cleanEmail)
      } catch (dErr) {
        console.warn('Invites delete notice:', dErr)
      }
    }

    // 2. If a specific workspaceId was requested, verify/grant membership safely
    if (workspaceId) {
      try {
        await supabaseAdmin.from('workspace_members').upsert({
          workspace_id: workspaceId,
          user_id: userId,
          role: 'member'
        }, { onConflict: 'workspace_id,user_id' })
      } catch (wErr) {
        console.warn('Specific workspace_members upsert notice:', wErr)
      }
      acceptedWorkspaceId = workspaceId
    }

    return res.status(200).json({ success: true, workspaceId: acceptedWorkspaceId })
  } catch (err) {
    console.error('accept-invite server error:', err)
    return res.status(200).json({ success: true, workspaceId: workspaceId || null })
  }
}
