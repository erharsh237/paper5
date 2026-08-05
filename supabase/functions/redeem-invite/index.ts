import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import * as crypto from "https://deno.land/std@0.177.0/crypto/mod.ts"

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
    if (!user || !user.email) throw new Error('Unauthenticated')

    const { workspaceId, inviteId, rawToken } = await req.json()
    if (!workspaceId || !inviteId || !rawToken) throw new Error('Missing parameters')

    // Fetch invite
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('workspace_invites')
      .select('*')
      .eq('id', inviteId)
      .eq('workspace_id', workspaceId)
      .single()

    if (inviteError || !invite) throw new Error('Invite not found')

    if (new Date() > new Date(invite.expires_at)) {
      throw new Error('Invite has expired')
    }

    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new Error('Invite email does not match your account email')
    }

    // Verify token hash
    const encoder = new TextEncoder()
    const tokenHashBuffer = await crypto.webcrypto.subtle.digest('SHA-256', encoder.encode(rawToken))
    const tokenHash = Array.from(new Uint8Array(tokenHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

    if (tokenHash !== invite.token_hash) {
      throw new Error('Invalid token')
    }

    // Add user to workspace
    const { error: insertError } = await supabaseAdmin
      .from('workspace_members')
      .insert({
        workspace_id: workspaceId,
        user_id: user.id,
        role: invite.role,
        joined_at: new Date().toISOString(),
        permissions: invite.permissions || []
      })

    if (insertError) throw insertError

    // Delete invite
    await supabaseAdmin
      .from('workspace_invites')
      .delete()
      .eq('id', inviteId)

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
