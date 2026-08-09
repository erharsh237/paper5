import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MarketingLayout from '../components/MarketingLayout'
import SEOHead from '../components/SEOHead'
import './ProductIntegrationsPage.css'

export default function ProductIntegrationsPage() {
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState('all')

  const filterCategoryMap = {
    all: () => true,
    vcs: (id) => id === 'github',
    cicd: (id) => id === 'vercel' || id === 'api',
    chat: (id) => id === 'discord' || id === 'slack',
    calendar: (id) => id === 'google',
    api: (id) => id === 'api'
  }

  return (
    <MarketingLayout>
      <SEOHead 
        title="Stack Integrations & 1-Click API Webhook Studio | SprintOS™ by Paper5™" 
        description="Connect GitHub, Vercel, Discord, Slack, Google Calendar, and 1-Click REST API webhooks natively with SprintOS™ by Paper5™."
        canonicalUrl="https://paper5.co/product-integrations"
      />

      {/* Hero Header */}
      <section className="integrations-hero">
        <div className="integrations-badge">
          <span>🔌</span> SprintOS™ Ecosystem & Integration Hub
        </div>
        <h1 className="integrations-title">
          Connect Your Entire Developer Stack in Seconds.
        </h1>
        <p className="integrations-subtitle">
          Eliminate manual ticket updates. SprintOS™ connects natively with GitHub, Vercel, Discord, Slack, Google Calendar, and 1-Click REST API webhooks.
        </p>

        {/* Filter Pills */}
        <div className="integrations-filter-bar">
          <button className={`filter-pill ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')}>
            All Integrations (6)
          </button>
          <button className={`filter-pill ${activeFilter === 'vcs' ? 'active' : ''}`} onClick={() => setActiveFilter('vcs')}>
            Version Control (GitHub)
          </button>
          <button className={`filter-pill ${activeFilter === 'cicd' ? 'active' : ''}`} onClick={() => setActiveFilter('cicd')}>
            CI/CD & Deployments (Vercel)
          </button>
          <button className={`filter-pill ${activeFilter === 'chat' ? 'active' : ''}`} onClick={() => setActiveFilter('chat')}>
            Chat & Webhooks (Discord, Slack)
          </button>
          <button className={`filter-pill ${activeFilter === 'calendar' ? 'active' : ''}`} onClick={() => setActiveFilter('calendar')}>
            Calendar & Sync (Google)
          </button>
          <button className={`filter-pill ${activeFilter === 'api' ? 'active' : ''}`} onClick={() => setActiveFilter('api')}>
            1-Click API Studio
          </button>
        </div>
      </section>

      {/* Showcase Grid */}
      <div className="integrations-showcase-container">
        <div className="integrations-showcase-grid">

          {/* ⚡ 1-Click API Studio (Spans 12 Columns - Hero) */}
          {filterCategoryMap[activeFilter]('api') && (
            <div className="showcase-card card-api" style={{ gridColumn: 'span 12' }}>
              <div>
                <div className="card-header-row">
                  <div className="card-brand-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>⚡</div>
                  <span className="card-status-badge">1-Click Live Webhook Sync</span>
                </div>
                <h2 className="card-title">1-Click API Webhook & REST Sync Studio</h2>
                <p className="card-desc">
                  Trigger automated sprint task status updates, push proof of work, and fetch workspace velocity metrics from any external tool, script, or CI pipeline with a single API call.
                </p>
                <ul className="card-feature-list">
                  <li><strong>Live Secret Key Generation:</strong> Provision and rotate `sp_live_...` API keys instantly.</li>
                  <li><strong>Multi-Language Code Snippets:</strong> Battle-tested cURL, Node.js (Fetch API), and Python requests code samples.</li>
                  <li><strong>Interactive API Simulator:</strong> Execute live test requests in browser and view HTTP 200 OK latency timing.</li>
                  <li><strong>Agile Workflow Alignment:</strong> Sync tasks directly into methodology-aligned board columns (`Sprint Backlog ➔ In Progress ➔ QA ➔ Done`).</li>
                </ul>
              </div>
              <div>
                <button className="btn-primary" style={{ width: 'fit-content' }} onClick={() => navigate('/signup')}>
                  ⚡ Provision 1-Click API Key
                </button>
              </div>
            </div>
          )}

          {/* 🐙 GitHub Repository Sync (Spans 6 Columns) */}
          {filterCategoryMap[activeFilter]('github') && (
            <div className="showcase-card card-github" style={{ gridColumn: 'span 6' }}>
              <div>
                <div className="card-header-row">
                  <div className="card-brand-icon">🐙</div>
                  <span className="card-status-badge">Version Control</span>
                </div>
                <h2 className="card-title">GitHub Repository & PR Sync</h2>
                <p className="card-desc">
                  Automatically link GitHub commits, branches, and pull requests directly to your active sprint tasks.
                </p>
                <ul className="card-feature-list">
                  <li><strong>Auto-Close Tasks on PR Merge:</strong> Merging a PR automatically marks the corresponding sprint task as "Done".</li>
                  <li><strong>Commit Hash Binding:</strong> Trace every line of code directly back to the task proof of work.</li>
                  <li><strong>Private Token Encryption:</strong> Individual personal access tokens are encrypted per user.</li>
                </ul>
              </div>
            </div>
          )}

          {/* 🚀 Vercel Deployment Tracker (Spans 6 Columns) */}
          {filterCategoryMap[activeFilter]('vercel') && (
            <div className="showcase-card card-vercel" style={{ gridColumn: 'span 6' }}>
              <div>
                <div className="card-header-row">
                  <div className="card-brand-icon">🚀</div>
                  <span className="card-status-badge">CI/CD Deployments</span>
                </div>
                <h2 className="card-title">Vercel Deployment Tracker</h2>
                <p className="card-desc">
                  Track real-time build deployment states against your active sprint deadlines.
                </p>
                <ul className="card-feature-list">
                  <li><strong>Real-Time Build States:</strong> Monitor Building, Ready, and Error states live inside your dashboard.</li>
                  <li><strong>Deployment Velocity:</strong> Measure how fast code commits make it to production environments.</li>
                  <li><strong>Automatic Workspace Sync:</strong> Shared project ID configuration across team members.</li>
                </ul>
              </div>
            </div>
          )}

          {/* 💬 Discord Channel Alerts (Spans 4 Columns) */}
          {filterCategoryMap[activeFilter]('discord') && (
            <div className="showcase-card card-discord" style={{ gridColumn: 'span 4' }}>
              <div>
                <div className="card-header-row">
                  <div className="card-brand-icon">💬</div>
                  <span className="card-status-badge">Chat Webhook</span>
                </div>
                <h2 className="card-title">Discord Channel Alerts</h2>
                <p className="card-desc">
                  Broadcast real-time sprint updates, blocker alerts, and proof of work to designated Discord channels.
                </p>
                <ul className="card-feature-list">
                  <li>Instant sprint blocker notifications</li>
                  <li>Automated proof of work submissions</li>
                  <li>1-click webhook test trigger</li>
                </ul>
              </div>
            </div>
          )}

          {/* 📣 Slack Team Notifications (Spans 4 Columns) */}
          {filterCategoryMap[activeFilter]('slack') && (
            <div className="showcase-card card-slack" style={{ gridColumn: 'span 4' }}>
              <div>
                <div className="card-header-row">
                  <div className="card-brand-icon">📣</div>
                  <span className="card-status-badge">Team Notification</span>
                </div>
                <h2 className="card-title">Slack Channel Sync</h2>
                <p className="card-desc">
                  Keep your entire engineering team aligned with automated daily standup summaries and sprint progress DMs.
                </p>
                <ul className="card-feature-list">
                  <li>Daily standup summary broadcasts</li>
                  <li>Sprint lock expiration warnings</li>
                  <li>Custom webhook payload formatting</li>
                </ul>
              </div>
            </div>
          )}

          {/* 📅 Google Calendar Sync (Spans 4 Columns) */}
          {filterCategoryMap[activeFilter]('google') && (
            <div className="showcase-card card-google" style={{ gridColumn: 'span 4' }}>
              <div>
                <div className="card-header-row">
                  <div className="card-brand-icon">📅</div>
                  <span className="card-status-badge">Calendar Agenda</span>
                </div>
                <h2 className="card-title">Google Calendar Sync</h2>
                <p className="card-desc">
                  Sync upcoming meeting events and attach real-time notes directly to sprint meeting agendas.
                </p>
                <ul className="card-feature-list">
                  <li>Google Identity Services OAuth</li>
                  <li>Auto-synced meeting notes</li>
                  <li>Custom meeting note creation</li>
                </ul>
              </div>
            </div>
          )}

        </div>

        {/* 3-Step Setup Section */}
        <section className="integration-steps-section">
          <div style={{ textTransform: 'uppercase', fontSize: '12px', fontWeight: 800, color: '#10b981', letterSpacing: '0.08em', marginBottom: '8px' }}>
            Simple Integration Setup
          </div>
          <h2 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 10px 0', color: 'var(--text-primary)' }}>
            Up and Running in Under 2 Minutes.
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', margin: 0 }}>
            Connecting tools to SprintOS™ requires zero complex server setup.
          </p>

          <div className="steps-grid">
            <div className="step-card">
              <span className="step-number">Step 01</span>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
                🔑 Provision Key or OAuth
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Generate a 1-Click API secret key or connect your personal access token in Settings ➔ Integrations.
              </p>
            </div>

            <div className="step-card">
              <span className="step-number">Step 02</span>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
                🎯 Target Repository or Webhook
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Paste your GitHub repo owner, Slack/Discord webhook URL, or Vercel project ID into the shared workspace config.
              </p>
            </div>

            <div className="step-card">
              <span className="step-number">Step 03</span>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
                ⚡ Automated Real-Time Sync
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Test your connection instantly. Code commits, PR merges, and webhook triggers sync automatically across your sprint board.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Footer Box */}
        <div style={{ marginTop: '60px', padding: '48px', borderRadius: '20px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, var(--bg-panel) 100%)', border: '1px solid rgba(16, 185, 129, 0.3)', textAlign: 'center' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>
            Ready to Connect Your Stack?
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)', margin: '0 0 28px 0' }}>
            Start shipping faster with native integrations and 1-Click API Webhook automation.
          </p>
          <button className="btn-primary" style={{ padding: '12px 28px', fontSize: '15px' }} onClick={() => navigate('/signup')}>
            🚀 Launch Free Workspace
          </button>
        </div>
      </div>
    </MarketingLayout>
  )
}
