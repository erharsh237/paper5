import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const missingKeys = []
if (!supabaseUrl) missingKeys.push('VITE_SUPABASE_URL')
if (!supabaseAnonKey) missingKeys.push('VITE_SUPABASE_ANON_KEY')

export const supabaseConfigError = missingKeys.length > 0 
  ? `Missing Supabase config values: ${missingKeys.join(', ')}.`
  : null

/**
 * In-memory storage adapter for the Supabase JS client.
 *
 * WHY: Supabase's default storage is window.localStorage, which means the raw
 * JWT access token and refresh token are readable by any JavaScript running on
 * the page. If an XSS vulnerability ever exists, an attacker can call
 * localStorage.getItem('sb-*-auth-token') and exfiltrate the session.
 *
 * This adapter stores tokens in a plain JS object (heap memory) instead.
 * Memory is:
 *   ✅ Not accessible via localStorage / sessionStorage APIs
 *   ✅ Cleared automatically when the browser tab is closed
 *   ✅ Never written to any browser storage API
 *   ✅ Compatible with Supabase's autoRefreshToken mechanism
 *
 * Persistence across page refreshes is handled separately by the
 * /api/auth/session serverless function which issues httpOnly cookies.
 * AuthContext.jsx calls that endpoint on mount to restore the session.
 *
 * NOTE: persistSession: true is intentionally kept so the SDK's internal
 * token-refresh scheduling works correctly. It will write to THIS adapter,
 * not to localStorage.
 */
const _mem = Object.create(null) // no prototype — prevents prototype pollution
export const inMemoryStorage = {
  getItem:    (key) => Object.prototype.hasOwnProperty.call(_mem, key) ? _mem[key] : null,
  setItem:    (key, value) => { _mem[key] = String(value) },
  removeItem: (key) => { delete _mem[key] },
}

export const supabase = supabaseConfigError ? null : createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage:          inMemoryStorage, // ← tokens stay in JS heap, not localStorage
    autoRefreshToken: true,
    persistSession:   true,            // SDK manages refresh scheduling via our storage
    detectSessionInUrl: true,
  }
})
