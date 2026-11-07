import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (!hash) {
      if (window.__lenis) {
        window.__lenis.scrollTo(0, { immediate: false })
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
  }, [pathname, hash])

  return null
}
