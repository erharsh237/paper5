/**
 * Vercel Serverless Function: /api/auth/session
 *
 * Manages Supabase JWT session tokens as httpOnly, Secure, SameSite=Lax cookies.
 * This keeps raw JWTs out of JavaScript-accessible localStorage, eliminating
 * the XSS → localStorage → token theft attack chain.
 *
 * Endpoints:
 *   GET    /api/auth/session  — Read tokens from cookies; return session to client
 *   POST   /api/auth/session  — Store new tokens in httpOnly cookies
 *   DELETE /api/auth/session  — Clear all session cookies (sign-out)
 *
 * Security properties of issued cookies:
 *   - HttpOnly:    Not accessible by JavaScript (prevents XSS token theft)
 *   - Secure:      Transmitted only over HTTPS
 *   - SameSite=Lax: Protected across cross-site subrequests while preserving top-level domain redirects (.paper5.co)
 *   - Path=/:      Scoped to the entire application (with Domain=.paper5.co in production)
 */

import { checkRateLimit } from '../_rateLimit.js'
import { createClient } from '@supabase/supabase-js'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server'

function getWebAuthnConfig(req) {
  const rawHost = (req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000').toLowerCase()
  const hostname = rawHost.split(':')[0]
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')
  const proto = isLocal ? 'http' : (req.headers['x-forwarded-proto'] || 'https')
  const origin = req.headers.origin || `${proto}://${rawHost}`
  const rpID = hostname.endsWith('paper5.co') ? hostname : hostname
  return { rpID, origin, isLocal }
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function getCookieDomainAttr(req) {
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(':')[0].toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost') || host.endsWith('.lvh.me')) {
    return ''
  }
  if (host.endsWith('paper5.co')) {
    return '; Domain=.paper5.co'
  }
  return ''
}

const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30 // 30 days (matches Supabase default)

/**
 * Parses a raw Cookie header string into a key→value map.
 * @param {string} cookieHeader
 * @returns {Record<string, string>}
 */
function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader.split(';').flatMap((pair) => {
      const eqIdx = pair.indexOf('=')
      if (eqIdx === -1) return []
      const key = pair.slice(0, eqIdx).trim()
      const val = pair.slice(eqIdx + 1).trim()
      return key ? [[key, val]] : []
    })
  )
}

