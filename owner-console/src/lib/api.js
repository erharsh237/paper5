import { supabase } from './supabase'

/**
 * Universal authenticated API fetcher for Paper5 Owner Console
 * Automatically retrieves the caller's JWT Bearer session token.
 */
export async function ownerApi(action, { method = 'GET', body = null, params = {} } = {}) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token

  if (!token) {
    throw new Error('Not authenticated. Please sign in to the Owner Console.')
  }

  const query = new URLSearchParams()
  query.set('action', action)
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      query.set(key, String(val))
    }
  }

  const url = `/api/owner?${query.toString()}`

  const headers = {
    'Authorization': `Bearer ${token}`
  }

  const options = {
    method,
    headers
  }

  if (body) {
    headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify({ action, ...body })
  }

  const response = await fetch(url, options)
  const json = await response.json().catch(() => ({}))

  if (!response.ok) {
    if (response.status === 401) {
      // Try refreshing session once
      const { data: refreshed } = await supabase.auth.refreshSession().catch(() => ({ data: null }))
      if (!refreshed?.session) {
        await supabase.auth.signOut().catch(() => {})
      }
    }
    const errorMsg = json.error || `Request failed with HTTP ${response.status}`
    const error = new Error(errorMsg)
    error.status = response.status
    error.details = json
    throw error
  }

  return json
}
