import { useEffect } from 'react'

/**
 * Dynamic SEO Head Manager component
 * Dynamically updates page title, meta description, canonical URL, and OpenGraph tags per page.
 */
export default function SEOHead({ title, description, canonicalUrl, ogType = 'website' }) {
  useEffect(() => {
    // 1. Update Title
    if (title) {
      document.title = title.includes('Paper5') ? title : `${title} | SprintOS by Paper5`
    }

    // Helper to set meta content
    const setMeta = (nameAttr, nameValue, content) => {
      if (!content) return
      let element = document.querySelector(`meta[${nameAttr}="${nameValue}"]`)
      if (!element) {
        element = document.createElement('meta')
        element.setAttribute(nameAttr, nameValue)
        document.head.appendChild(element)
      }
      element.setAttribute('content', content)
    }

    // 2. Update Meta Description & Social Cards
    if (description) {
      setMeta('name', 'description', description)
      setMeta('property', 'og:description', description)
      setMeta('name', 'twitter:description', description)
    }

    if (title) {
      setMeta('property', 'og:title', title)
      setMeta('name', 'twitter:title', title)
    }

    setMeta('property', 'og:type', ogType)

    // 3. Update Canonical Tag
    const href = canonicalUrl || window.location.href
    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', href)
    setMeta('property', 'og:url', href)

  }, [title, description, canonicalUrl, ogType])

  return null
}
