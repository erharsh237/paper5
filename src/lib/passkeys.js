import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { supabase } from './supabase'

/**
 * Returns true if the current browser supports WebAuthn Passkeys.
 */
export function isPasskeySupported() {
  return typeof window !== 'undefined' && browserSupportsWebAuthn()
}

/**
 * Registers a platform/device passkey (Windows Hello, Touch ID, Face ID, etc.)
 * for the currently signed-in user.
 */
export async function registerPasskey() {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys are not supported on this browser or device.')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token
  const headers = { 'Content-Type': 'application/json' }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  // 1. Fetch WebAuthn registration options from server
  const optRes = await fetch('/api/auth/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({ passkeyAction: 'register-options' }),
  })
  const optJson = await optRes.json().catch(() => ({}))
  if (!optRes.ok || !optJson.options) {
    throw new Error(optJson.error || 'Could not start passkey setup.')
  }

  // 2. Prompt native OS authenticator (Windows Hello / Touch ID / Face ID)
  let credential
  try {
    credential = await startRegistration({ optionsJSON: optJson.options })
  } catch (err) {
    if (err?.name === 'NotAllowedError') {
      throw new Error('Passkey setup was cancelled.')
    }
    throw new Error(err?.message || 'Could not create passkey on this device.')
  }

  // 3. Verify and save passkey on backend
  const verRes = await fetch('/api/auth/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({ passkeyAction: 'register-verify', credential }),
  })
  const verJson = await verRes.json().catch(() => ({}))
  if (!verRes.ok || !verJson.verified) {
    throw new Error(verJson.error || 'Passkey verification failed.')
  }

  return true
}

/**
 * Signs a user in using a registered passkey, or verifies a passkey for an
 * already password-authenticated user when `accessToken` is provided.
 */
export async function signInWithPasskey({ accessToken = null } = {}) {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys are not supported on this browser or device.')
  }

  const headers = { 'Content-Type': 'application/json' }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  // 1. Fetch WebAuthn authentication options from server
  const optRes = await fetch('/api/auth/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({ passkeyAction: 'login-options' }),
  })
  const optJson = await optRes.json().catch(() => ({}))
  if (!optRes.ok || !optJson.options) {
    throw new Error(optJson.error || 'Could not start passkey sign-in.')
  }

  // 2. Prompt native OS authenticator
  let credential
  try {
    credential = await startAuthentication({ optionsJSON: optJson.options })
  } catch (err) {
    if (err?.name === 'NotAllowedError') {
      throw new Error('Passkey verification was cancelled. A passkey is required to sign in.')
    }
    throw new Error(err?.message || 'Passkey verification failed on this device.')
  }

  // 3. Verify assertion on backend
  const verRes = await fetch('/api/auth/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({ passkeyAction: 'login-verify', credential }),
  })
  const verJson = await verRes.json().catch(() => ({}))
  if (!verRes.ok || !verJson.verified || !verJson.tokenHash) {
    throw new Error(verJson.error || 'Passkey authentication failed.')
  }

  // 4. Exchange hashed_token for a real Supabase session (required because setIsPending2FA signs out the pre-2FA session)
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: verJson.tokenHash,
    type: 'magiclink',
  })
  if (error) {
    throw error
  }

  return data
}

/**
 * Lists registered passkeys for the currently signed-in user.
 */
export async function listPasskeys() {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token
  const headers = { 'Content-Type': 'application/json' }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const res = await fetch('/api/auth/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({ passkeyAction: 'list-passkeys' }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error || 'Could not load passkeys.')
  }
  return Array.isArray(json.passkeys) ? json.passkeys : []
}

/**
 * Removes a registered passkey (or all passkeys if credentialId is omitted).
 */
export async function removePasskey(credentialId) {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token
  const headers = { 'Content-Type': 'application/json' }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const res = await fetch('/api/auth/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({ passkeyAction: 'remove-passkey', credentialId }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error || 'Could not remove passkey.')
  }
  return Array.isArray(json.passkeys) ? json.passkeys : []
}
