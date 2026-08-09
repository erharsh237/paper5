import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import * as crypto from "https://deno.land/std@0.177.0/crypto/mod.ts"
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Unauthenticated')

    // ── Server-side rate limiting (real, not bypassable from the client) ──
    // 10 invite creates per user per 60 seconds. Uses the shared sliding-window
    // Postgres counter in rate_limit_log. A bot making raw HTTP requests will
    // hit this limit regardless of what the UI does.
    const isLimited = await checkRateLimit(supabaseAdmin, user.id, 'invite_create', {
      maxRequests: 10,
      windowSeconds: 60,
    })
    if (isLimited) return rateLimitResponse(60)
    // ─────────────────────────────────────────────────────────────────────

    const { workspaceId, email, role, permissions = [], password, sendEmail = false } = await req.json()
    if (!workspaceId || !email || !role) throw new Error('Missing parameters')
    if (!['admin', 'member'].includes(role)) throw new Error('Invalid role')

    // Check caller permission
    const { data: callerMember, error: callerError } = await supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (callerError || !callerMember) throw new Error('Not a member')
    if (callerMember.role !== 'owner' && callerMember.role !== 'admin') {
      throw new Error('Only admins can create invites')
    }

    // Admins/owners implicitly have all permissions, so we allow them to grant any permissions.
    // However, if we ever allow standard members to invite, we'd need to verify they possess
    // the permissions they are trying to grant:
    // const callerPermissions = callerMember.permissions || []
    // if (!permissions.every(p => callerPermissions.includes(p))) throw new Error('Cannot grant permissions you do not possess')

    // Check billing limit (if free tier, max 3 members)
    const { data: ws } = await supabaseAdmin.from('workspaces').select('billing_plan_id').eq('id', workspaceId).single()
    if (ws?.billing_plan_id !== 'pro') {
      const { count } = await supabaseAdmin
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
      
      if (count && count >= 3) {
        throw new Error('Free tier is limited to 3 members. Please upgrade to Pro.')
      }
    }

    // Create user with explicit password
    let targetUserId = null;
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: true
    })

    if (createError) {
      if (createError.message.includes('already exists') || createError.status === 422) {
        // If they already exist, we just update their password so the admin can securely give them a login 
        // Note: this forces a password change on their existing account.
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        targetUserId = listData.users.find(u => u.email === email.toLowerCase())?.id;
        
        if (targetUserId) {
          const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
            targetUserId,
            { password: password }
          )
          if (updateAuthError) throw updateAuthError;
        } else {
          throw createError;
        }
      } else {
        throw createError
      }
    } else {
      targetUserId = userData?.user?.id;
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days

    // Insert into workspace_invites so admin can track it
    const tokenHash = 'pwd_invite_' + Date.now().toString()

    const { data: invite, error: dbError } = await supabaseAdmin
      .from('workspace_invites')
      .insert({
        workspace_id: workspaceId,
        email: email.toLowerCase(),
        role,
        token_hash: tokenHash,
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
        permissions: permissions,
        sent_count: sendEmail ? 1 : 0
      })
      .select('id')
      .single()

    // If it violates unique constraint (already invited), update it
    if (dbError) {
      if (dbError.code === '23505') { // Unique violation
        await supabaseAdmin
          .from('workspace_invites')
          .update({
            role,
            permissions,
            sent_count: sendEmail ? 1 : 0 // Wait, we need to increment. Supabase REST doesn't easily support X = X + 1 without RPC.
          })
          .eq('workspace_id', workspaceId)
          .eq('email', email.toLowerCase());
          
        // Since we cannot easily increment via update without RPC, let's just fetch existing and increment.
        const { data: existingInvite } = await supabaseAdmin.from('workspace_invites').select('sent_count').eq('workspace_id', workspaceId).eq('email', email.toLowerCase()).single();
        if (existingInvite) {
           await supabaseAdmin.from('workspace_invites').update({ sent_count: existingInvite.sent_count + (sendEmail ? 1 : 0) }).eq('workspace_id', workspaceId).eq('email', email.toLowerCase());
        }
      } else {
        throw dbError
      }
    }

    if (targetUserId) {
      // Force password reset on next login
      await supabaseAdmin.from('users').update({ requires_password_reset: true }).eq('id', targetUserId);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
