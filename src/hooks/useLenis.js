import { useEffect } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

export function useLenis() {
  useEffect(() => {
    // Respect user motion preference
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({
      lerp: 0.085, // Silky smooth linear interpolation momentum
      smoothWheel: true,
      wheelMultiplier: 1.05,
      touchMultiplier: 1.5,
      autoResize: true,
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
