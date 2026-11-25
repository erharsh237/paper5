import { startRegistration, startAuthentication } from '@simplewebauthn/browser'
import { supabase } from './supabase'

async function getBearerHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  const { data } = await supabase.auth.getSession()
  if (data?.session?.access_token) {
    headers.Authorization = `Bearer ${data.session.access_token}`
  }
  return headers
}

export async function checkHasPasskey(identifier) {
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passkeyAction: 'check-has-passkey', identifier }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return false
  return !!data.hasPasskey
}

export async function listPasskeys() {
  const headers = await getBearerHeaders()
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ passkeyAction: 'list-passkeys' }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Failed to load passkeys.')
  return Array.isArray(data.passkeys) ? data.passkeys : []
}

export async function registerPasskey() {
  const headers = await getBearerHeaders()
  const optRes = await fetch('/api/auth/session', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ passkeyAction: 'register-options' }),
  })
  const optData = await optRes.json().catch(() => ({}))
  if (!optRes.ok || !optData.options) {
    throw new Error(optData.error || 'Could not start passkey setup.')
  }

  let credential
  try {
    credential = await startRegistration({ optionsJSON: optData.options })
  } catch (err) {
    if (err?.name === 'NotAllowedError') {
      throw new Error('Passkey setup was cancelled or timed out.')
    }
    throw new Error(err?.message || 'Your browser or device does not support passkeys.')
  }

  const verRes = await fetch('/api/auth/session', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ passkeyAction: 'register-verify', credential }),
  })
  const verData = await verRes.json().catch(() => ({}))
  if (!verRes.ok || !verData.verified) {
    throw new Error(verData.error || 'Passkey verification failed.')
  }
  return verData
}

export async function removePasskey(credentialId) {
  const headers = await getBearerHeaders()
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ passkeyAction: 'remove-passkey', credentialId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Failed to remove passkey.')
  return Array.isArray(data.passkeys) ? data.passkeys : []
}

export async function loginWithPasskey(email) {
  const optRes = await fetch('/api/auth/session', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passkeyAction: 'login-options', email: email || undefined }),
  })
  const optData = await optRes.json().catch(() => ({}))
  if (!optRes.ok || !optData.options) {
    throw new Error(optData.error || 'Could not start passkey sign-in.')
  }

  let credential
  try {
    credential = await startAuthentication({ optionsJSON: optData.options })
  } catch (err) {
    if (err?.name === 'NotAllowedError') {
      throw new Error('Passkey prompt was cancelled or timed out.')
    }
    throw new Error(err?.message || 'Passkey authentication failed.')
  }

  const verRes = await fetch('/api/auth/session', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passkeyAction: 'login-verify', credential }),
  })
  const verData = await verRes.json().catch(() => ({}))
  if (!verRes.ok || !verData.verified || !verData.session) {
    throw new Error(verData.error || 'Passkey verification failed.')
  }

  const { data: sessData, error: sessErr } = await supabase.auth.setSession({
    access_token: verData.session.access_token,
    refresh_token: verData.session.refresh_token,
  })
  if (sessErr) throw sessErr

  return sessData?.session?.user || verData.user
}
