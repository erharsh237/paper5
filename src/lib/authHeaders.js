import { supabase } from './supabase'

/**
 * Returns JSON headers with the current Supabase session JWT in Authorization Bearer.
 * Ensures serverless API endpoints receive cryptographically verified caller identity.
 */
export async function getAuthHeaders(customHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...customHeaders,
  }

  try {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  } catch (_) {}

  return headers
}
