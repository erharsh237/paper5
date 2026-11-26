const ATTR_STORAGE_KEY = 'p5_attribution'
const ATTR_COOKIE_NAME = 'p5_attr'

function cleanHost(urlStr) {
  try {
    const host = new URL(urlStr).hostname.replace(/^www\./, '').toLowerCase()
    if (!host || host === 'paper5.co' || host.endsWith('.paper5.co') || host === 'localhost' || host === '127.0.0.1') {
      return ''
    }
    return host
  } catch (_) {
    return ''
  }
}

function readCookie(name) {
  if (typeof document === 'undefined') return null
  const prefix = `${name}=`
  const parts = document.cookie ? document.cookie.split('; ') : []
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      try {
        return JSON.parse(decodeURIComponent(part.slice(prefix.length)))
      } catch (_) {
        return null
      }
    }
  }
  return null
}

function writeCookie(name, payload) {
  if (typeof document === 'undefined') return
  try {
    const encoded = encodeURIComponent(JSON.stringify(payload))
    const host = window.location.hostname.toLowerCase()
    const domainPart = host === 'paper5.co' || host.endsWith('.paper5.co') ? '; domain=.paper5.co' : ''
    const securePart = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${name}=${encoded}; path=/; max-age=2592000; SameSite=Lax${domainPart}${securePart}`
  } catch (_) {}
}

/**
 * Captures first-touch UTM / referral attribution and shares it across paper5.co & app.paper5.co.
 */
export function captureAttribution() {
  if (typeof window === 'undefined') return null
  try {
    const params = new URLSearchParams(window.location.search)
    const utmSource = (params.get('utm_source') || params.get('ref') || '').trim()
    const utmMedium = (params.get('utm_medium') || '').trim()
    const utmCampaign = (params.get('utm_campaign') || '').trim()
    const refHost = typeof document !== 'undefined' && document.referrer ? cleanHost(document.referrer) : ''

    const existing = getStoredAttribution()
    const hasExplicitParams = Boolean(utmSource || utmMedium || utmCampaign)

    if (existing && !hasExplicitParams) {
      return existing
    }

    const source = utmSource || refHost || existing?.source || 'direct'
    const payload = {
      source,
      medium: utmMedium || (refHost ? 'referral' : 'none'),
      campaign: utmCampaign || '',
      referrer: typeof document !== 'undefined' ? (document.referrer || '') : '',
      landingPath: window.location.pathname || '/',
      capturedAt: new Date().toISOString()
    }

    localStorage.setItem(ATTR_STORAGE_KEY, JSON.stringify(payload))
    writeCookie(ATTR_COOKIE_NAME, payload)
    return payload
  } catch (_) {
    return null
  }
}

export function getStoredAttribution() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(ATTR_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  return readCookie(ATTR_COOKIE_NAME)
}

export function getSignupAttributionMetadata() {
  const attr = getStoredAttribution() || captureAttribution()
  if (!attr) return {}
  return {
    signup_source: attr.source || 'direct',
    signup_medium: attr.medium || 'none',
    signup_campaign: attr.campaign || '',
    signup_referrer: attr.referrer || ''
  }
}
