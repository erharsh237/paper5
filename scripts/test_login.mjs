import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://sdbglndhjkqhkphzqmum.supabase.co', 
  'sb_publishable_sF1t4135xZzlYZTuQdEu2g_3oio06Ck'
)

async function testSignup() {
  const { data, error } = await supabase.auth.signUp({
    email: 'owner@company.com',
    password: 'Testing123!'
  })
  console.log('Signup result:', data, error)
}
testSignup()
