import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ContactModal from './ContactModal'
import FeedbackModal from './FeedbackModal'
import logo from '../assets/logo.png'
import '../pages/Landing.css'
import { getDomainConfig, getAppUrl, getMainUrl } from '../lib/domain'
import { safeRedirect } from '../lib/safeRedirect'
import { ArrowRight, MessageSquare } from 'lucide-react'

export default function MarketingFooter({ hideCTA = false }) {
  const [isContactOpen, setIsContactOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const navigate = useNavigate()
  const { isAppSubdomain } = getDomainConfig()

  const FooterLink = ({ to, children }) => {
    if (isAppSubdomain) return <a href={getMainUrl(to)}>{children}</a>
    return <Link to={to}>{children}</Link>
  }

  const handleGetStarted = () => {
    const target = getAppUrl('/signup')
    if (target.startsWith('http')) {
      safeRedirect(target)
    } else {
      navigate(target)
    }
  }

  return (
    <footer className="landing-footer">
      {!hideCTA && (
        <div className="footer-cta-banner">
          <div className="footer-cta-container">
            <h2>Give your team one place to move forward.</h2>
            <p>
              Organise your projects, bring your information together and spend less time chasing updates.
            </p>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button 
                className="btn-primary btn-lg" 
                onClick={handleGetStarted}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <span>Start Your Free Workspace</span>
                <ArrowRight size={16} />
              </button>
              <button 
                className="btn-ghost btn-lg" 
                onClick={() => setIsFeedbackOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <MessageSquare size={16} />
                <span>Give Feedback</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="footer-content">
        <div className="footer-brand-col">
          {isAppSubdomain ? (
            <a href={getMainUrl('/')} className="landing-brand" style={{ display: 'flex', alignItems: 'center', marginBottom: '14px', textDecoration: 'none' }}>
              <img src={logo} alt="Paper5 Logo" style={{ width: '32px', height: '32px', marginRight: '10px', objectFit: 'contain' }} />
              <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>PAPER5</span>
            </a>
          ) : (
            <Link to="/" className="landing-brand" style={{ display: 'flex', alignItems: 'center', marginBottom: '14px', textDecoration: 'none' }}>
              <img src={logo} alt="Paper5 Logo" style={{ width: '32px', height: '32px', marginRight: '10px', objectFit: 'contain' }} />
              <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>PAPER5</span>
            </Link>
          )}

          <p className="footer-tagline">
            The operating workspace for small teams and startups. Connect your projects, tasks, documents and development in one place.
          </p>
          <div className="footer-socials">
            <a href="https://x.com/paper5hq" target="_blank" rel="noreferrer" aria-label="X (formerly Twitter)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
          </div>
        </div>
        
        <div className="footer-links-grid">
          <div className="footer-column">
            <h3>Product</h3>
            <FooterLink to="/features">Features</FooterLink>
            <a href={isAppSubdomain ? getMainUrl('/#pricing') : '/#pricing'}>Pricing</a>
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
            <a href="/about">About</a>
            <a href="/contact" onClick={(e) => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); setIsContactOpen(true); } }}>Contact</a>
            <button className="text-link-btn" onClick={() => setIsFeedbackOpen(true)}>Give Feedback</button>
            <button className="text-link-btn" onClick={() => setIsContactOpen(true)}>Contact Support</button>
          </div>
          <div className="footer-column">
            <h3>Legal</h3>
            <FooterLink to="/legal/terms">Terms of Service</FooterLink>
            <a href="/privacy">Privacy Policy</a>
            <FooterLink to="/security">Security & Data</FooterLink>
          </div>
        </div>
      </div>
      
      <div className="footer-bottom">
        <div className="footer-bottom-content">
          <div className="footer-bottom-links">
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
            <a href="/privacy">Privacy Policy</a>
          </div>
          <span>&copy; {new Date().getFullYear()} Paper5™. The connected project workspace. All rights reserved.</span>
        </div>
      </div>
      
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </footer>
  )
}
