/**
 * Vercel Serverless Function: /api/auth/session
 *
 * Manages Supabase JWT session tokens as httpOnly, Secure, SameSite=Strict cookies.
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
 *   - SameSite=Strict: Not sent on cross-site requests (prevents CSRF)
 *   - Path=/:      Scoped to the entire application
 */

const COOKIE_DEFAULTS = 'HttpOnly; Secure; SameSite=Strict; Path=/'
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

export default function handler(req, res) {
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

  // ── POST: store new session tokens or set 2FA pending state ─────────────
  if (req.method === 'POST') {
    const { pending_2fa, email, access_token, refresh_token, expires_at } = req.body ?? {}

    // Flag 2FA pending on httpOnly cookie and clear access tokens
    if (pending_2fa) {
      const cleanEmail = (email || '').trim().toLowerCase()
      res.setHeader('Set-Cookie', [
        `sb_2fa_pending=true; ${COOKIE_DEFAULTS}; Max-Age=600`,
        `sb_2fa_email=${cleanEmail}; ${COOKIE_DEFAULTS}; Max-Age=600`,
        `sb_access_token=; ${COOKIE_DEFAULTS}; Max-Age=0`,
        `sb_refresh_token=; ${COOKIE_DEFAULTS}; Max-Age=0`,
        `sb_expires_at=; Secure; SameSite=Strict; Path=/; Max-Age=0`,
      ])
      return res.status(200).json({ ok: true, pending_2fa: true })
    }

    if (!access_token || typeof access_token !== 'string') {
      return res.status(400).json({ error: 'access_token is required' })
    }
    if (!refresh_token || typeof refresh_token !== 'string') {
      return res.status(400).json({ error: 'refresh_token is required' })
    }

    // Access token lives until its own expiry; refresh token gets the full 30 days
    const accessMaxAge = expires_at
      ? Math.max(0, Math.floor(Number(expires_at) - Date.now() / 1000))
      : 60 * 60

    res.setHeader('Set-Cookie', [
      `sb_access_token=${access_token}; ${COOKIE_DEFAULTS}; Max-Age=${accessMaxAge}`,
      `sb_refresh_token=${refresh_token}; ${COOKIE_DEFAULTS}; Max-Age=${REFRESH_TOKEN_MAX_AGE}`,
      `sb_expires_at=${expires_at ?? ''}; Secure; SameSite=Strict; Path=/; Max-Age=${accessMaxAge}`,
      `sb_2fa_pending=; ${COOKIE_DEFAULTS}; Max-Age=0`,
      `sb_2fa_email=; ${COOKIE_DEFAULTS}; Max-Age=0`,
    ])

    return res.status(200).json({ ok: true })
  }

  // ── DELETE: clear session (sign-out) ──────────────────────────────────────
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', [
      `sb_access_token=; ${COOKIE_DEFAULTS}; Max-Age=0`,
      `sb_refresh_token=; ${COOKIE_DEFAULTS}; Max-Age=0`,
      `sb_expires_at=; Secure; SameSite=Strict; Path=/; Max-Age=0`,
      `sb_2fa_pending=; ${COOKIE_DEFAULTS}; Max-Age=0`,
      `sb_2fa_email=; ${COOKIE_DEFAULTS}; Max-Age=0`,
    ])
    return res.status(200).json({ ok: true })
  }
}
