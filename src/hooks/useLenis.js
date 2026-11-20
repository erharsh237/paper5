import { useEffect } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

export function useLenis() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Respect users who have explicitly requested reduced motion
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      document.documentElement.style.scrollBehavior = 'auto'
      return
    }

    // Only bypass on standalone mobile phone/tablet operating systems where touch momentum is native
    const isMobileOS = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    if (isMobileOS) {
      document.documentElement.style.scrollBehavior = 'smooth'
      return
    }

    // Initialize Lenis with buttery momentum for physical mouse wheel scrolling
    const lenis = new Lenis({
      lerp: 0.09, // Buttery smooth momentum glide that removes harsh stepped wheel notches
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.0,
      syncTouch: false,
      autoResize: true,
    })

    window.__lenis = lenis

    // Dedicated requestAnimationFrame loop to ensure 60fps/120fps buttery mouse wheel interpolation
    let rafId = null
    const raf = (time) => {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      lenis.destroy()
      window.__lenis = null
    }
  }, [])
}