export default async function handler(req, res) {
  if (checkRateLimit(req, res, { max: 120, windowMs: 60000 })) return

  // Only accept known methods
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── GET: hydrate session on page load ──────────────────────────────────────
  if (req.method === 'GET') {
    const cookies = parseCookies(req.headers.cookie)
    const isPending2FA = cookies['sb_2fa_pending'] === 'true'
    const pendingEmail = cookies['sb_2fa_email'] || ''
    const accessToken  = cookies['sb_access_token']
    const refreshToken = cookies['sb_refresh_token']
    const expiresAt    = cookies['sb_expires_at']

    // If 2FA is pending on server httpOnly cookie, refuse to issue access tokens
    if (isPending2FA) {
      return res.status(200).json({
        isPending2FA: true,
        email: pendingEmail
      })
    }

    // No session cookie present — client should treat user as signed out
    if (!accessToken || !refreshToken) {
      return res.status(204).end()
    }

    // Return tokens to the client so it can call supabase.auth.setSession()
    return res.status(200).json({
      access_token:  accessToken,
      refresh_token: refreshToken,
      expires_at:    expiresAt ? Number(expiresAt) : null,
    })
  }

  const domainAttr = getCookieDomainAttr(req)
  const cookieDefaults = `HttpOnly; Secure; SameSite=Lax; Path=/${domainAttr}`
  const clientCookieDefaults = `Secure; SameSite=Lax; Path=/${domainAttr}`

  // ── POST: store new session tokens, passkey WebAuthn, or 2FA state ───────
  if (req.method === 'POST') {
    const { passkeyAction, credential, pending_2fa, email, access_token, refresh_token, expires_at } = req.body ?? {}

    // ── Passkey WebAuthn Flows ───────────────────────────────────────────────
    if (passkeyAction) {
      const supabaseAdmin = getSupabaseAdmin()
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Server auth configuration missing.' })
      }
      const { rpID, origin, isLocal } = getWebAuthnConfig(req)
      const challengeCookieFlags = `HttpOnly; SameSite=Lax; Path=/${isLocal ? '' : '; Secure'}${domainAttr}`
      const cookies = parseCookies(req.headers.cookie)

      try {
        // 1. Register Options (Authenticated)
        if (passkeyAction === 'register-options') {
          const authHeader = req.headers.authorization || ''
          const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : cookies['sb_access_token']
          if (!bearer) return res.status(401).json({ error: 'Authentication required to add a passkey.' })

          const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(bearer)
          if (userErr || !userData?.user) {
            return res.status(401).json({ error: 'Invalid or expired session.' })
          }

          const user = userData.user
          const existingKeys = Array.isArray(user.app_metadata?.passkeys) ? user.app_metadata.passkeys : []

          const options = await generateRegistrationOptions({
            rpName: 'Paper5',
            rpID,
            userName: user.email || user.id,
            userID: new TextEncoder().encode(user.id),
            userDisplayName: user.user_metadata?.username || user.email || 'Paper5 User',
            attestationType: 'none',
            excludeCredentials: existingKeys.map((k) => ({
              id: k.id,
              transports: k.transports || undefined,
            })),
            authenticatorSelection: {
              residentKey: 'preferred',
              userVerification: 'preferred',
            },
          })

          res.setHeader('Set-Cookie', `p5_webauthn_challenge=${options.challenge}; ${challengeCookieFlags}; Max-Age=300`)
          return res.status(200).json({ options })
        }

        // 2. Register Verify (Authenticated)
        if (passkeyAction === 'register-verify') {
          const authHeader = req.headers.authorization || ''
          const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : cookies['sb_access_token']
          if (!bearer) return res.status(401).json({ error: 'Authentication required.' })

          const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(bearer)
          if (userErr || !userData?.user) {
            return res.status(401).json({ error: 'Invalid or expired session.' })
          }

          const expectedChallenge = cookies['p5_webauthn_challenge']
          if (!expectedChallenge) {
            return res.status(400).json({ error: 'Passkey challenge expired. Please try again.' })
          }

          const verification = await verifyRegistrationResponse({
            response: credential,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
          })

          res.setHeader('Set-Cookie', `p5_webauthn_challenge=; ${challengeCookieFlags}; Max-Age=0`)

          if (!verification.verified || !verification.registrationInfo) {
            return res.status(400).json({ error: 'Passkey verification failed.' })
          }

          const { credential: regCred } = verification.registrationInfo
          const user = userData.user
          const existingKeys = Array.isArray(user.app_metadata?.passkeys) ? user.app_metadata.passkeys : []
          const newKey = {
            id: regCred.id,
            publicKey: Buffer.from(regCred.publicKey).toString('base64url'),
            counter: regCred.counter,
            transports: credential?.response?.transports || [],
            createdAt: new Date().toISOString(),
          }

          const deduped = existingKeys.filter((k) => k.id !== newKey.id)
          deduped.push(newKey)

          const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
            app_metadata: { ...(user.app_metadata || {}), passkeys: deduped },
          })
          if (updErr) {
            return res.status(500).json({ error: 'Failed to save passkey.' })
          }

          return res.status(200).json({ verified: true })
        }

        // 3. Login Options (Public or scoped to authenticated user's passkeys)
        if (passkeyAction === 'login-options') {
          let allowCredentials
          const authHeader = req.headers.authorization || ''
          const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : cookies['sb_access_token']
          if (bearer) {
            const { data: userData } = await supabaseAdmin.auth.getUser(bearer).catch(() => ({ data: null }))
            const existingKeys = Array.isArray(userData?.user?.app_metadata?.passkeys) ? userData.user.app_metadata.passkeys : []
            if (existingKeys.length > 0) {
              allowCredentials = existingKeys.map((k) => ({
                id: k.id,
                transports: k.transports || undefined,
              }))
            }
          }

          const options = await generateAuthenticationOptions({
            rpID,
            userVerification: 'preferred',
            ...(allowCredentials ? { allowCredentials } : {}),
          })

          res.setHeader('Set-Cookie', `p5_webauthn_challenge=${options.challenge}; ${challengeCookieFlags}; Max-Age=300`)
          return res.status(200).json({ options })
        }

        // 4. Login Verify (Public or scoped to authenticated user)
        if (passkeyAction === 'login-verify') {
          const expectedChallenge = cookies['p5_webauthn_challenge']
          if (!expectedChallenge) {
            return res.status(400).json({ error: 'Passkey challenge expired. Please try again.' })
          }

          let user = null
          const userHandleB64 = credential?.response?.userHandle
          if (userHandleB64) {
            const userId = Buffer.from(userHandleB64, 'base64url').toString('utf8')
            const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId)
            user = userData?.user || null
          }
          if (!user) {
            const authHeader = req.headers.authorization || ''
            const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : cookies['sb_access_token']
            if (bearer) {
              const { data: userData } = await supabaseAdmin.auth.getUser(bearer).catch(() => ({ data: null }))
              user = userData?.user || null
            }
          }
          if (!user) {
            return res.status(404).json({ error: 'No account found for this passkey.' })
          }
          const existingKeys = Array.isArray(user.app_metadata?.passkeys) ? user.app_metadata.passkeys : []
          const savedKey = existingKeys.find((k) => k.id === credential.id)
          if (!savedKey) {
            return res.status(401).json({ error: 'Passkey not recognized for this account.' })
          }

          const verification = await verifyAuthenticationResponse({
            response: credential,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            credential: {
              id: savedKey.id,
              publicKey: Buffer.from(savedKey.publicKey, 'base64url'),
              counter: savedKey.counter || 0,
              transports: savedKey.transports || undefined,
            },
          })

          res.setHeader('Set-Cookie', `p5_webauthn_challenge=; ${challengeCookieFlags}; Max-Age=0`)

          if (!verification.verified) {
            return res.status(401).json({ error: 'Passkey authentication failed.' })
          }

          // Update signature counter
          const updatedKeys = existingKeys.map((k) =>
            k.id === savedKey.id ? { ...k, counter: verification.authenticationInfo.newCounter } : k
          )
          await supabaseAdmin.auth.admin.updateUserById(user.id, {
            app_metadata: { ...(user.app_metadata || {}), passkeys: updatedKeys },
          })

          // Mint a real Supabase session via magiclink hashed_token
          const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: user.email,
          })
          if (linkErr || !linkData?.properties?.hashed_token) {
            return res.status(500).json({ error: 'Could not establish session after passkey verification.' })
          }

          return res.status(200).json({
            verified: true,
            tokenHash: linkData.properties.hashed_token,
            email: user.email,
          })
        }

        // 5. List Passkeys (Authenticated)
        if (passkeyAction === 'list-passkeys') {
          const authHeader = req.headers.authorization || ''
          const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : cookies['sb_access_token']
          if (!bearer) return res.status(401).json({ error: 'Authentication required.' })

          const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(bearer)
          if (userErr || !userData?.user) {
            return res.status(401).json({ error: 'Invalid or expired session.' })
          }

          const existingKeys = Array.isArray(userData.user.app_metadata?.passkeys) ? userData.user.app_metadata.passkeys : []
          return res.status(200).json({
            passkeys: existingKeys.map((k) => ({
              id: k.id,
              createdAt: k.createdAt || null,
            })),
          })
        }

        // 6. Remove Passkey (Authenticated)
        if (passkeyAction === 'remove-passkey') {
          const authHeader = req.headers.authorization || ''
          const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : cookies['sb_access_token']
          if (!bearer) return res.status(401).json({ error: 'Authentication required.' })

          const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(bearer)
          if (userErr || !userData?.user) {
            return res.status(401).json({ error: 'Invalid or expired session.' })
          }

          const { credentialId } = req.body ?? {}
          const user = userData.user
          const existingKeys = Array.isArray(user.app_metadata?.passkeys) ? user.app_metadata.passkeys : []
          const nextKeys = credentialId
            ? existingKeys.filter((k) => k.id !== credentialId)
            : []

          const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
            app_metadata: { ...(user.app_metadata || {}), passkeys: nextKeys },
          })
          if (updErr) {
            return res.status(500).json({ error: 'Failed to remove passkey.' })
          }

          return res.status(200).json({
            removed: true,
            passkeys: nextKeys.map((k) => ({ id: k.id, createdAt: k.createdAt || null })),
          })
        }

        return res.status(400).json({ error: 'Unknown passkeyAction.' })
      } catch (err) {
        console.error('[Passkey Error]', err)
        return res.status(400).json({ error: err?.message || 'Passkey operation failed.' })
      }
    }

    // Flag 2FA pending on httpOnly cookie and clear access tokens
    if (pending_2fa) {
      const cleanEmail = (email || '').trim().toLowerCase()
      res.setHeader('Set-Cookie', [
        `sb_2fa_pending=true; ${cookieDefaults}; Max-Age=600`,
        `sb_2fa_email=${cleanEmail}; ${cookieDefaults}; Max-Age=600`,
        `sb_access_token=; ${cookieDefaults}; Max-Age=0`,
        `sb_refresh_token=; ${cookieDefaults}; Max-Age=0`,
        `sb_expires_at=; ${clientCookieDefaults}; Max-Age=0`,
        `sb_has_session=; ${clientCookieDefaults}; Max-Age=0`,
      ])
      return res.status(200).json({ ok: true, pending_2fa: true })
    }

    if (!access_token || typeof access_token !== 'string') {
      return res.status(400).json({ error: 'access_token is required' })
    }
    if (!refresh_token || typeof refresh_token !== 'string') {
      return res.status(400).json({ error: 'refresh_token is required' })
    }

    // Session cookies (no Max-Age) so browsers clear them on browser close while keeping refreshes alive
    res.setHeader('Set-Cookie', [
      `sb_access_token=${access_token}; ${cookieDefaults}`,
      `sb_refresh_token=${refresh_token}; ${cookieDefaults}`,
      `sb_expires_at=${expires_at ?? ''}; ${clientCookieDefaults}`,
      `sb_has_session=1; ${clientCookieDefaults}`,
      `sb_2fa_pending=; ${cookieDefaults}; Max-Age=0`,
      `sb_2fa_email=; ${cookieDefaults}; Max-Age=0`,
    ])

    return res.status(200).json({ ok: true })
  }

  // ── DELETE: clear session (sign-out) ──────────────────────────────────────
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', [
      `sb_access_token=; ${cookieDefaults}; Max-Age=0`,
      `sb_refresh_token=; ${cookieDefaults}; Max-Age=0`,
      `sb_expires_at=; ${clientCookieDefaults}; Max-Age=0`,
      `sb_has_session=; ${clientCookieDefaults}; Max-Age=0`,
      `sb_2fa_pending=; ${cookieDefaults}; Max-Age=0`,
      `sb_2fa_email=; ${cookieDefaults}; Max-Age=0`,
    ])
    return res.status(200).json({ ok: true })
  }
}
