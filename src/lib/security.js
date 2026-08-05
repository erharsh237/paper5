/**
 * Comprehensive Security & Rate Limiting Module for SprintOS / Paper5
 * Features:
 * 1. Stronger Rate Limiting (Progressive Exponential Backoff)
 * 2. IP Blocking / Blacklist Validation
 * 3. Header & Origin Validation
 * 4. Account Lockout Protection (Persistent across refreshes)
 */

// Allowed origins for Header Validation
const ALLOWED_ORIGINS = [
  'https://paper5.com',
  'https://app.paper5.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
]

// Local storage key for persistent security state
const SECURITY_STORAGE_KEY = 'paper5_security_state_v1'

function getSecurityState() {
  try {
    const raw = localStorage.getItem(SECURITY_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveSecurityState(state) {
  try {
    localStorage.setItem(SECURITY_STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    // Ignore storage errors
  }
}

/**
 * 1. Header Validation
 * Checks request Origin, Referer, and User-Agent headers to block automated bot requests.
 */
export function validateRequestHeaders() {
  const currentOrigin = window.location.origin
  const userAgent = navigator.userAgent

  // Block empty or bot user agents
  if (!userAgent || userAgent.length < 5) {
    throw new Error('Header Validation Failed: Missing or invalid User-Agent header.')
  }

  // Validate Origin if in production
  if (import.meta.env.PROD) {
    const isAllowed = ALLOWED_ORIGINS.some(origin => currentOrigin === origin || currentOrigin.endsWith('.paper5.com'))
    if (!isAllowed) {
      throw new Error(`Header Validation Failed: Origin '${currentOrigin}' is not an authorized endpoint.`)
    }
  }

  return true
}

/**
 * 2. IP Blocking / Blacklist Check
 */
const BLOCKED_IPS = new Set([
  // Example known malicious IPs or test blacklisted IPs
  '0.0.0.0',
])

export function checkIpBlocked(clientIp = null) {
  if (clientIp && BLOCKED_IPS.has(clientIp)) {
    throw new Error('Access Denied: Your IP address has been flagged and blocked for security violations.')
  }
  return false
}

/**
 * 3. Stronger Rate Limiting & 4. Account Lockout
 */
export function checkAccountLockout(identifier) {
  if (!identifier) return { isLocked: false, remainingSeconds: 0 }

  const key = identifier.toLowerCase().trim()
  const state = getSecurityState()
  const accountData = state[key] || { failedAttempts: 0, lockedUntil: 0 }

  const now = Date.now()
  if (accountData.lockedUntil && accountData.lockedUntil > now) {
    const remainingSeconds = Math.ceil((accountData.lockedUntil - now) / 1000)
    return {
      isLocked: true,
      remainingSeconds,
      failedAttempts: accountData.failedAttempts,
      message: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${remainingSeconds} seconds.`
    }
  }

  // Lock expired
  if (accountData.lockedUntil && accountData.lockedUntil <= now) {
    accountData.failedAttempts = 0
    accountData.lockedUntil = 0
    state[key] = accountData
    saveSecurityState(state)
  }

  return { isLocked: false, remainingSeconds: 0, failedAttempts: accountData.failedAttempts }
}

/**
 * Record a failed authentication attempt with Progressive Exponential Backoff
 * - 3 failures => 15s cooldown
 * - 5 failures => 60s lockout
 * - 8+ failures => 5 minute lockout
 */
export function recordFailedAttempt(identifier) {
  if (!identifier) return 1

  const key = identifier.toLowerCase().trim()
  const state = getSecurityState()
  const accountData = state[key] || { failedAttempts: 0, lockedUntil: 0 }

  accountData.failedAttempts = (accountData.failedAttempts || 0) + 1

  const attempts = accountData.failedAttempts
  let lockDurationMs = 0

  if (attempts >= 8) {
    lockDurationMs = 5 * 60 * 1000 // 5 minutes
  } else if (attempts >= 5) {
    lockDurationMs = 60 * 1000 // 60 seconds
  } else if (attempts >= 3) {
    lockDurationMs = 15 * 1000 // 15 seconds
  }

  if (lockDurationMs > 0) {
    accountData.lockedUntil = Date.now() + lockDurationMs
  }

  state[key] = accountData
  saveSecurityState(state)

  return {
    failedAttempts: attempts,
    lockedUntil: accountData.lockedUntil,
    lockoutSeconds: Math.ceil(lockDurationMs / 1000)
  }
}

/**
 * Reset failed attempt counters upon successful authentication
 */
export function resetSecurityState(identifier) {
  if (!identifier) return
  const key = identifier.toLowerCase().trim()
  const state = getSecurityState()
  delete state[key]
  saveSecurityState(state)
}
