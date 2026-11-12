import { useLocation } from 'react-router-dom'
import { getDomainConfig } from '../lib/domain'
import './PageSkeleton.css'

export function SkeletonBlock({ width = '100%', height = '16px', radius = '10px', style }) {
  return (
    <div
      className="p5-skeleton-block"
      aria-hidden="true"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  )
}

export function MarketingPageSkeleton() {
  return (
    <div className="p5-skel-marketing-page" role="status" aria-label="Loading page">
      <div className="p5-skel-nav">
        <div className="p5-skel-nav-inner">
          <SkeletonBlock width="112px" height="28px" radius="8px" />
          <div className="p5-skel-nav-icons">
            {Array.from({ length: 7 }).map((_, i) => (
              <SkeletonBlock key={i} width="36px" height="36px" radius="10px" />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <SkeletonBlock width="60px" height="28px" radius="999px" />
            <SkeletonBlock width="104px" height="34px" radius="8px" />
          </div>
        </div>
      </div>

      <div className="p5-skel-hero">
        <SkeletonBlock width="68%" height="44px" radius="12px" />
        <SkeletonBlock width="52%" height="44px" radius="12px" />
        <SkeletonBlock width="78%" height="18px" style={{ marginTop: '8px' }} />
        <SkeletonBlock width="56%" height="18px" />
      </div>

      <div className="p5-skel-grid">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p5-skel-card">
            <SkeletonBlock width="42px" height="42px" radius="10px" />
            <SkeletonBlock width="70%" height="20px" />
            <SkeletonBlock width="100%" height="14px" />
            <SkeletonBlock width="88%" height="14px" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function WorkspaceSkeleton({ showHeader = true }) {
  return (
    <div
      className={`p5-skel-workspace ${showHeader ? '' : 'subpage'}`}
      role="status"
      aria-label="Loading workspace"
    >
      <div className="p5-skel-ws-inner">
        {showHeader && (
          <div className="p5-skel-ws-topbar">
            <SkeletonBlock width="130px" height="30px" radius="8px" />
            <div className="p5-skel-nav-icons">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonBlock key={i} width="84px" height="32px" radius="999px" />
              ))}
            </div>
            <SkeletonBlock width="110px" height="34px" radius="999px" />
          </div>
        )}

        <div className="p5-skel-ws-metrics">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p5-skel-card" style={{ padding: '18px' }}>
              <SkeletonBlock width="48%" height="12px" />
              <SkeletonBlock width="38%" height="28px" />
            </div>
          ))}
        </div>

        <div className="p5-skel-ws-board">
          {Array.from({ length: 3 }).map((_, colIdx) => (
            <div key={colIdx} className="p5-skel-ws-col">
              <SkeletonBlock width="50%" height="18px" />
              <SkeletonBlock width="100%" height="84px" radius="10px" />
              <SkeletonBlock width="100%" height="84px" radius="10px" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AuthPageSkeleton() {
  return (
    <div className="p5-skel-auth" role="status" aria-label="Loading">
      <div className="p5-skel-auth-card">
        <SkeletonBlock width="96px" height="24px" style={{ margin: '0 auto 6px' }} />
        <SkeletonBlock width="72%" height="28px" style={{ margin: '0 auto' }} />
        <SkeletonBlock width="100%" height="44px" radius="10px" style={{ marginTop: '8px' }} />
        <SkeletonBlock width="100%" height="44px" radius="10px" />
        <SkeletonBlock width="100%" height="46px" radius="10px" style={{ marginTop: '6px' }} />
      </div>
    </div>
  )
}

export function WorkspacePickerGridSkeleton() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '18px',
        marginTop: '24px'
      }}
      role="status"
      aria-label="Loading workspaces"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p5-skel-card" style={{ padding: '24px' }}>
          <SkeletonBlock width="44px" height="44px" radius="12px" />
          <SkeletonBlock width="68%" height="22px" />
          <SkeletonBlock width="45%" height="14px" />
        </div>
      ))}
    </div>
  )
}

const AUTH_PATHS = new Set(['/login', '/signup', '/forgot-password', '/verify', '/join', '/auth/action', '/reset-password'])

export default function RouteSkeleton() {
  const location = useLocation()
  const pathname = typeof window !== 'undefined' ? window.location.pathname : location.pathname
  const { isAppSubdomain } = getDomainConfig()

  if (AUTH_PATHS.has(pathname) || pathname === '/workspace') {
    return <AuthPageSkeleton />
  }

  const isMarketingPath = !isAppSubdomain && (
    pathname === '/' ||
    pathname === '/pricing' ||
    pathname === '/features' ||
    pathname === '/about' ||
    pathname === '/about-us' ||
    pathname === '/contact' ||
    pathname === '/thank-you' ||
    pathname === '/product-integrations' ||
    pathname === '/changelog' ||
    pathname === '/docs' ||
    pathname.startsWith('/docs/') ||
    pathname === '/security' ||
    pathname === '/privacy' ||
    pathname === '/terms' ||
    pathname === '/dpa' ||
    pathname === '/subprocessors' ||
    pathname.startsWith('/legal')
  )

  if (isMarketingPath) {
    return <MarketingPageSkeleton />
  }

  return <WorkspaceSkeleton showHeader />
}
