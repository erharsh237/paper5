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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <SkeletonBlock width="28px" height="28px" radius="8px" />
              <SkeletonBlock width="130px" height="24px" radius="6px" />
            </div>
            <div className="p5-skel-nav-icons">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} width="82px" height="30px" radius="999px" />
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <SkeletonBlock width="32px" height="32px" radius="999px" />
              <SkeletonBlock width="100px" height="32px" radius="8px" />
            </div>
          </div>
        )}

        <div className="p5-skel-ws-metrics">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p5-skel-card" style={{ padding: '16px 20px', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SkeletonBlock width="45%" height="11px" radius="4px" />
                <SkeletonBlock width="16px" height="16px" radius="4px" />
              </div>
              <SkeletonBlock width="35%" height="28px" radius="6px" style={{ marginTop: '2px' }} />
              <SkeletonBlock width="65%" height="10px" radius="4px" style={{ marginTop: '4px' }} />
            </div>
          ))}
        </div>

        <div className="p5-skel-ws-board">
          {Array.from({ length: 3 }).map((_, colIdx) => (
            <div key={colIdx} className="p5-skel-ws-col" style={{ padding: '16px', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SkeletonBlock width="40%" height="14px" radius="4px" />
                <SkeletonBlock width="20px" height="18px" radius="999px" />
              </div>
              {Array.from({ length: 2 }).map((_, taskIdx) => (
                <div key={taskIdx} style={{ background: 'var(--surface, #FFFFFF)', border: '1px solid var(--border-soft, #E2E8F0)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <SkeletonBlock width="80%" height="14px" radius="4px" />
                  <SkeletonBlock width="55%" height="12px" radius="4px" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <SkeletonBlock width="50px" height="18px" radius="4px" />
                    <SkeletonBlock width="22px" height="22px" radius="50%" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function BentoGridSkeleton({ hasHero = true }) {
  return (
    <div className="integrations-bento-grid" role="status" aria-label="Loading integrations">
      {hasHero && (
        <div className="bento-tile-12 bento-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '12px', width: '60%' }}>
              <SkeletonBlock width="32px" height="32px" radius="8px" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                <SkeletonBlock width="240px" height="20px" radius="6px" />
                <SkeletonBlock width="85%" height="13px" radius="4px" />
              </div>
            </div>
            <SkeletonBlock width="130px" height="24px" radius="999px" />
          </div>
          <div style={{ marginTop: '16px' }}>
            <SkeletonBlock width="100%" height="110px" radius="10px" />
          </div>
        </div>
      )}

      {/* Row 2: 8 cols + 4 cols */}
      <div className="bento-tile-8 bento-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <SkeletonBlock width="32px" height="32px" radius="8px" />
            <SkeletonBlock width="190px" height="18px" radius="6px" />
          </div>
          <SkeletonBlock width="80px" height="22px" radius="999px" />
        </div>
        <SkeletonBlock width="75%" height="13px" radius="4px" style={{ marginTop: '8px' }} />
        <SkeletonBlock width="100%" height="42px" radius="8px" style={{ marginTop: '12px' }} />
      </div>

      <div className="bento-tile-4 bento-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <SkeletonBlock width="32px" height="32px" radius="8px" />
            <SkeletonBlock width="100px" height="18px" radius="6px" />
          </div>
          <SkeletonBlock width="60px" height="22px" radius="999px" />
        </div>
        <SkeletonBlock width="90%" height="13px" radius="4px" style={{ marginTop: '8px' }} />
        <SkeletonBlock width="100%" height="34px" radius="8px" style={{ marginTop: '12px' }} />
      </div>

      {/* Row 3: 3 x 4 cols */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bento-tile-4 bento-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <SkeletonBlock width="32px" height="32px" radius="8px" />
              <SkeletonBlock width="90px" height="18px" radius="6px" />
            </div>
            <SkeletonBlock width="60px" height="22px" radius="999px" />
          </div>
          <SkeletonBlock width="85%" height="13px" radius="4px" style={{ marginTop: '8px' }} />
          <SkeletonBlock width="100%" height="34px" radius="8px" style={{ marginTop: '12px' }} />
        </div>
      ))}
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
