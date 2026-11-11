import { useEffect } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

export function useLenis() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Disable custom scroll hijacking on Mobile, Touch devices, TVs, and low-power screens
    const isTouchOrTV = 
      /Mobi|Android|iPhone|iPad|TV|SmartTV|HbbTV|AppleTV|CrKey|Tizen|WebOS|Jio/i.test(navigator.userAgent) || 
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

    if (isTouchOrTV) {
      document.documentElement.style.scrollBehavior = 'smooth'
      return
    }

    const lenis = new Lenis({
      duration: 0.85, // Snappy, responsive glide without sluggish drag
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.0,
      autoResize: true,
      autoRaf: true,
    })

    window.__lenis = lenis

    return () => {
      lenis.destroy()
      window.__lenis = null
    }
  }, [])
}
