import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { useLocation } from 'react-router-dom'

export const APP_THEME_KEY = 'paper5_app_theme'
export const MARKETING_THEME_KEY = 'paper5_marketing_theme'

/**
 * Determines whether the current context is within the App application (app.paper5.co / workspace / auth)
 * versus the public marketing website (paper5.co).
 */
export const isAppArea = (pathname = '') => {
  if (typeof window === 'undefined') return false
  const hostname = window.location.hostname

  // 1. App Subdomains: app.paper5.co, app.localhost, app.lvh.me
  if (
    hostname.startsWith('app.') ||
    hostname.includes('app.localhost') ||
    hostname.includes('app.lvh.me')
  ) {
    return true
  }

  // 2. App-specific auth & workspace onboarding routes:
  const currentPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : '') || ''
  const appRoutes = [
    '/login',
    '/signup',
    '/forgot-password',
    '/workspace',
    '/verify',
    '/reset-password',
    '/auth',
    '/join'
  ]
  if (appRoutes.some(route => currentPath === route || currentPath.startsWith(route + '/'))) {
    return true
  }

  return false
}

export const getStoredTheme = (isApp) => {
  if (typeof window === 'undefined') return 'light'
  const key = isApp ? APP_THEME_KEY : MARKETING_THEME_KEY
  const saved = localStorage.getItem(key)
  if (saved === 'dark' || saved === 'light') return saved
  return 'light'
}

function syncThemeCookie(isApp, themeValue) {
  if (typeof document === 'undefined') return
  const cookieName = isApp ? 'p5_app_theme' : 'p5_marketing_theme'
  const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:'
  const parts = [
    `${cookieName}=${encodeURIComponent(themeValue)}`,
    'Path=/',
    'Max-Age=31536000',
    'SameSite=Lax'
  ]
  if (isHttps) parts.push('Secure')
  document.cookie = parts.join('; ')
}

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
  isAppArea: false
})

export function ThemeProvider({ children }) {
  let pathname = ''
  try {
    const loc = useLocation()
    pathname = loc?.pathname || ''
  } catch (_) {
    if (typeof window !== 'undefined') {
      pathname = window.location.pathname || ''
    }
  }

  const isApp = useMemo(() => isAppArea(pathname), [pathname])
  const [theme, setThemeState] = useState(() => getStoredTheme(isApp))

  // Synchronize active theme whenever navigating between marketing and app contexts
  useEffect(() => {
    const contextTheme = getStoredTheme(isApp)
    setThemeState(contextTheme)
    document.documentElement.setAttribute('data-theme', contextTheme)
    document.body.setAttribute('data-theme', contextTheme)
    syncThemeCookie(isApp, contextTheme)
  }, [isApp])

  // Apply theme attribute to DOM and save to context-specific storage key
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.body.setAttribute('data-theme', theme)
    const key = isApp ? APP_THEME_KEY : MARKETING_THEME_KEY
    localStorage.setItem(key, theme)
    syncThemeCookie(isApp, theme)
  }, [theme, isApp])

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  const setTheme = (newTheme) => {
    if (newTheme === 'dark' || newTheme === 'light') {
      setThemeState(newTheme)
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, isAppArea: isApp }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
