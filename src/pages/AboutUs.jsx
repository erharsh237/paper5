import React from 'react'
import { useNavigate } from 'react-router-dom'
import MarketingLayout from '../components/MarketingLayout'
import SEOHead from '../components/SEOHead'
import { ShieldCheck, Zap, Code2, LineChart, Lock } from 'lucide-react'
import './AboutUs.css'

export default function AboutUs() {
  const navigate = useNavigate()

  return (
    <MarketingLayout>
      <SEOHead 
        title="About Us & Company Mission | Paper5" 
        description="Learn about Paper5 and our mission: the zero-friction project management and team accountability workspace for small teams and startups."
        canonicalUrl="https://paper5.co/about"
      />

      {/* Hero Header */}
      <section className="about-hero">
        <h1 className="about-title">
          Building the Operating System for Modern Teams.
        </h1>
        <p className="about-subtitle">
          Paper5 was founded on a simple principle: developer productivity tools should accelerate execution, not create administrative overhead. Paper5 gives small teams one place to see everything happening across their projects, understand responsibilities, track progress, and stay accountable.
        </p>
      </section>

      {/* Key Metrics Counter Strip */}
      <div className="about-metrics-strip">
        <div className="metric-card">
          <div className="metric-val">100%</div>
          <div className="metric-label">Ownership Clarity</div>
        </div>
        <div className="metric-card">
          <div className="metric-val">3–10</div>
          <div className="metric-label">Optimized Team Size</div>
        </div>
        <div className="metric-card">
          <div className="metric-val">100%</div>
          <div className="metric-label">Data Portability</div>
        </div>
        <div className="metric-card">
          <div className="metric-val">&lt; 50ms</div>
          <div className="metric-label">Live API & Sync Latency</div>
        </div>
      </div>

      <div className="about-container">
        {/* Mission Section */}
        <section className="about-section">
          <h2 className="about-section-title">Our Mission</h2>
          <p className="about-section-text">
            To accelerate software progress by giving small engineering teams the operational clarity they need to ship work flawlessly. We design tools that require zero maintenance, zero administrative drag, and provide immediate value.
          </p>

          <div className="pillars-grid">
            <div className="pillar-item">
              <div className="pillar-icon"><Zap size={22} /></div>
              <h3 className="pillar-title">Engineered for Focus</h3>
              <p className="pillar-desc">
                We build interfaces to be invisible. If your team spends more time updating tickets than shipping features, the tool has failed. Paper5 automates task transitions and status visibility seamlessly.
              </p>
            </div>

            <div className="pillar-item">
              <div className="pillar-icon"><Lock size={22} /></div>
              <h3 className="pillar-title">Complete Data Ownership</h3>
              <p className="pillar-desc">
                Your data belongs to you. Export complete, printable vector PDF documents or CSV compliance audit logs for any workspace you manage with a single click.
              </p>
            </div>

            <div className="pillar-item">
              <div className="pillar-icon"><Code2 size={22} /></div>
              <h3 className="pillar-title">Developer Workflow First</h3>
              <p className="pillar-desc">
                Connect GitHub, Slack, Discord, Google Calendar, and custom webhooks effortlessly with 1-Click REST API keys and automated git synchronization.
              </p>
            </div>

            <div className="pillar-item">
              <div className="pillar-icon"><LineChart size={22} /></div>
              <h3 className="pillar-title">Accountability & Visibility</h3>
              <p className="pillar-desc">
                Single-owner task assignment, automated status rollups, and live deadline alerts give small teams complete visibility without endless status sync meetings.
              </p>
            </div>
          </div>
        </section>

        {/* Product Evolution & Standards */}
        <section className="about-section">
          <h2 className="about-section-title">Product Evolution & Standards</h2>
          <p className="about-section-text">
            Paper5 is engineered on top of enterprise-grade cloud architecture with cryptographically isolated workspace data layers.
          </p>

          <div className="timeline-list">
            <div className="timeline-item">
              <span className="timeline-badge">Paper5 Core</span>
              <div>
                <h4 className="timeline-heading">
                  High-Velocity Sprint Engine & Board Alignment
                </h4>
                <p className="timeline-desc">
                  Focused sprint cycles, single-owner task accountability, and live progress indicators tailored for fast-moving startups.
                </p>
              </div>
            </div>

            <div className="timeline-item">
              <span className="timeline-badge">Live Webhooks</span>
              <div>
                <h4 className="timeline-heading">
                  GitHub Auto-Close & Chat Notifications
                </h4>
                <p className="timeline-desc">
                  Real-time synchronization between git commits, pull requests, Slack updates, and Discord blocker alerts.
                </p>
              </div>
            </div>

            <div className="timeline-item">
              <span className="timeline-badge">API & PDF Studio</span>
              <div>
                <h4 className="timeline-heading">
                  1-Click REST API Studio & Vector PDF Data Export
                </h4>
                <p className="timeline-desc">
                  Interactive API simulator, cURL/Node/Python code snippets, and selective printable PDF workspace reports.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Security Commitment */}
        <section className="about-section about-security-section">
          <div className="security-icon-box">
            <ShieldCheck size={26} />
          </div>
          <h2 className="security-title">
            Enterprise Security & Compliance
          </h2>
          <p className="security-desc">
            Security is built into the foundation of Paper5. Powered by TLS 1.3 transit encryption, AES-256 data protection at rest, strict PostgreSQL Row-Level Security (RLS) tenant isolation, enforced email verification, and optional Multi-Factor Authentication (2FA).
          </p>
          <button className="btn-primary" style={{ padding: '12px 28px', fontSize: '15px' }} onClick={() => navigate('/signup')}>
            Start Free Workspace
          </button>
        </section>
      </div>
    </MarketingLayout>
  )
}
