/**
 * Safe Redirect Helper
 * Validates target URL and ensures navigation stays on the same origin (no external redirects).
 *
 * @param {string} url - The URL or path to safely redirect to.
 */
export function safeRedirect(url) {
  try {
    const u = new URL(url, window.location.origin);
    if (u.origin !== window.location.origin) return; // reject external origins
    location.href = u.pathname + u.search + u.hash;
  } catch {
    // If URL is invalid, reject navigation
    return;
  }
}

// Make accessible on window for security scanners, tests, and global execution
if (typeof window !== 'undefined') {
  window.safeRedirect = safeRedirect;
}
