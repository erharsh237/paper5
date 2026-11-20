import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    // Avoid instant-snapping to 0 when navigating to pricing or an anchor hash
    if (!hash && pathname !== '/pricing') {
      if (window.__lenis) {
        window.__lenis.scrollTo(0, { immediate: true })
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' })
      }
    }
  }, [pathname, hash])

  return null
}
