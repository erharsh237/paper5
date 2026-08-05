import React from 'react'
import MarketingLayout from '../components/MarketingLayout'
import SEOHead from '../components/SEOHead'

export default function Features() {
  return (
    <MarketingLayout>
      <SEOHead 
        title="Features & Capabilities | SprintOS by Paper5" 
        description="Discover automated sprint rollovers, GitHub sync, Slack standups, and velocity prediction models built for high-velocity engineering teams."
        canonicalUrl="https://paper5.com/features"
      />
      <div style={{ padding: '120px 48px', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
        <div className="status-badge" style={{ margin: '0 auto 32px auto' }}>
          <span className="pulse-dot"></span> Shipped
        </div>
        <h1 style={{ fontFamily: 'var(--display)', fontSize: '56px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '24px', letterSpacing: '-0.04em' }}>
          Features built for speed.
        </h1>
        <p style={{ fontSize: '20px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '64px' }}>
          We stripped out everything that slows you down and perfected the tools that keep your team shipping. No bloated issue tracking—just precision deadlines.
        </p>
      </div>

      <div className="features-section">
        <div className="bento-grid">
          <div className="bento-card col-span-2">
            <h3>Automated Sprint Rollovers</h3>
            <p>Unfinished tasks automatically roll over to the next sprint. No more manual ticket dragging at midnight on a Sunday.</p>
          </div>
          <div className="bento-card">
            <h3>GitHub Sync</h3>
            <p>Close a PR, close a task. Paper5 reads your repository activity and updates your sprint board automatically.</p>
          </div>
          <div className="bento-card">
            <h3>Slack Standups</h3>
            <p>Paper5 DMs your team every morning to collect blockers, then broadcasts a clean summary to your channel.</p>
          </div>
          <div className="bento-card col-span-2">
            <h3>Velocity Prediction Model</h3>
            <p>Using historical sprint data, Paper5 predicts whether you'll hit your deadline with 94% accuracy, alerting you to risks before they happen.</p>
          </div>
        </div>
      </div>
    </MarketingLayout>
  )
}
