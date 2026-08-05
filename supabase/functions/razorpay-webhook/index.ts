import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  try {
    const signature = req.headers.get('x-razorpay-signature')
    if (!signature) throw new Error('Missing signature')

    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
    if (!webhookSecret) throw new Error('Webhook secret not configured')

    const bodyText = await req.text()

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(bodyText)
    )
    const expectedSignature = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    if (expectedSignature !== signature) {
      throw new Error('Invalid signature')
    }

    const event = JSON.parse(bodyText)

    if (['subscription.charged', 'subscription.halted', 'subscription.cancelled'].includes(event.event)) {
      const subscription = event.payload.subscription.entity
      const userId = subscription.notes?.userId

      if (userId) {
        let newStatus = 'active'
        if (event.event !== 'subscription.charged') {
          newStatus = 'inactive'
        }

        const { error } = await supabase
          .from('users')
          .update({
            billing_status: newStatus,
            billing_plan_id: subscription.plan_id
          })
          .eq('id', userId)

        if (error) {
          console.error('Failed to update user', error)
          throw error
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' }, status: 200 })

  } catch (error) {
    console.error('Webhook Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})
