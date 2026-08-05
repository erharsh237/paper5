import React from 'react'
import MarketingLayout from '../components/MarketingLayout'
import SEOHead from '../components/SEOHead'

export default function AboutUs() {
  return (
    <MarketingLayout>
      <SEOHead 
        title="About Us & Company Mission | Paper5" 
        description="Paper5 builds software developer productivity tools designed for speed, focus, and security. Learn about our mission and engineering values."
        canonicalUrl="https://paper5.com/about"
      />
      <div style={{ padding: '120px 48px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--display)', fontSize: '56px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '24px', letterSpacing: '-0.04em' }}>
          We believe software should stay out of your way.
        </h1>
        <p style={{ fontSize: '20px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '64px' }}>
          Paper5 was born out of frustration. We were tired of spending more time managing our project management tools than actually writing code. So we built the antidote.
        </p>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 48px 120px 48px' }}>
        <div className="glass-panel" style={{ padding: '64px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: '32px', color: 'var(--text-primary)' }}>Our Mission</h2>
          <p style={{ fontSize: '18px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            To accelerate human progress by giving builders the operational clarity they need to execute flawlessly. We build tools that require zero maintenance, zero training, and provide immediate value.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginTop: '32px' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--display)', fontSize: '20px', color: 'var(--text-primary)', marginBottom: '12px' }}>Engineered for Focus</h3>
              <p style={{ color: 'var(--text-tertiary)', lineHeight: 1.6 }}>We design our interfaces to be invisible. If you have to think about how to use Paper5, we have failed our design mandate.</p>
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--display)', fontSize: '20px', color: 'var(--text-primary)', marginBottom: '12px' }}>Security as a Default</h3>
              <p style={{ color: 'var(--text-tertiary)', lineHeight: 1.6 }}>We don't believe in charging extra for basic security features like SSO and 2FA. Security is a right, not a premium feature.</p>
            </div>
          </div>
        </div>
      </div>
    </MarketingLayout>
  )
}
