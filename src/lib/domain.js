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
      mainSiteUrl = 'https://paper5.com'
      appSiteUrl = 'https://app.paper5.com'
    } else {
      mainSiteUrl = `${protocol}//${hostname.replace(/^app\./, '')}${port}`
      appSiteUrl = `${protocol}//${hostname.startsWith('app.') ? hostname : 'app.' + hostname}${port}`
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
 */
export const getAppUrl = (path = '') => {
  const { isAppSubdomain, appSiteUrl } = getDomainConfig()
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  
  // If we're already on app.paper5.com, use relative path
  if (isAppSubdomain) {
    return cleanPath
  }
  
  // Otherwise cross-link to app.paper5.com
  return `${appSiteUrl}${cleanPath}`
}

/**
 * Returns full or relative URL for Main Website routes (paper5.com)
 */
export const getMainUrl = (path = '') => {
  const { isAppSubdomain, mainSiteUrl } = getDomainConfig()
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  
  // If we're on paper5.com, use relative path
  if (!isAppSubdomain) {
    return cleanPath
  }
  
  // Otherwise cross-link to paper5.com
  return `${mainSiteUrl}${cleanPath}`
}
