import { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import ContactModal from './ContactModal'
import { ArrowRight, Menu, X, ChevronDown, User, LogOut } from 'lucide-react'
import logo from '../assets/logo.png'
import '../pages/Landing.css'
import { getAppUrl } from '../lib/domain'

export default function MarketingNav() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [isContactOpen, setIsContactOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()

  const handleSignIn = () => {
    const target = getAppUrl('/login')
    if (target.startsWith('http')) {
      window.location.href = target
    } else {
      navigate(target)
    }
  }

  const handleGetStarted = () => {
    const target = getAppUrl('/signup')
    if (target.startsWith('http')) {
      window.location.href = target
    } else {
      navigate(target)
    }
  }

  const handlePricingClick = (e) => {
    if (location.pathname === '/' || location.pathname === '') {
      e.preventDefault()
      const el = document.getElementById('pricing')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
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
    { label: 'Home', path: '/', exact: true },
    { label: 'Features', path: '/features' },
    { label: 'Integrations', path: '/product-integrations' },
    { label: 'Pricing', path: '/#pricing', isAnchor: true },
    { label: 'Documentation', path: '/docs' }
  ]

  const isLinkActive = (item) => {
    if (item.isAnchor) return location.hash === '#pricing'
    if (item.exact) return location.pathname === '/' && !location.hash
    return location.pathname.startsWith(item.path)
  }

  return (
    <>
      <nav className="landing-nav" role="navigation" aria-label="Main Navigation">
        <div className="nav-container">
          {/* Logo & Brand */}
          <Link to="/" className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <img 
              src={logo} 
              alt="Paper5 Logo" 
              style={{ width: '30px', height: '30px', objectFit: 'contain' }} 
            />
            <span style={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
              PAPER5
            </span>
          </Link>

          {/* Desktop Text Navigation */}
          <div className="nav-links desktop-only">
            {navLinks.map((item) => (
              item.isAnchor ? (
                <a
                  key={item.label}
                  href={item.path}
                  onClick={handlePricingClick}
                  className={`nav-link ${isLinkActive(item) ? "active" : ""}`}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.label}
                  to={item.path}
                  className={`nav-link ${isLinkActive(item) ? "active" : ""}`}
                >
                  {item.label}
                </Link>
              )
            ))}
          </div>

          {/* Right Action CTA Buttons */}
          <div className="nav-actions desktop-only">
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Link 
                  to="/workspace" 
                  className="btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13.5px', textDecoration: 'none' }}
                >
                  <span>Go to Workspace</span>
                  <ArrowRight size={14} />
                </Link>

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
                  className="btn-primary btn-sm"
                  onClick={handleGetStarted}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 18px', fontSize: '13.5px' }}
                >
                  <span>Get Started</span>
                  <ArrowRight size={14} />
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
            <Link 
              to="/" 
              onClick={() => setIsMobileMenuOpen(false)} 
              className={`mobile-drawer-link ${location.pathname === '/' && !location.hash ? 'active' : ''}`}
            >
              <span>Home</span>
            </Link>
            <Link 
              to="/features" 
              onClick={() => setIsMobileMenuOpen(false)} 
              className={`mobile-drawer-link ${location.pathname === '/features' ? 'active' : ''}`}
            >
              <span>Features</span>
            </Link>
            <Link 
              to="/product-integrations" 
              onClick={() => setIsMobileMenuOpen(false)} 
              className={`mobile-drawer-link ${location.pathname === '/product-integrations' ? 'active' : ''}`}
            >
              <span>Integrations</span>
            </Link>
            <a 
              href="/#pricing" 
              onClick={(e) => { 
                handlePricingClick(e); 
                setIsMobileMenuOpen(false); 
              }} 
              className={`mobile-drawer-link ${location.hash === '#pricing' ? 'active' : ''}`}
            >
              <span>Pricing</span>
            </a>
            <Link 
              to="/docs" 
              onClick={() => setIsMobileMenuOpen(false)} 
              className={`mobile-drawer-link ${location.pathname.startsWith('/docs') ? 'active' : ''}`}
            >
              <span>Documentation</span>
            </Link>
            <Link 
              to="/about" 
              onClick={() => setIsMobileMenuOpen(false)} 
              className={`mobile-drawer-link ${location.pathname === '/about' ? 'active' : ''}`}
            >
              <span>About Us</span>
            </Link>
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
                <Link 
                  to="/workspace" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="btn-primary w-full center-text" 
                  style={{ justifyContent: 'center', textDecoration: 'none', padding: '12px' }}
                >
                  Go to Workspace &rarr;
                </Link>
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
