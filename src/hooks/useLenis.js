import { useEffect } from 'react'
import Lenis from 'lenis'

export function useLenis() {
  useEffect(() => {
    // Respect user motion preference
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
    })

    window.__lenis = lenis

    let reqId
    function raf(time) {
      lenis.raf(time)
      reqId = requestAnimationFrame(raf)
    }

    reqId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(reqId)
      lenis.destroy()
      window.__lenis = null
    }
  }, [])
}
