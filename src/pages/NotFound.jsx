import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import Paper5Logo from './../components/Paper5Logo'
import SEOHead from './../components/SEOHead'
import { getDomainConfig, getMainUrl } from '../lib/domain'
import './NotFound.css'

const GRID = ['·', '·', '·', '·', 'not_started', 'hit', '·', '·', '·', 'not_started', '·', '·', '·', '·', '·', '·']

export default function NotFound() {
  const cells = useMemo(() => GRID, [])
  const { isAppSubdomain } = getDomainConfig()

  const NavLinkItem = ({ to, children }) =>
    isAppSubdomain ? <a href={getMainUrl(to)} className="nf-nav-link">{children}</a> : <Link to={to} className="nf-nav-link">{children}</Link>

  return (
    <div className="nf-wrap">
      <SEOHead
        title="Page Not Found | Paper5"
        description="The requested Paper5 page could not be found. Return to the homepage or explore features, documentation, and support."
        noIndex
      />
      <div className="nf-card glass-panel">
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '20px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-primary)', marginBottom: '20px' }}>
          <Paper5Logo size={26} decorative />
          <span>Paper5</span>
        </div>

        <div className="nf-badge">
          <span className="nf-dot" />
          404 · Overdue
        </div>

        <h1 className="nf-title">This page missed its deadline.</h1>
        <p className="nf-sub">
          The page you are looking for does not exist or may have been moved.
        </p>

        <div className="nf-grid" role="img" aria-label="A 4 by 4 grid representing this missing page, mostly empty with one marked cell">
          {cells.map((c, i) => (
            <div key={i} className={`nf-cell ${c === 'hit' ? 'nf-cell--hit' : ''}`}>
              {c === 'hit' ? '✕' : ''}
            </div>
          ))}
        </div>

        {isAppSubdomain ? (
          <a href={getMainUrl('/')} className="nf-cta">
            Back to Paper5 Home →
          </a>
        ) : (
          <Link to="/" className="nf-cta">
            Back to Homepage →
          </Link>
        )}

        <nav className="nf-links" aria-label="Helpful navigation links">
          <NavLinkItem to="/features">Features</NavLinkItem>
          <NavLinkItem to="/pricing">Pricing</NavLinkItem>
          <NavLinkItem to="/docs">Documentation</NavLinkItem>
          <NavLinkItem to="/contact">Contact</NavLinkItem>
        </nav>

        <div className="nf-footnote mono">status: 404 · page not found</div>
      </div>
    </div>
  )
}
