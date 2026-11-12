const CONSENT_STORAGE_KEY = 'p5_cookie_consent'
const CONSENT_EVENT = 'paper5:consent-changed'
const OPEN_PREFS_EVENT = 'paper5:open-consent'
const CONSENT_VERSION = 1

let memoryFallback = null

export function getConsentState() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return memoryFallback
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || typeof parsed.analytics !== 'boolean') {
      return null
    }
    return {
      version: parsed.version || CONSENT_VERSION,
      essential: true,
      analytics: Boolean(parsed.analytics),
      updatedAt: parsed.updatedAt || null
    }
  } catch {
    return memoryFallback
  }
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
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(nextState))
    } catch {
      // ignore storage quota / private mode failures
    }
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
