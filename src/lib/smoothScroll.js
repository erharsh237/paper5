/**
 * Universal Smooth Scroll Animation Utility
 * 
 * Provides silky frame-by-frame cubic ease-in-out scrolling animations across all
 * browsers and devices (desktop, laptop touchscreens, trackpads, mobile) without
 * jumping or relying on third-party drivers.
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
 * @param {object} options - { offset: -84, duration: 900, easing, onComplete }
 */
export function smoothScrollTo(target, options = {}) {
  if (typeof window === 'undefined') return

  const {
    offset = -84, // Default header clearance
    duration = 900, // Duration in ms for a silky glide
    easing = easeInOutCubic,
    onComplete
  } = options

  // Cancel any running animation to prevent fighting
  if (activeScrollAnimationId) {
    cancelAnimationFrame(activeScrollAnimationId)
    activeScrollAnimationId = null
  }

  // Resolve DOM element
  let targetEl = null
  let selector = null

  if (typeof target === 'string') {
    selector = target.startsWith('#') ? target : `#${target}`
    targetEl = document.querySelector(selector)
  } else if (target instanceof HTMLElement) {
    targetEl = target
  }

  // If numeric coordinate
  if (typeof target === 'number') {
    animateScrollTo(target, duration, easing, onComplete)
    return
  }

  // If target element found
  if (targetEl) {
    const rect = targetEl.getBoundingClientRect()
    const targetY = window.pageYOffset + rect.top + offset
    animateScrollTo(targetY, duration, easing, onComplete)
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
    }, 100)
  }
}

function animateScrollTo(targetY, duration, easing, onComplete) {
  const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  const clampedTargetY = Math.max(0, Math.min(targetY, maxScrollY))
  const startY = window.pageYOffset || document.documentElement.scrollTop || 0
  const distance = clampedTargetY - startY

  if (Math.abs(distance) < 2) {
    window.scrollTo(0, clampedTargetY)
    if (onComplete) onComplete()
    return
  }

  const startTime = performance.now()

  function step(now) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = easing(progress)
    const currentY = startY + distance * eased

    window.scrollTo(0, currentY)

    if (progress < 1) {
      activeScrollAnimationId = requestAnimationFrame(step)
    } else {
      window.scrollTo(0, clampedTargetY)
      activeScrollAnimationId = null
      if (onComplete) onComplete()
    }
  }

  activeScrollAnimationId = requestAnimationFrame(step)
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
