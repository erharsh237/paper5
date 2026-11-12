import { useEffect } from 'react'

const DEFAULT_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
const DEFAULT_OG_IMAGE = 'https://paper5.co/og-image.png'
const DEFAULT_OG_IMAGE_ALT = 'Paper5 share banner reading Connected Project Workspace for Small Teams'

/**
 * Dynamic SEO Head Manager component
 * Dynamically updates page title, meta description, robots directive, canonical URL, and OpenGraph/Twitter tags per page.
 */
export default function SEOHead({
  title,
  description,
  canonicalUrl,
  ogType = 'website',
  ogImage = DEFAULT_OG_IMAGE,
  ogImageAlt = DEFAULT_OG_IMAGE_ALT,
  ogImageWidth = '1200',
  ogImageHeight = '630',
  noIndex = false
}) {
  useEffect(() => {
    // 1. Update Title
    if (title) {
      document.title = title.includes('Paper5') ? title : `${title} | Paper5`
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

    // 2. Update Robots Directive
    setMeta('name', 'robots', noIndex ? 'noindex, nofollow' : DEFAULT_ROBOTS)

    // 3. Update Meta Description & Social Cards
    if (description) {
      setMeta('name', 'description', description)
      setMeta('property', 'og:description', description)
      setMeta('name', 'twitter:description', description)
    }

    if (title) {
      const fullTitle = title.includes('Paper5') ? title : `${title} | Paper5`
      setMeta('property', 'og:title', fullTitle)
      setMeta('name', 'twitter:title', fullTitle)
    }

    setMeta('property', 'og:type', ogType)
    setMeta('property', 'og:image', ogImage || DEFAULT_OG_IMAGE)
    setMeta('property', 'og:image:width', String(ogImageWidth || '1200'))
    setMeta('property', 'og:image:height', String(ogImageHeight || '630'))
    setMeta('property', 'og:image:alt', ogImageAlt || DEFAULT_OG_IMAGE_ALT)

    setMeta('name', 'twitter:card', 'summary_large_image')
    setMeta('name', 'twitter:image', ogImage || DEFAULT_OG_IMAGE)
    setMeta('name', 'twitter:image:alt', ogImageAlt || DEFAULT_OG_IMAGE_ALT)

    // 4. Update Canonical Tag (unless noIndex where keeping clean current URL or omitting)
    const href = canonicalUrl || window.location.href
    let canonical = document.querySelector('link[rel="canonical"]')
    if (noIndex && !canonicalUrl) {
      if (canonical) canonical.remove()
    } else {
      if (!canonical) {
        canonical = document.createElement('link')
        canonical.setAttribute('rel', 'canonical')
        document.head.appendChild(canonical)
      }
      canonical.setAttribute('href', href)
    }

    setMeta('property', 'og:url', href)
    setMeta('name', 'twitter:url', href)
  }, [title, description, canonicalUrl, ogType, ogImage, ogImageAlt, ogImageWidth, ogImageHeight, noIndex])

  return null
}
