import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://sdbglndhjkqhkphzqmum.supabase.co', 
  'sb_publishable_sF1t4135xZzlYZTuQdEu2g_3oio06Ck'
)

async function run() {
  const users = ['owner', 'admin', 'member']
  for (const u of users) {
    const { data, error } = await supabase.auth.signUp({
      email: `${u}@test.com`,
      password: 'Testing123!',
      options: { data: { full_name: `Test ${u}` } }
    })
    console.log(`Signed up ${u}:`, data?.user?.id || 'No ID', error?.message || 'Success')
  }
}
run()
