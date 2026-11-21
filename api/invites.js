import { createClient } from '@supabase/supabase-js'
import { authenticateUser, verifyWorkspaceAccess } from './_auth.js'
import { checkRateLimit } from './_rateLimit.js'
import { sanitizeError } from './_errors.js'

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (req.body && typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch (_) { return {} }
  }
  return req.body || {}
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const activeKey = serviceKey || anonKey

  if (!rawUrl || !activeKey) {
    return res.status(500).json({ error: 'Supabase credentials missing' })
  }

  const supabaseUrl = rawUrl.replace(/["']/g, '').trim()
  const supabaseAdmin = createClient(supabaseUrl, activeKey.replace(/["']/g, '').trim())
  const hasElevatedAccess = Boolean(serviceKey)

  const body = parseBody(req)
  const action = req.query?.action || body.action || (req.url && req.url.includes('send-invite') ? 'send' : 'accept')

  // ─────────────────────────────────────────────────────────────
  // 1. SEND INVITATION / TASK ASSIGNMENT / BLOCKER ALERT EMAIL
  // ─────────────────────────────────────────────────────────────
  if (action === 'send') {
    if (checkRateLimit(req, res, { max: 30, windowMs: 60000 })) return

    const { type, email, toEmail, toName, role, workspaceName, workspaceId, title, description, dueDate, priority, assignedBy, blockerReason, blockerUser, appUrl } = body
    const cleanEmail = (email || toEmail || '').trim().toLowerCase()

    if (!cleanEmail) {
      return res.status(400).json({ error: 'Missing required parameter: email' })
    }

    if (workspaceId) {
      const wsAuth = await verifyWorkspaceAccess(req, supabaseAdmin, workspaceId)
      if (wsAuth.error) {
        return res.status(wsAuth.status || 403).json({ error: wsAuth.error })
      }
    } else {
      const userAuth = await authenticateUser(req, supabaseAdmin)
      if (userAuth.error) {
        return res.status(userAuth.status || 401).json({ error: userAuth.error })
      }
    }

    const resendApiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY
    const targetUrl = appUrl || 'https://app.paper5.co'

    let subject = ''
    let textBody = ''
    let htmlBody = ''

    if (type === 'deadline' || (title && dueDate)) {
      const assigneeDisplayName = toName || cleanEmail.split('@')[0]
      const creatorName = assignedBy || 'A team member'
      const taskPriority = (priority || 'medium').toUpperCase()
      const formattedDueDate = dueDate ? new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No due date'
      subject = `📋 [SprintOS] New Deadline Assigned: "${title || 'Task'}"`
      textBody = `New Deadline Assigned\n\nHi ${assigneeDisplayName},\n\n${creatorName} assigned you a new deadline on SprintOS.\n\nTask: ${title || 'Untitled Task'}\nDue Date: ${formattedDueDate}\nPriority: ${taskPriority}\n${description ? `Details: ${description}\n` : ''}\nView task: ${targetUrl}`
      htmlBody = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;background:#f8fafc;"><div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0;"><div style="display:inline-block;background:#e0e7ff;color:#4338ca;padding:4px 10px;border-radius:9999px;font-weight:700;font-size:12px;margin-bottom:12px;">TASK ASSIGNMENT</div><h2 style="font-size:18px;font-weight:800;color:#0f172a;margin:0 0 12px;">You have been assigned a new task</h2><p style="font-size:14px;color:#334155;"><strong>${creatorName}</strong> has assigned you to <strong>"${title || 'Untitled Task'}"</strong>${workspaceName ? ` in <strong>${workspaceName}</strong>` : ''}.</p><div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e2e8f0;"><div><strong>Task:</strong> ${title || 'Untitled Task'}</div><div style="margin-top:8px;"><strong>Due Date:</strong> ${formattedDueDate} &bull; <strong>Priority:</strong> ${taskPriority}</div>${description ? `<div style="margin-top:8px;font-size:13px;color:#475569;">${description}</div>` : ''}</div><a href="${targetUrl}" style="display:inline-block;background:#4f46e5;color:#fff!important;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px;margin-top:16px;">Open Task in SprintOS &rarr;</a></div></body></html>`
    } else if (type === 'blocker') {
      const reporterName = blockerUser || assignedBy || 'A team member'
      subject = `🚨 [SprintOS] Blocker Flagged: "${title || 'Task'}"`
      textBody = `Blocker Flagged\n\n${reporterName} flagged a blocker on "${title || 'Task'}".\n\nReason: ${blockerReason || 'No blocker reason provided.'}\n\nResolve or view details: ${targetUrl}`
      htmlBody = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;background:#f8fafc;"><div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #fecaca;"><div style="display:inline-block;background:#fee2e2;color:#b91c1c;padding:4px 10px;border-radius:9999px;font-weight:700;font-size:12px;margin-bottom:12px;">BLOCKER ALERT</div><h2 style="font-size:18px;font-weight:800;color:#991b1b;margin:0 0 12px;">A blocker has been reported</h2><p style="font-size:14px;color:#334155;"><strong>${reporterName}</strong> reported an obstacle on <strong>"${title || 'Untitled Task'}"</strong>.</p><div style="background:#fff1f2;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #fecdd3;"><strong style="color:#991b1b;">Blocker Reason:</strong><p style="margin:8px 0 0;font-size:14px;color:#4c0519;">${blockerReason || 'No details provided.'}</p></div><a href="${targetUrl}" style="display:inline-block;background:#dc2626;color:#fff!important;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px;margin-top:16px;">View Blocker on Dashboard &rarr;</a></div></body></html>`
    } else {
      const inviteLink = `${targetUrl}/join?email=${encodeURIComponent(cleanEmail)}`
      subject = `You've been invited to join ${workspaceName || 'a team workspace'} on SprintOS`
      textBody = `You've been invited to join ${workspaceName || 'a workspace'} on SprintOS as ${role || 'member'}.\n\nClick the link below to accept your invitation:\n${inviteLink}\n\nSign in to get started.`
      htmlBody = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;background:#f8fafc;"><div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0;"><div style="display:inline-block;background:#e0e7ff;color:#4338ca;padding:4px 10px;border-radius:9999px;font-weight:700;font-size:12px;margin-bottom:12px;">WORKSPACE INVITATION</div><h2 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 12px;">Join ${workspaceName || 'your team'} on SprintOS</h2><p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 20px;">You've been invited to collaborate in <strong>${workspaceName || 'a private workspace'}</strong> as a <strong>${role || 'member'}</strong>.</p><a href="${inviteLink}" style="display:inline-block;background:#4f46e5;color:#fff!important;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px;margin:16px 0;">Accept Invitation &rarr;</a></div></body></html>`
    }

    let emailSent = false
    let resendDetails = null

    if (resendApiKey) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: process.env.SENDER_EMAIL || 'SprintOS <no-reply@paper5.co>',
            to: [cleanEmail],
            reply_to: process.env.REPLY_TO_EMAIL || 'support@paper5.co',
            subject,
            html: htmlBody,
            text: textBody
          })
        })

        const data = await response.json()
        if (response.ok && data.id) {
          emailSent = true
          resendDetails = data
        } else {
          resendDetails = data
        }
      } catch (e) {
        console.error('[API send-invite] Resend fetch exception:', e)
      }
    }

    return res.status(200).json({ success: true, emailSent, resendDetails })
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ACCEPT INVITATION / JOIN WORKSPACE
  // ─────────────────────────────────────────────────────────────
  const { email, userId, workspaceId } = body || {}
  if (!email && !userId) {
    return res.status(400).json({ error: 'Missing email or userId parameter' })
  }

  const cleanEmail = email ? email.trim().toLowerCase() : ''

  try {
    let acceptedWorkspaceId = workspaceId || null
    let targetUserId = userId || null

    if (!targetUserId && cleanEmail && hasElevatedAccess) {
      try {
        const { data: listRes } = await supabaseAdmin.auth.admin.listUsers()
        const matched = (listRes?.users || []).find((u) => (u.email || '').trim().toLowerCase() === cleanEmail)
        if (matched) {
          targetUserId = matched.id
        }
      } catch (_) {}
    }

    if (hasElevatedAccess && targetUserId) {
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

      if (targetUserId) {
        try {
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
