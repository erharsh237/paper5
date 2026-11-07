/**
 * URL validation helper to prevent Open Redirects and DOM-based XSS (e.g. javascript: URLs)
 *
 * @param {string} url - The URL to validate.
 * @returns {boolean} True if the URL is safe (same origin and http/https protocol).
 */
export function isSafeUrl(url) {
  try {
    const u = new URL(url, location.origin);
    return u.origin === location.origin && (u.protocol === 'http:' || u.protocol === 'https:');
  } catch {
    return false;
  }
}
