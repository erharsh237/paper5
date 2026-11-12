import { isLocalHost } from './domain'

/**
 * Safe Navigation Helper
 * Validates target URL, requires HTTPS outside local development hosts, and ensures navigation stays on the same origin.
 *
 * @param {string} rawUrl - The URL or path to safely navigate to.
 */
export function safeNavigate(rawUrl) {
  try {
    const url = new URL(rawUrl, location.origin)
    const allowedProtocol = url.protocol === 'https:' || (isLocalHost(url.hostname) && url.protocol === 'http:')
    if (!allowedProtocol || url.origin !== location.origin) {
      console.warn('Blocked unsafe navigation:', rawUrl)
      return
    }
    location.href = url.href
  } catch (e) {
    console.warn('Invalid URL:', rawUrl)
  }
}

/**
 * Safe Redirect Helper (alias to safeNavigate)
 */
export function safeRedirect(url) {
  safeNavigate(url)
}

// Make accessible on window for security scanners, tests, and global execution
if (typeof window !== 'undefined') {
  window.safeNavigate = safeNavigate
  window.safeRedirect = safeRedirect
}
