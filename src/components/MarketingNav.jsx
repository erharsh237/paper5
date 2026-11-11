import ThemeToggle from './ThemeToggle'
import { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import ContactModal from './ContactModal'
import { ArrowRight, Menu, X, ChevronDown, User, LogOut } from 'lucide-react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHouse, faLayerGroup, faPlug, faTag, faBookOpen, faCircleInfo, faEnvelope, faShieldHalved } from '@fortawesome/free-solid-svg-icons'
import logo from '../assets/logo.png'
import Paper5Logo from './Paper5Logo'
import '../pages/Landing.css'
import { getDomainConfig, getAppUrl, getMainUrl } from '../lib/domain'
import { safeRedirect } from '../lib/safeRedirect'

export default function MarketingNav() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { isAppSubdomain } = getDomainConfig()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [isContactOpen, setIsContactOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()

  const handleSignIn = () => {
    window.open(getAppUrl('/login'), '_blank', 'noopener,noreferrer')
  }

  const handleGetStarted = () => {
    window.open(getAppUrl('/signup'), '_blank', 'noopener,noreferrer')
  }

  const handleHomeClick = (e) => {
    if (location.pathname === '/' || location.pathname === '') {
      if (e) e.preventDefault()
      if (window.__lenis) {
        window.__lenis.scrollTo(0, {
          duration: 1.25,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
        })
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
      if (window.location.hash) {
        window.history.pushState('', document.title, window.location.pathname)
      }
    } else {
      if (window.__lenis) {
        window.__lenis.scrollTo(0, { duration: 1.25 })
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
  }

  const handleAnchorClick = (e, anchorId) => {
    if (location.pathname === '/' || location.pathname === '') {
      if (e) e.preventDefault()
      const el = document.getElementById(anchorId)
      if (el) {
        if (window.__lenis) {
          window.__lenis.scrollTo(el, {
            offset: -84,
            duration: 1.25,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
          })
        } else {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        window.history.pushState('', document.title, `#${anchorId}`)
      }
    }
  }

  const handlePricingClick = (e) => {
    handleAnchorClick(e, 'pricing')
  }

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  const navLinks = [
    { label: 'Home', path: '/', exact: true, icon: faHouse },
    { label: 'Features', path: '/features', icon: faLayerGroup },
    { label: 'Integrations', path: '/product-integrations', icon: faPlug },
    { label: 'Pricing', path: '/#pricing', isAnchor: true, anchorId: 'pricing', icon: faTag },
    { label: 'Documentation', path: '/docs', icon: faBookOpen },
    { label: 'About', path: '/about', icon: faCircleInfo },
    { label: 'Contact', path: '/contact', icon: faEnvelope },
    { label: 'Privacy', path: '/privacy', icon: faShieldHalved }
  ]

  const isLinkActive = (item) => {
    if (item.isAnchor) return location.hash === `#${item.anchorId}`
    if (item.exact) return location.pathname === '/' && !location.hash
    return location.pathname.startsWith(item.path)
  }

  return (
    <>
      <nav className="landing-nav" role="navigation" aria-label="Main Navigation">
        <div className="nav-container">
          {/* Logo & Brand */}
          {isAppSubdomain ? (
            <a href={getMainUrl('/')} className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
              <Paper5Logo size={28} />
              <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
                PAPER5
              </span>
            </a>
          ) : (
            <Link to="/" onClick={handleHomeClick} className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
              <Paper5Logo size={28} />
              <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
                PAPER5
              </span>
            </Link>
          )}

          {/* Desktop Icon Navigation */}
          <div className="nav-links desktop-only">
            {navLinks.map((item) => (
              item.isAnchor ? (
                <a
                  key={item.label}
                  href={isAppSubdomain ? getMainUrl(item.path) : item.path}
                  onClick={(e) => handleAnchorClick(e, item.anchorId)}
                  className={`nav-link-icon-wrap ${isLinkActive(item) ? "active" : ""}`}
                  aria-label={item.label}
                >
                  <FontAwesomeIcon icon={item.icon} className="nav-fa-icon" />
                  <span className="nav-tooltip" role="tooltip">{item.label}</span>
                </a>
              ) : isAppSubdomain ? (
                <a
                  key={item.label}
                  href={getMainUrl(item.path)}
                  className={`nav-link-icon-wrap ${isLinkActive(item) ? "active" : ""}`}
                  aria-label={item.label}
                >
                  <FontAwesomeIcon icon={item.icon} className="nav-fa-icon" />
                  <span className="nav-tooltip" role="tooltip">{item.label}</span>
                </a>
              ) : (
                <Link
                  key={item.label}
                  to={item.path}
                  onClick={item.path === '/' ? handleHomeClick : undefined}
                  className={`nav-link-icon-wrap ${isLinkActive(item) ? "active" : ""}`}
                  aria-label={item.label}
                >
                  <FontAwesomeIcon icon={item.icon} className="nav-fa-icon" />
                  <span className="nav-tooltip" role="tooltip">{item.label}</span>
                </Link>
              )
            ))}
          </div>

          {/* Mobile Theme Toggle */}
          <div className="mobile-only-toggle mobile-only">
            <ThemeToggle />
          </div>
          <div className="nav-actions desktop-only">
            <ThemeToggle />
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <a 
                  href={getAppUrl('/workspace')} 
                  className="btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13.5px', textDecoration: 'none' }}
                >
                  <span>Go to Workspace</span>
                  <ArrowRight size={14} />
                </a>

                <div style={{ position: 'relative' }}>
                  <button 
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      background: 'var(--bg-layer-2)', 
                      border: '1px solid var(--border)', 
                      padding: '4px 8px 4px 4px', 
                      borderRadius: '100px', 
                      cursor: 'pointer' 
                    }}
                    aria-label="User profile menu"
                  >
                    <div style={{ 
                      width: '26px', 
                      height: '26px', 
                      borderRadius: '50%', 
                      background: '#000000', 
                      color: '#ffffff', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontWeight: 700, 
                      fontSize: '12px' 
                    }}>
                      {(user.displayName || user.email || 'U')[0].toUpperCase()}
                    </div>
                    <ChevronDown size={14} color="var(--text-secondary)" />
                  </button>
                  
                  {showProfileMenu && (
                    <>
                      <div 
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} 
                        onClick={() => setShowProfileMenu(false)}
                      />
                      <div style={{ 
                        position: 'absolute', 
                        top: '100%', 
                        right: 0, 
                        marginTop: '8px', 
                        background: 'var(--bg-panel)', 
                        border: '1px solid var(--border)', 
                        borderRadius: '10px', 
                        padding: '6px', 
                        minWidth: '180px', 
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', 
                        zIndex: 100 
                      }}>
                        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px' }}>
                          <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user.displayName || user.email}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Active User</div>
                        </div>
                        <button 
                          onClick={() => {
                            setShowProfileMenu(false)
                            logout()
                          }}
                          style={{ 
                            width: '100%', 
                            textAlign: 'left', 
                            padding: '8px 10px', 
                            background: 'transparent', 
                            border: 'none', 
                            color: 'var(--accent-critical)', 
                            fontSize: '13px', 
                            fontWeight: 500, 
                            cursor: 'pointer', 
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          <LogOut size={14} />
                          <span>Sign out</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  className="nav-btn-link" 
                  onClick={handleSignIn}
                >
                  Sign In
                </button>
                <button 
                  className="btn-primary btn-sm nav-btn-signup"
                  onClick={handleGetStarted}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 18px', fontSize: '13.5px' }}
                >
                  <span>Get Started</span>
                  <ArrowRight size={14} className="nav-arrow-icon" />
                </button>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Toggle */}
          <button 
            className="mobile-menu-btn" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Contact Sales / Support Modal */}
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />

      {/* Responsive Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="mobile-drawer" style={{ paddingTop: '80px' }}>
          <div className="mobile-drawer-links">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 16px 16px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: "14px", fontWeight: 600 }}>Theme Mode</span>
              <ThemeToggle />
            </div>
            {isAppSubdomain ? (
              <a 
                href={getMainUrl('/')} 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`mobile-drawer-link ${location.pathname === '/' && !location.hash ? 'active' : ''}`}
              >
                <span>Home</span>
              </a>
            ) : (
              <Link 
                to="/" 
                onClick={(e) => {
                  handleHomeClick(e);
                  setIsMobileMenuOpen(false);
                }} 
                className={`mobile-drawer-link ${location.pathname === '/' && !location.hash ? 'active' : ''}`}
              >
                <span>Home</span>
              </Link>
            )}

            {isAppSubdomain ? (
              <a 
                href={getMainUrl('/features')} 
                onClick={() => setIsMobileMenuOpen(false)} 
                className={`mobile-drawer-link ${location.pathname === '/features' ? 'active' : ''}`}
              >
                <span>Features</span>
              </a>
            ) : (
              <Link 
                to="/features" 
                onClick={() => setIsMobileMenuOpen(false)} 
                className={`mobile-drawer-link ${location.pathname === '/features' ? 'active' : ''}`}
              >
                <span>Features</span>
              </Link>
            )}

            {isAppSubdomain ? (
              <a 
                href={getMainUrl('/product-integrations')} 
                onClick={() => setIsMobileMenuOpen(false)} 
                className={`mobile-drawer-link ${location.pathname === '/product-integrations' ? 'active' : ''}`}
              >
                <span>Integrations</span>
              </a>
            ) : (
              <Link 
                to="/product-integrations" 
                onClick={() => setIsMobileMenuOpen(false)} 
                className={`mobile-drawer-link ${location.pathname === '/product-integrations' ? 'active' : ''}`}
              >
                <span>Integrations</span>
              </Link>
            )}

            <a 
              href={isAppSubdomain ? getMainUrl('/#pricing') : '/#pricing'} 
              onClick={(e) => { 
                if (!isAppSubdomain) handlePricingClick(e); 
                setIsMobileMenuOpen(false); 
              }} 
              className={`mobile-drawer-link ${location.hash === '#pricing' ? 'active' : ''}`}
            >
              <span>Pricing</span>
            </a>

            {isAppSubdomain ? (
              <a 
                href={getMainUrl('/docs')} 
                onClick={() => setIsMobileMenuOpen(false)} 
                className={`mobile-drawer-link ${location.pathname.startsWith('/docs') ? 'active' : ''}`}
              >
                <span>Documentation</span>
              </a>
            ) : (
              <Link 
                to="/docs" 
                onClick={() => setIsMobileMenuOpen(false)} 
                className={`mobile-drawer-link ${location.pathname.startsWith('/docs') ? 'active' : ''}`}
              >
                <span>Documentation</span>
              </Link>
            )}

            {isAppSubdomain ? (
              <a 
                href={getMainUrl('/about')} 
                onClick={() => setIsMobileMenuOpen(false)} 
                className={`mobile-drawer-link ${location.pathname === '/about' ? 'active' : ''}`}
              >
                <span>About Us</span>
              </a>
            ) : (
              <Link 
                to="/about" 
                onClick={() => setIsMobileMenuOpen(false)} 
                className={`mobile-drawer-link ${location.pathname === '/about' ? 'active' : ''}`}
              >
                <span>About Us</span>
              </Link>
            )}

            {isAppSubdomain ? (
              <a 
                href={getMainUrl('/contact')} 
                onClick={() => setIsMobileMenuOpen(false)} 
                className={`mobile-drawer-link ${location.pathname === '/contact' ? 'active' : ''}`}
              >
                <span>Contact</span>
              </a>
            ) : (
              <Link 
                to="/contact" 
                onClick={() => setIsMobileMenuOpen(false)} 
                className={`mobile-drawer-link ${location.pathname === '/contact' ? 'active' : ''}`}
              >
                <span>Contact</span>
              </Link>
            )}

            {isAppSubdomain ? (
              <a 
                href={getMainUrl('/privacy')} 
                onClick={() => setIsMobileMenuOpen(false)} 
                className={`mobile-drawer-link ${location.pathname === '/privacy' ? 'active' : ''}`}
              >
                <span>Privacy Policy</span>
              </a>
            ) : (
              <Link 
                to="/privacy" 
                onClick={() => setIsMobileMenuOpen(false)} 
                className={`mobile-drawer-link ${location.pathname === '/privacy' ? 'active' : ''}`}
              >
                <span>Privacy Policy</span>
              </Link>
            )}

            <button 
              className="mobile-drawer-link" 
              style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', cursor: 'pointer' }}
              onClick={() => { 
                setIsContactOpen(true); 
                setIsMobileMenuOpen(false); 
              }}
            >
              <span>Contact Support</span>
            </button>
          </div>

          <div className="mobile-drawer-footer">
            {user ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <a 
                  href={getAppUrl('/workspace')} 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="btn-primary w-full center-text" 
                  style={{ justifyContent: 'center', textDecoration: 'none', padding: '12px' }}
                >
                  Go to Workspace &rarr;
                </a>
                <button 
                  className="btn-secondary w-full center-text" 
                  style={{ justifyContent: 'center', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '10px' }} 
                  onClick={() => { logout(); setIsMobileMenuOpen(false); }}
                >
                  Sign out ({user.displayName || user.email})
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button 
                  className="btn-primary w-full center-text" 
                  style={{ justifyContent: 'center', padding: '12px' }} 
                  onClick={() => { handleGetStarted(); setIsMobileMenuOpen(false); }}
                >
                  Get Started for Free &rarr;
                </button>
                <button 
                  className="btn-ghost w-full center-text" 
                  style={{ justifyContent: 'center', padding: '10px', border: '1px solid var(--border)' }} 
                  onClick={() => { handleSignIn(); setIsMobileMenuOpen(false); }}
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
