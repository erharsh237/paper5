import crypto from 'crypto'
import { setCorsHeaders } from './_cors.js'
import { checkRateLimit } from './_rateLimit.js'

const recentSubmissions = new Map()

setInterval(() => {
  const now = Date.now()
  for (const [key, expiresAt] of recentSubmissions.entries()) {
    if (now > expiresAt) {
      recentSubmissions.delete(key)
    }
  }
}, 120000).unref?.()

export function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for']
  return (
    (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
    req.headers?.['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}

export function sanitizeText(value, { maxLen = 500, preserveNewlines = false } = {}) {
  if (typeof value !== 'string') return ''
  let clean = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
  if (preserveNewlines) {
    clean = clean.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim()
  } else {
    clean = clean.replace(/\s+/g, ' ').trim()
  }
  return clean.slice(0, maxLen)
}

export function isValidEmail(email) {
  if (typeof email !== 'string') return false
  const trimmed = email.trim()
  if (trimmed.length < 5 || trimmed.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)
}

export function isHoneypotTriggered(body) {
  if (!body || typeof body !== 'object') return false
  return Boolean(
    (typeof body.website === 'string' && body.website.trim().length > 0) ||
    (typeof body._gotcha === 'string' && body._gotcha.trim().length > 0) ||
    (typeof body.companyUrl === 'string' && body.companyUrl.trim().length > 0)
  )
}

export function isDuplicateSubmission(req, scope, fingerprintParts, ttlMs = 120000) {
  const ip = getClientIp(req)
  const raw = [scope, ip, ...fingerprintParts].join('|')
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  const now = Date.now()
  const expiresAt = recentSubmissions.get(hash)
  if (expiresAt && now < expiresAt) {
    return true
  }
  recentSubmissions.set(hash, now + ttlMs)
  return false
}

export async function verifyTurnstileToken(req, token) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    return { ok: true, skipped: true }
  }
  if (!token || typeof token !== 'string' || !token.trim()) {
    return { ok: false, status: 400, error: 'Security verification is required. Please complete the challenge.' }
  }
  try {
    const body = new URLSearchParams({
      secret,
      response: token.trim(),
      remoteip: getClientIp(req)
    })
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    })
    const data = await resp.json()
    if (!data?.success) {
      return { ok: false, status: 400, error: 'Security verification failed. Please retry.' }
    }
    return { ok: true }
  } catch (err) {
    console.warn('[Turnstile] Verification request failed:', err)
    return { ok: false, status: 502, error: 'Unable to verify security token. Please try again.' }
  }
}

export function runFormPreamble(req, res, rateOptions) {
  setCorsHeaders(req, res)
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return false
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return false
  }
  if (checkRateLimit(req, res, rateOptions)) {
    return false
  }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'Invalid request payload.' })
    return false
  }
  if (isHoneypotTriggered(req.body)) {
    res.status(400).json({ error: 'Submission rejected by spam protection.' })
    return false
  }
  return true
}

export async function forwardToFormspree(endpointUrl, payload) {
  const resp = await fetch(endpointUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  })
  let data = null
  try {
    data = await resp.json()
  } catch (_) {}
  if (!resp.ok) {
    throw new Error(data?.error || 'Unable to deliver submission right now.')
  }
  return data
}
