const CONSENT_STORAGE_KEY = 'p5_cookie_consent'
const CONSENT_EVENT = 'paper5:consent-changed'
const OPEN_PREFS_EVENT = 'paper5:open-consent'
const CONSENT_VERSION = 1

let memoryFallback = null

function getCookie(name) {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[1]) : null
}

function setCookie(name, value) {
  if (typeof document === 'undefined') return
  const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:'
  const hostname = typeof window !== 'undefined' ? window.location?.hostname || '' : ''
  const isPaper5 = hostname.endsWith('paper5.co')
  const domainPart = isPaper5 ? 'domain=.paper5.co; ' : ''
  const securePart = isHttps ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; ${domainPart}path=/; max-age=31536000; SameSite=Lax${securePart}`
}

export function getConsentState() {
  if (typeof window === 'undefined') return null
  if (memoryFallback) return memoryFallback

  // 1. Try reading from localStorage
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && typeof parsed.analytics === 'boolean') {
        const state = {
          version: parsed.version || CONSENT_VERSION,
          essential: true,
          analytics: Boolean(parsed.analytics),
          updatedAt: parsed.updatedAt || null
        }
        memoryFallback = state
        return state
      }
    }
  } catch (_) {}

  // 2. Fallback: Try reading from persistent cookie (shared across paper5.co and app.paper5.co)
  try {
    const cookieVal = getCookie(CONSENT_STORAGE_KEY)
    if (cookieVal) {
      const parsed = JSON.parse(cookieVal)
      if (parsed && typeof parsed === 'object' && typeof parsed.analytics === 'boolean') {
        const state = {
          version: parsed.version || CONSENT_VERSION,
          essential: true,
          analytics: Boolean(parsed.analytics),
          updatedAt: parsed.updatedAt || null
        }
        memoryFallback = state
        try {
          window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state))
        } catch (_) {}
        return state
      }
    }
  } catch (_) {}

  return null
}

export function hasAnalyticsConsent() {
  return getConsentState()?.analytics === true
}

export function hasMadeConsentChoice() {
  return getConsentState() !== null
}

export function saveConsentDecision(analyticsAllowed) {
  const nextState = {
    version: CONSENT_VERSION,
    essential: true,
    analytics: Boolean(analyticsAllowed),
    updatedAt: new Date().toISOString()
  }
  memoryFallback = nextState
  if (typeof window !== 'undefined') {
    const serialized = JSON.stringify(nextState)

    // 1. Save to localStorage
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, serialized)
    } catch (_) {}

    // 2. Save to cross-domain cookie (.paper5.co) so it spans marketing and app, and survives auth resets
    try {
      setCookie(CONSENT_STORAGE_KEY, serialized)
    } catch (_) {}

    const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID
    if (gaId) {
      window[`ga-disable-${gaId}`] = !nextState.analytics
    }
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: nextState }))
  }
  return nextState
}

export function openConsentPreferences() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_PREFS_EVENT))
  }
}

export function subscribeConsent(callback) {
  if (typeof window === 'undefined') return () => {}
  const handler = (e) => callback(e.detail || getConsentState())
  window.addEventListener(CONSENT_EVENT, handler)
  return () => window.removeEventListener(CONSENT_EVENT, handler)
}

export function subscribeOpenConsentPreferences(callback) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(OPEN_PREFS_EVENT, callback)
  return () => window.removeEventListener(OPEN_PREFS_EVENT, callback)
}
