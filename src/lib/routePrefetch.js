/**
 * Shared route module registry and idle/hover prefetcher.
 * Ensures each lazy route chunk is registered once and preloaded ahead of navigation.
 */

const prefetchedKeys = new Set()
const modulePromises = new Map()
const loadedKeys = new Set()
const routeLoadListeners = new Set()
let activeRouteLoads = 0

function notifyRouteLoadListeners() {
  routeLoadListeners.forEach((listener) => listener())
}

export function subscribeRouteLoading(listener) {
  routeLoadListeners.add(listener)
  return () => routeLoadListeners.delete(listener)
}

export function getIsRouteLoading() {
  return activeRouteLoads > 0
}

export function isRouteKeyLoaded(key) {
  return Boolean(key && loadedKeys.has(key))
}

export function beginRouteLoad() {
  activeRouteLoads += 1
  if (activeRouteLoads === 1) {
    queueMicrotask(notifyRouteLoadListeners)
  }
}

export function endRouteLoad() {
  setTimeout(() => {
    activeRouteLoads = Math.max(0, activeRouteLoads - 1)
    if (activeRouteLoads === 0) {
      notifyRouteLoadListeners()
    }
  }, 0)
}

export const routeImporters = {
  landing: () => import('../pages/Landing'),
  features: () => import('../pages/Features'),
  about: () => import('../pages/AboutUs'),
  productIntegrations: () => import('../pages/ProductIntegrationsPage'),
  docs: () => import('../pages/DocsPage'),
  changelog: () => import('../pages/MarketingPages').then((m) => ({ default: m.Changelog })),
  security: () => import('../pages/MarketingPages').then((m) => ({ default: m.Security })),
  contact: () => import('../pages/Contact'),
  thankYou: () => import('../pages/ThankYou'),
  legal: () => import('../pages/Legal'),
  privacy: () => import('../pages/Privacy'),
  login: () => import('../pages/Login'),
  signup: () => import('../pages/Signup'),
  forgotPassword: () => import('../pages/ForgotPassword'),
  verify: () => import('../pages/VerifyEmail'),
  join: () => import('../pages/JoinWorkspace'),
  authAction: () => import('../pages/AuthAction'),
  forcePasswordReset: () => import('../pages/ForcePasswordReset'),
  workspacePicker: () => import('../pages/WorkspacePicker'),
  myDashboard: () => import('../pages/MyDashboard'),
  workflow: () => import('../pages/WorkflowPage'),
  team: () => import('../pages/Dashboard'),
  meeting: () => import('../pages/Meeting'),
  analytics: () => import('../pages/Analytics'),
  integrations: () => import('../pages/Integrations'),
  settings: () => import('../pages/Settings'),
  profile: () => import('../pages/Profile'),
  legalConsentModal: () => import('../components/LegalConsentModal'),
  onboardingWizardModal: () => import('../components/OnboardingWizardModal')
}

const PATH_TO_KEY = {
  '/': 'landing',
  '/pricing': 'landing',
  '/#pricing': 'landing',
  '/features': 'features',
  '/about': 'about',
  '/about-us': 'about',
  '/product-integrations': 'productIntegrations',
  '/docs': 'docs',
  '/docs/api': 'docs',
  '/changelog': 'changelog',
  '/security': 'security',
  '/contact': 'contact',
  '/thank-you': 'thankYou',
  '/privacy': 'privacy',
  '/terms': 'legal',
  '/dpa': 'legal',
  '/subprocessors': 'legal',
  '/legal': 'legal',
  '/login': 'login',
  '/signup': 'signup',
  '/forgot-password': 'forgotPassword',
  '/verify': 'verify',
  '/join': 'join',
  '/auth/action': 'authAction',
  '/reset-password': 'authAction',
  '/workspace': 'workspacePicker',
  '/workflow': 'workflow',
  '/team': 'team',
  '/meeting': 'meeting',
  '/analytics': 'analytics',
  '/integrations': 'integrations',
  '/settings': 'settings',
  '/profile': 'profile'
}

export function resolveRouteKey(path) {
  if (!path || typeof path !== 'string') return null
  const normalized = path.split('?')[0].split('#')[0] || '/'
  if (PATH_TO_KEY[path]) return PATH_TO_KEY[path]
  if (PATH_TO_KEY[normalized]) return PATH_TO_KEY[normalized]
  const wsMatch = normalized.match(/^\/[^/]+\/(workflow|team|meeting|analytics|integrations|settings|profile)$/)
  if (wsMatch) return wsMatch[1]
  if (normalized.startsWith('/legal/')) return 'legal'
  if (normalized.startsWith('/docs/')) return 'docs'
  return null
}

export function loadRouteModule(key) {
  const importer = routeImporters[key]
  if (!importer) {
    return Promise.reject(new Error(`Unknown route key: ${key}`))
  }
  const existing = modulePromises.get(key)
  if (existing) return existing

  prefetchedKeys.add(key)
  const promise = importer()
    .then((mod) => {
      loadedKeys.add(key)
      return mod
    })
    .catch((err) => {
      prefetchedKeys.delete(key)
      modulePromises.delete(key)
      throw err
    })
  modulePromises.set(key, promise)
  return promise
}

export function prefetchRouteKey(key) {
  if (!key || prefetchedKeys.has(key) || !routeImporters[key]) return
  loadRouteModule(key).catch(() => {})
}

export function prefetchRoute(path) {
  const key = resolveRouteKey(path)
  if (key) prefetchRouteKey(key)
}

let backgroundPrefetchScheduled = false

export function scheduleBackgroundPrefetch(isAppSubdomain = false) {
  if (typeof window === 'undefined' || backgroundPrefetchScheduled) return
  backgroundPrefetchScheduled = true

  const keys = isAppSubdomain
    ? ['workspacePicker', 'myDashboard', 'workflow', 'team', 'meeting', 'analytics']
    : ['landing', 'features', 'productIntegrations', 'docs', 'about', 'contact', 'privacy']

  const run = () => {
    keys.forEach((key, index) => {
      setTimeout(() => prefetchRouteKey(key), index * 80)
    })
  }

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 1200 })
  } else {
    setTimeout(run, 350)
  }
}
