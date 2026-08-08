import { useState } from 'react'
import ContactModal from './ContactModal'
import FeedbackModal from './FeedbackModal'
import logo from '../assets/logo.png'
import '../pages/Landing.css'

export default function MarketingFooter({ hideCTA = false }) {
  const [isContactOpen, setIsContactOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)

  return (
    <footer className="landing-footer">
      {!hideCTA && (
        <div className="footer-cta-banner">
          <h2>Have feedback or suggestions?</h2>
          <p>Help us build the future of SprintOS. We'd love to hear your thoughts and ideas.</p>
          <button className="btn-primary btn-lg" onClick={() => setIsFeedbackOpen(true)}>Give Feedback</button>
        </div>
      )}

      <div className="footer-content">
        <div className="footer-brand-col">
          <div className="landing-brand" style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <img src={logo} alt="Paper5 Logo" style={{ width: '36px', height: '36px', marginRight: '8px', objectFit: 'contain' }} />
            PAPER5
          </div>
          <p className="footer-tagline">
            Everything on paper. Nothing on trust.
          </p>
          <div className="footer-socials">
            <a href="https://x.com/paper5hq" target="_blank" rel="noreferrer" aria-label="X (formerly Twitter)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="#" aria-label="GitHub">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
            </a>
          </div>
        </div>
        
        <div className="footer-links-grid">
          <div className="footer-column">
            <h3>Product</h3>
            <a href="/#pricing">Pricing</a>
            <a href="/features">Features</a>
            <a href="/product-integrations">Integrations</a>
            <a href="/changelog">Changelog</a>
          </div>
          <div className="footer-column">
            <h3>Resources</h3>
            <a href="/docs">Documentation</a>
            <a href="/docs/api">API Reference</a>
          </div>
          <div className="footer-column">
            <h3>Company</h3>
            <a href="/about">About Us</a>
            <button className="text-link-btn" onClick={() => setIsFeedbackOpen(true)}>Give Feedback</button>
            <button className="text-link-btn" onClick={() => setIsContactOpen(true)}>Contact Sales</button>
          </div>
          <div className="footer-column">
            <h3>Legal</h3>
            <a href="/legal/terms">Terms of Service</a>
            <a href="/legal/privacy">Privacy Policy</a>
            <a href="/legal/dpa">Data Processing Agreement</a>
            <a href="/security">Security</a>
          </div>
        </div>
      </div>
      
      <div className="footer-bottom">
        <div className="footer-bottom-content">
          <span>&copy; {new Date().getFullYear()} Paper5™. SprintOS™ is a trademark of Paper5. All rights reserved.</span>
          <div className="footer-status">
            <span className="status-dot"></span> All systems normal
          </div>
        </div>
      </div>
      
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </footer>
  )
}
