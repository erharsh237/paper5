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
    duration = 850, // Duration in ms
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

  // Calculate target Y coordinate
  let targetY = 0

  if (typeof target === 'number') {
    targetY = target
  } else if (targetEl) {
    const rect = targetEl.getBoundingClientRect()
    targetY = window.pageYOffset + rect.top + offset
  } else if (typeof target === 'string') {
    // Retry once in next tick if element was mounting
    setTimeout(() => {
      const retryEl = document.querySelector(selector)
      if (retryEl) {
        smoothScrollTo(retryEl, options)
      } else if (onComplete) {
        onComplete()
      }
    }, 100)
    return
  }

  // Clamp target between 0 and maximum document scrollable height
  const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  targetY = Math.max(0, Math.min(targetY, maxScrollY))

  // High-performance direct requestAnimationFrame cubic ease-in-out animator
  // Guaranteed to execute reliably across all browsers without being swallowed by third-party drivers
  const startY = window.pageYOffset || document.documentElement.scrollTop || 0
  const distance = targetY - startY

  if (Math.abs(distance) < 2) {
    window.scrollTo(0, targetY)
    if (window.__lenis) {
      window.__lenis.animatedScroll = targetY
      window.__lenis.targetScroll = targetY
    }
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
    if (window.__lenis) {
      window.__lenis.animatedScroll = currentY
      window.__lenis.targetScroll = currentY
    }

    if (progress < 1) {
      activeScrollAnimationId = requestAnimationFrame(step)
    } else {
      window.scrollTo(0, targetY)
      if (window.__lenis) {
        window.__lenis.animatedScroll = targetY
        window.__lenis.targetScroll = targetY
      }
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
