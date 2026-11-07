import { useEffect } from 'react'

export function useScrollReveal(dependencies = []) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed')
            observer.unobserve(entry.target)
          }
        })
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px -40px 0px',
      }
    )

    const timer = setTimeout(() => {
      const elements = document.querySelectorAll('.reveal-on-scroll, .reveal-stagger')
      elements.forEach((el) => observer.observe(el))
    }, 50)

    return () => {
      clearTimeout(timer)
      const elements = document.querySelectorAll('.reveal-on-scroll, .reveal-stagger')
      elements.forEach((el) => observer.unobserve(el))
      observer.disconnect()
    }
  }, dependencies)
}
