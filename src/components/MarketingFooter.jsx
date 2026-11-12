import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import ContactModal from './ContactModal'
import FeedbackModal from './FeedbackModal'
import Paper5Logo from './Paper5Logo'
import '../pages/Landing.css'
import { getDomainConfig, getAppUrl, getMainUrl } from '../lib/domain'
import { openConsentPreferences } from '../lib/privacyPrefs'
import { ArrowRight, MessageSquare } from 'lucide-react'

export default function MarketingFooter({ hideCTA = false }) {
  const [isContactOpen, setIsContactOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const location = useLocation()
  const { isAppSubdomain } = getDomainConfig()
  const isHomePage = !isAppSubdomain && (location.pathname === '/' || location.pathname === '')

  const FooterLink = ({ to, children }) => {
    if (isAppSubdomain) return <a href={getMainUrl(to)}>{children}</a>
    return <Link to={to}>{children}</Link>
  }

  const handleGetStarted = () => {
    window.open(getAppUrl('/signup'), '_blank', 'noopener,noreferrer')
  }

  return (
    <footer className="landing-footer">
      {!hideCTA && (
        <div className="footer-cta-banner">
          <div className="footer-cta-container">
            <h2>Bring Clarity to the Way Your Team Works.</h2>
            <p>
              Give your team one place to organize work, own responsibilities, and move projects forward.
            </p>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button 
                className="btn-primary btn-lg" 
                onClick={handleGetStarted}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <span>Get Started with Paper5</span>
                <ArrowRight size={16} />
              </button>
              <button 
                className="btn-ghost btn-lg" 
                onClick={() => setIsContactOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <MessageSquare size={16} />
                <span>Contact Team</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="footer-content">
        <div className="footer-brand-col">
          {isAppSubdomain ? (
            <a href={getMainUrl('/')} className="landing-brand" style={{ display: 'flex', alignItems: 'center', marginBottom: '14px', textDecoration: 'none' }}>
              <Paper5Logo size={30} style={{ marginRight: '10px' }} decorative />
              <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>PAPER5</span>
            </a>
          ) : (
            <Link to="/" className="landing-brand" style={{ display: 'flex', alignItems: 'center', marginBottom: '14px', textDecoration: 'none' }}>
              <Paper5Logo size={30} style={{ marginRight: '10px' }} decorative />
              <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>PAPER5</span>
            </Link>
          )}

          <p className="footer-tagline">
            The operating workspace for small teams and startups. Connect your projects, tasks, documents and development in one place.
          </p>
          <div className="footer-socials">
            <a href="https://x.com/paper5hq" target="_blank" rel="noreferrer" aria-label="X (formerly Twitter)">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
          </div>
        </div>
        
        <div className="footer-links-grid">
          <div className="footer-column">
            <h3>Product</h3>
            <FooterLink to="/features">Features</FooterLink>
            <FooterLink to="/pricing">Pricing</FooterLink>
            <FooterLink to="/product-integrations">Integrations</FooterLink>
            <FooterLink to="/changelog">Changelog</FooterLink>
          </div>
          <div className="footer-column">
            <h3>Resources</h3>
            <FooterLink to="/docs">Documentation</FooterLink>
            <FooterLink to="/docs/api">API Reference</FooterLink>
          </div>
          <div className="footer-column">
            <h3>Company</h3>
            <FooterLink to="/about">About</FooterLink>
            <FooterLink to="/contact">Contact</FooterLink>
            {isHomePage && (
              <button className="text-link-btn" onClick={() => setIsFeedbackOpen(true)}>Give Feedback</button>
            )}
            <button className="text-link-btn" onClick={() => setIsContactOpen(true)}>Contact Support</button>
          </div>
          <div className="footer-column">
            <h3>Legal</h3>
            <FooterLink to="/legal/terms">Terms of Service</FooterLink>
            <FooterLink to="/privacy">Privacy Policy</FooterLink>
            <FooterLink to="/security">Security &amp; Data</FooterLink>
            <button type="button" className="text-link-btn" onClick={openConsentPreferences}>Cookie Preferences</button>
          </div>
        </div>
      </div>
      
      <div className="footer-bottom">
        <div className="footer-bottom-content">
          <div className="footer-bottom-links">
            <FooterLink to="/about">About</FooterLink>
            <FooterLink to="/contact">Contact</FooterLink>
            <FooterLink to="/privacy">Privacy Policy</FooterLink>
          </div>
          <span>&copy; {new Date().getFullYear()} Paper5™. The connected project workspace. All rights reserved.</span>
        </div>
      </div>
      
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
      {isHomePage && (
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      )}
    </footer>
  )
}
