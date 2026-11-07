import { isSafeUrl } from '../utils/security';

/**
 * Safe Redirect Helper
 * Validates target URL and ensures navigation stays on the same origin (no external redirects).
 *
 * @param {string} target - The URL or path to safely redirect to.
 */
export function safeRedirect(target) {
  if (isSafeUrl(target)) {
    window.location.href = target;
  } else {
    console.warn('Unsafe URL blocked:', target);
  }
}

// Make accessible on window for security scanners, tests, and global execution
if (typeof window !== 'undefined') {
  window.isSafeUrl = isSafeUrl;
  window.safeRedirect = safeRedirect;
}
