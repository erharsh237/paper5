import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const missingKeys = []
if (!supabaseUrl) missingKeys.push('VITE_SUPABASE_URL')
if (!supabaseAnonKey) missingKeys.push('VITE_SUPABASE_ANON_KEY')

export const supabaseConfigError = missingKeys.length > 0 
  ? `Missing Supabase config values: ${missingKeys.join(', ')}.`
  : null

export const supabase = supabaseConfigError ? null : createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})
