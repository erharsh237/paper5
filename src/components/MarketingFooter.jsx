import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ContactModal from './ContactModal'
import FeedbackModal from './FeedbackModal'
import logo from '../assets/logo.png'
import '../pages/Landing.css'
import { getAppUrl } from '../lib/domain'
import { ArrowRight, MessageSquare } from 'lucide-react'

export default function MarketingFooter({ hideCTA = false }) {
  const [isContactOpen, setIsContactOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const navigate = useNavigate()

  const handleGetStarted = () => {
    const target = getAppUrl('/signup')
    if (target.startsWith('http')) {
      window.location.href = target
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
          <Link to="/" className="landing-brand" style={{ display: 'flex', alignItems: 'center', marginBottom: '14px', textDecoration: 'none' }}>
            <img src={logo} alt="Paper5 Logo" style={{ width: '32px', height: '32px', marginRight: '10px', objectFit: 'contain' }} />
            <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>PAPER5</span>
          </Link>
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
            <Link to="/features">Features</Link>
            <a href="/#pricing">Pricing</a>
            <Link to="/product-integrations">Integrations</Link>
            <Link to="/changelog">Changelog</Link>
          </div>
          <div className="footer-column">
            <h3>Resources</h3>
            <Link to="/docs">Documentation</Link>
            <Link to="/docs/api">API Reference</Link>
          </div>
          <div className="footer-column">
            <h3>Company</h3>
            <Link to="/about">About Us</Link>
            <button className="text-link-btn" onClick={() => setIsFeedbackOpen(true)}>Give Feedback</button>
            <button className="text-link-btn" onClick={() => setIsContactOpen(true)}>Contact Support</button>
          </div>
          <div className="footer-column">
            <h3>Legal</h3>
            <Link to="/legal/terms">Terms of Service</Link>
            <Link to="/legal/privacy">Privacy Policy</Link>
            <Link to="/security">Security & Data</Link>
          </div>
        </div>
      </div>
      
      <div className="footer-bottom">
        <div className="footer-bottom-content">
          <span>&copy; {new Date().getFullYear()} Paper5™. The connected project workspace. All rights reserved.</span>
        </div>
      </div>
      
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </footer>
  )
}
