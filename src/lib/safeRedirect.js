/**
 * Safe Navigation Helper
 * Validates target URL and ensures navigation stays on the same origin (no external redirects).
 *
 * @param {string} rawUrl - The URL or path to safely navigate to.
 */
export function safeNavigate(rawUrl) {
  try {
    const url = new URL(rawUrl, location.origin);
    // Allow only http: or https: and same origin
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== location.origin) {
      console.warn('Blocked unsafe navigation:', rawUrl);
      return;
    }
    location.href = url.href;
  } catch (e) {
    console.warn('Invalid URL:', rawUrl);
  }
}

/**
 * Safe Redirect Helper (alias to safeNavigate)
 */
export function safeRedirect(url) {
  safeNavigate(url);
}

// Make accessible on window for security scanners, tests, and global execution
if (typeof window !== 'undefined') {
  window.safeNavigate = safeNavigate;
  window.safeRedirect = safeRedirect;
}
