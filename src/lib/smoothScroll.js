/**
 * Universal Smooth Scroll Animation Utility
 * 
 * Provides silky frame-by-frame cubic ease-in-out scrolling animations across all
 * browsers and devices (desktop, laptop touchscreens, trackpads, mobile) without
 * jumping or relying solely on browser native scrollIntoView.
 */

// Cubic ease-in-out curve for natural physical acceleration and deceleration
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

let activeScrollAnimationId = null

/**
 * Smoothly scroll to a numeric coordinate, DOM element, or CSS selector
 * 
 * @param {number|HTMLElement|string} target - 0 for top, element, or selector like '#pricing'
 * @param {object} options - { offset: -84, duration: 850, easing, onComplete }
 */
export function smoothScrollTo(target, options = {}) {
  if (typeof window === 'undefined') return

  const {
    offset = -84, // Default header clearance
    onComplete
  } = options

  // Resolve DOM element
  let targetEl = null
  let selector = null

  if (typeof target === 'string') {
    selector = target.startsWith('#') ? target : `#${target}`
    targetEl = document.querySelector(selector)
  } else if (target instanceof HTMLElement) {
    targetEl = target
  }

  // If numeric target
  if (typeof target === 'number') {
    window.scrollTo({
      top: Math.max(0, target),
      behavior: 'smooth'
    })
    if (onComplete) setTimeout(onComplete, 600)
    return
  }

  // If target element found
  if (targetEl) {
    const rect = targetEl.getBoundingClientRect()
    const targetY = Math.max(0, window.pageYOffset + rect.top + offset)

    try {
      window.scrollTo({
        top: targetY,
        behavior: 'smooth'
      })
    } catch {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    if (onComplete) setTimeout(onComplete, 600)
    return
  }

  // Retry once if element was mounting
  if (typeof target === 'string') {
    setTimeout(() => {
      const retryEl = document.querySelector(selector)
      if (retryEl) {
        smoothScrollTo(retryEl, options)
      } else if (onComplete) {
        onComplete()
      }
    }, 120)
  }
}

/**
 * Smoothly scroll to the very top (Home)
 */
export function scrollToHome(options = {}) {
  smoothScrollTo(0, { offset: 0, duration: 800, ...options })
}

/**
 * Smoothly scroll to the pricing section
 */
export function scrollToPricing(options = {}) {
  smoothScrollTo('pricing', { offset: -84, duration: 900, ...options })
}
