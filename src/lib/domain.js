/**
 * Domain & Subdomain routing configuration helper
 * Main Website: paper5.com
 * SprintOS App: app.paper5.com
 */

export const IS_PRODUCTION = import.meta.env.PROD

export const getDomainConfig = () => {
  const hostname = window.location.hostname
  const protocol = window.location.protocol
  const port = window.location.port ? `:${window.location.port}` : ''

  // Detect if current request is on the app subdomain (app.paper5.com or app.localhost)
  const isAppSubdomain = 
    hostname.startsWith('app.') || 
    hostname.includes('app.localhost') ||
    hostname.includes('app.lvh.me')

  // Default URLs
  let mainSiteUrl = import.meta.env.VITE_MAIN_SITE_URL
  let appSiteUrl = import.meta.env.VITE_APP_SITE_URL

  if (!mainSiteUrl || !appSiteUrl) {
    if (IS_PRODUCTION) {
      const rootDomain = hostname.replace(/^(app\.|www\.)+/, '') || 'paper5.co'
      mainSiteUrl = `${protocol}//${rootDomain}`
      appSiteUrl = `${protocol}//app.${rootDomain}`
    } else {
      const cleanDevHost = hostname.replace(/^app\./, '')
      mainSiteUrl = `${protocol}//${cleanDevHost}${port}`
      appSiteUrl = `${protocol}//app.${cleanDevHost}${port}`
    }
  }

  return {
    isAppSubdomain,
    mainSiteUrl,
    appSiteUrl,
    hostname
  }
}

/**
 * Returns full or relative URL for App routes (app.paper5.com)
 * Guaranteed to stay on the same origin to prevent open external redirects.
 */
export const getAppUrl = (path = '') => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return cleanPath
}

/**
 * Returns full or relative URL for Main Website routes (paper5.com)
 * Guaranteed to stay on the same origin to prevent open external redirects.
 */
export const getMainUrl = (path = '') => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return cleanPath
}
