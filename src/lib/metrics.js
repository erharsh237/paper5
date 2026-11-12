import { hasAnalyticsConsent } from './privacyPrefs'

const MEASUREMENT_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID || '').trim()
const GTM_ID = (import.meta.env.VITE_GTM_ID || '').trim()

const IS_VALID_GA_ID = /^G-[A-Z0-9]{4,}$/i.test(MEASUREMENT_ID) && !/^G-X+$/i.test(MEASUREMENT_ID)
const IS_VALID_GTM_ID = /^GTM-[A-Z0-9]{4,}$/i.test(GTM_ID) && !/^GTM-X+$/i.test(GTM_ID)

let analyticsInitialized = false
let lastTrackedPath = ''
let lastTrackedTime = 0

export function isGA4Configured() {
  return IS_VALID_GA_ID || IS_VALID_GTM_ID
}

function ensureGtagStub() {
  window.dataLayer = window.dataLayer || []
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments)
    }
}

export function initGA4() {
  if (typeof window === 'undefined' || !isGA4Configured() || !hasAnalyticsConsent()) {
    return false
  }

  if (IS_VALID_GA_ID) {
    window[`ga-disable-${MEASUREMENT_ID}`] = false
  }

  if (analyticsInitialized) return true
  analyticsInitialized = true

  ensureGtagStub()
  window.gtag('js', new Date())

  // Use a single Google script when GTM is configured to avoid loading two duplicate Google Tag runtimes
  if (IS_VALID_GTM_ID) {
    if (!document.getElementById('p5-gtm-script')) {
      const gtmScript = document.createElement('script')
      gtmScript.id = 'p5-gtm-script'
      gtmScript.async = true
      gtmScript.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`
      gtmScript.onerror = () => {
        // Ignore network/adblocker errors cleanly so app execution is never disrupted
      }
      document.head.appendChild(gtmScript)
    }
  } else if (IS_VALID_GA_ID && !document.getElementById('p5-ga4-script')) {
    const gaScript = document.createElement('script')
    gaScript.id = 'p5-ga4-script'
    gaScript.async = true
    gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`
    gaScript.onerror = () => {
      // Ignore network/adblocker errors cleanly
    }
    document.head.appendChild(gaScript)
  }

  if (IS_VALID_GA_ID) {
    // Disable automatic config page_view so SPA route changes are controlled cleanly without duplicate hits
    window.gtag('config', MEASUREMENT_ID, {
      send_page_view: false,
      anonymize_ip: true
    })
  }

  return true
}

export function trackPageView(pathname, title = '') {
  if (typeof window === 'undefined' || !hasAnalyticsConsent() || !initGA4()) return
  const normalized = pathname || window.location.pathname
  const now = Date.now()
  if (normalized === lastTrackedPath && now - lastTrackedTime < 1500) {
    return
  }
  lastTrackedPath = normalized
  lastTrackedTime = now

  window.gtag?.('event', 'page_view', {
    page_path: normalized,
    page_title: title || document.title,
    page_location: window.location.href
  })
}

export function trackEvent(eventName, params = {}) {
  if (typeof window === 'undefined' || !eventName || !hasAnalyticsConsent() || !initGA4()) {
    return
  }
  window.gtag?.('event', eventName, params)
}
