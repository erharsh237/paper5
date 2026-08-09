import React from 'react'
import { useNavigate } from 'react-router-dom'
import MarketingLayout from '../components/MarketingLayout'
import SEOHead from '../components/SEOHead'
import { ShieldCheck, Zap, Code2, LineChart, Layers, Database, Lock } from 'lucide-react'
import './AboutUs.css'

export default function AboutUs() {
  const navigate = useNavigate()

  return (
    <MarketingLayout>
      <SEOHead 
        title="About Us & Company Mission | SprintOS™ by Paper5™" 
        description="Learn about Paper5™ and our mission to build SprintOS™: the zero-friction operating system for high-velocity software engineering teams."
        canonicalUrl="https://paper5.co/about"
      />

      {/* Hero Header */}
      <section className="about-hero">
        <h1 className="about-title">
          Building the Operating System for Modern Engineering Teams.
        </h1>
        <p className="about-subtitle">
          Paper5™ was founded on a simple principle: developer productivity tools should accelerate execution, not create administrative overhead. SprintOS™ is the antidote to bloated, slow issue trackers.
        </p>
      </section>

      {/* Key Metrics Counter Strip */}
      <div className="about-metrics-strip">
        <div className="metric-card">
          <div className="metric-val">8-Tier</div>
          <div className="metric-label">Agile Workflows</div>
        </div>
        <div className="metric-card">
          <div className="metric-val">94%</div>
          <div className="metric-label">Velocity Accuracy</div>
        </div>
        <div className="metric-card">
          <div className="metric-val">100%</div>
          <div className="metric-label">PDF Data Ownership</div>
        </div>
        <div className="metric-card">
          <div className="metric-val">38ms</div>
          <div className="metric-label">Live API Latency</div>
        </div>
      </div>

      <div className="about-container">
        {/* Mission Section */}
        <section className="about-section">
          <h2 className="about-section-title">Our Mission</h2>
          <p className="about-section-text">
            To accelerate software progress by giving engineering teams the operational clarity they need to ship code flawlessly. We design tools that require zero maintenance, zero training, and provide immediate value.
          </p>

          <div className="pillars-grid">
            <div className="pillar-item">
              <div className="pillar-icon"><Zap size={22} /></div>
              <h3 className="pillar-title">Engineered for Focus</h3>
              <p className="pillar-desc">
                We build interfaces to be invisible. If you spend more time updating tickets than writing software, the tool has failed. SprintOS™ automates task transitions on PR merges and deadline expirations.
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
              <h3 className="pillar-title">Developer Automation First</h3>
              <p className="pillar-desc">
                Connect GitHub, Vercel, Discord, Slack, and custom webhooks seamlessly with 1-Click REST API keys (`sp_live_...`) and multi-language code SDKs.
              </p>
            </div>

            <div className="pillar-item">
              <div className="pillar-icon"><LineChart size={22} /></div>
              <h3 className="pillar-title">Predictive Sprint Intelligence</h3>
              <p className="pillar-desc">
                Historical velocity models predict whether your team will hit sprint deadlines with 94% accuracy, alerting managers to potential risks before they cause delays.
              </p>
            </div>
          </div>
        </section>

        {/* Product Architecture & Standards */}
        <section className="about-section">
          <h2 className="about-section-title">Product Evolution & Standards</h2>
          <p className="about-section-text">
            SprintOS™ is built on top of enterprise-grade cloud architecture with cryptographically isolated workspace data layers.
          </p>

          <div className="timeline-list">
            <div className="timeline-item">
              <span className="timeline-badge">SprintOS 1.0</span>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  8-Tier Agile Methodology Engine & Board Alignment
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Introduced team-size adaptive workflows from 1 Solo Developer up to 500+ SAFe Enterprise tribes.
                </p>
              </div>
            </div>

            <div className="timeline-item">
              <span className="timeline-badge">Live Webhooks</span>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  GitHub Auto-Close & Chat Notifications
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Real-time synchronization between git commits, pull requests, Slack standups, and Discord blocker alerts.
                </p>
              </div>
            </div>

            <div className="timeline-item">
              <span className="timeline-badge">API & PDF Studio</span>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  1-Click REST API Studio & Vector PDF Data Export
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Interactive API simulator, cURL/Node/Python code snippets, and selective printable PDF workspace reports.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Security Commitment */}
        <section className="about-section" style={{ textAlign: 'center', background: '#ffffff' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', background: '#000000', color: '#ffffff', marginBottom: '16px' }}>
            <ShieldCheck size={26} />
          </div>
          <h2 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>
            Enterprise Security & Compliance
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', maxWidth: '680px', margin: '0 auto 24px auto', lineHeight: 1.6 }}>
            Security is built into the foundation of SprintOS™. Powered by SOC2 Type II certified infrastructure with native GDPR and DPDP compliance, enforced email verification, and role-based access control (RBAC).
          </p>
          <button className="btn-primary" style={{ padding: '10px 24px' }} onClick={() => navigate('/signup')}>
            🚀 Start Free Workspace
          </button>
        </section>
      </div>
    </MarketingLayout>
  )
}
