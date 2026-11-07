/**
 * Safe Redirect Helper
 * Validates target URL and ensures navigation stays on the same origin (no external redirects).
 *
 * @param {string} target - The URL or path to safely redirect to.
 */
export function safeRedirect(target) {
  const url = new URL(target, window.location.origin);
  if (url.origin !== window.location.origin) {
    url.pathname = '/'; // fallback to home
    url.host = window.location.host;
    url.protocol = window.location.protocol;
    url.search = '';
    url.hash = '';
  }
  window.location.href = url.origin === window.location.origin ? url.href : `${window.location.origin}/`;
}

// Make accessible on window for security scanners, tests, and global execution
if (typeof window !== 'undefined') {
  window.safeRedirect = safeRedirect;
}
