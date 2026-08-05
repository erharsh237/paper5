import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

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

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('billing_razorpay_subscription_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData) throw new Error('User not found')

    const subId = userData.billing_razorpay_subscription_id
    if (!subId) throw new Error('No active subscription found.')

    const keyId = Deno.env.get('RAZORPAY_KEY_ID')
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')

    if (!keyId || keyId === 'dummy') {
      // Local dev mock
      await supabaseAdmin.from('users').update({
        billing_status: 'cancelled',
        billing_plan_id: 'free'
      }).eq('id', user.id)
      
      return new Response(JSON.stringify({ success: true, mock: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Call Razorpay API to cancel
    const auth = btoa(`${keyId}:${keySecret}`)
    const response = await fetch(`https://api.razorpay.com/v1/subscriptions/${subId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cancel_at_cycle_end: 0 })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Razorpay API error: ${errorText}`)
    }

    // Update user in DB
    await supabaseAdmin.from('users').update({
      billing_status: 'cancelled',
      billing_plan_id: 'free'
    }).eq('id', user.id)

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
