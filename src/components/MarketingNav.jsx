import { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import ContactModal from './ContactModal'
import { MenuBar } from './ui/bottom-menu'
import { Home, Star, Blocks, Book, Info, Mail } from 'lucide-react'
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

  const baseItems = [
    { icon: Home, label: "Home", path: '/', action: () => navigate('/') },
    { icon: Star, label: "Features", path: '/features', action: () => navigate('/features') },
    { icon: Blocks, label: "Integrations", path: '/product-integrations', action: () => navigate('/product-integrations') },
    { icon: Book, label: "Docs", path: '/docs', action: () => navigate('/docs') },
    { icon: Info, label: "About", path: '/about', action: () => navigate('/about') },
    { icon: Mail, label: "Contact", path: null, action: () => setIsContactOpen(true) },
  ].map(item => ({
    ...item,
    isActive: item.path ? (item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)) : false
  }))

  return (
    <>
    <nav className="landing-nav">
      <div className="nav-container">
        <div className="nav-logo" style={{ display: 'flex', alignItems: 'center', cursor: 'default' }}>
          <img src={logo} alt="Paper5 Logo" style={{ width: '32px', height: '32px', marginRight: '8px', objectFit: 'contain' }} />
          <span style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>PAPER5</span>
        </div>
        <div className="nav-links-wrapper">
          <MenuBar items={baseItems} />
        </div>
        <div className="nav-actions">
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ position: 'relative' }}>
                  <div 
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px', cursor: 'pointer', padding: '4px', borderRadius: '50%', transition: 'background 0.2s' }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-layer-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {(user.displayName || user.email || 'U')[0].toUpperCase()}
                    </div>
                  </div>
                  
                  {showProfileMenu && (
                    <>
                      <div 
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} 
                        onClick={() => setShowProfileMenu(false)}
                      />
                      <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '12px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '12px', padding: '8px', minWidth: '180px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)', zIndex: 100 }}>
                        <button 
                          onClick={() => {
                            setShowProfileMenu(false)
                            logout()
                          }}
                          style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent', border: 'none', color: 'var(--accent-critical)', fontSize: '14px', fontWeight: 500, cursor: 'pointer', borderRadius: '6px', transition: 'background 0.2s' }}
                          onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        >
                          Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <>
                <button className="btn-primary" onClick={handleSignIn}>Sign In</button>
              </>
            )}
          </div>
          <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
    </nav>

    <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />

    {isMobileMenuOpen && (
      <div className="mobile-drawer" style={{ paddingTop: '100px' }}>
        <div className="mobile-drawer-links">
          <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="mobile-drawer-link">
            <span>Home</span>
          </Link>
          <Link to="/features" onClick={() => setIsMobileMenuOpen(false)} className="mobile-drawer-link">
            <span>Features</span>
          </Link>
          <Link to="/product-integrations" onClick={() => setIsMobileMenuOpen(false)} className="mobile-drawer-link">
            <span>Integrations</span>
          </Link>
          <Link to="/docs" onClick={() => setIsMobileMenuOpen(false)} className="mobile-drawer-link">
            <span>Docs</span>
          </Link>
          <Link to="/about" onClick={() => setIsMobileMenuOpen(false)} className="mobile-drawer-link">
            <span>About</span>
          </Link>
          <a className="mobile-drawer-link" onClick={() => { setIsContactOpen(true); setIsMobileMenuOpen(false) }}>
            <span>Contact</span>
          </a>
        </div>
        <div className="mobile-drawer-footer">
          {user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-layer-2)', borderRadius: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-layer)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{user.displayName || user.email}</span>
              </div>
              <button className="btn-secondary w-full center-text" style={{ justifyContent: 'center', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)' }} onClick={() => { logout(); setIsMobileMenuOpen(false); }}>Sign out</button>
            </div>
          ) : (
            <>
              <button className="btn-primary w-full center-text" style={{ justifyContent: 'center' }} onClick={handleSignIn}>Sign In</button>
            </>
          )}
        </div>
      </div>
    )}
    </>
  )
}
