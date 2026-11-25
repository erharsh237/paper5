import { createClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lcszndqmsfxfcrlwcfbb.supabase.co'
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(
  rawUrl.replace(/["']/g, '').trim(),
  rawKey.replace(/["']/g, '').trim(),
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
      storageKey: 'paper5_owner_console_auth'
    }
  }
)
