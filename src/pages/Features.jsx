import React from 'react'
import { useNavigate } from 'react-router-dom'
import MarketingLayout from '../components/MarketingLayout'
import SEOHead from '../components/SEOHead'
import { WORKFLOWS } from '../lib/workflows'
import './Features.css'

export default function Features() {
  const navigate = useNavigate()

  return (
    <MarketingLayout>
      <SEOHead 
        title="Features Suite & Engineering Capabilities | SprintOS™ by Paper5™" 
        description="Explore SprintOS™ features: 8-tier Agile workflows, 1-Click API Webhook Studio, GitHub & Vercel live stack integrations, and PDF workspace data ownership."
        canonicalUrl="https://paper5.co/features"
      />

      {/* Hero Header */}
      <section className="features-hero">
        <div className="features-badge">
          <span>⚡</span> SprintOS™ 1.0 Complete Feature Suite
        </div>
        <h1 className="features-title">
          Architected for High-Velocity Engineering Teams.
        </h1>
        <p className="features-subtitle">
          Eliminate administrative friction. SprintOS™ unites 8-tier Agile methodologies, 1-Click API automation, live stack integrations, and PDF data ownership in a single platform.
        </p>
        <div className="features-hero-actions">
          <button className="btn-primary" style={{ padding: '12px 24px', fontSize: '15px' }} onClick={() => navigate('/signup')}>
            🚀 Start Free Workspace
          </button>
          <button className="btn-ghost" style={{ padding: '12px 24px', fontSize: '15px' }} onClick={() => navigate('/product-integrations')}>
            ⚡ Explore 1-Click API Studio
          </button>
        </div>
      </section>

      <div className="features-container">
        {/* Category 1: 8-Tier Agile Workflows */}
        <section className="feature-category">
          <div className="feature-category-header">
            <span className="feature-category-tag">Methodology Engine</span>
            <h2 className="feature-category-title">⚡ 8-Tier Agile Workflow Alignment</h2>
            <p className="feature-category-desc">
              Every team grows differently. SprintOS™ dynamically aligns your board workflow based on team size—from solo founders up to 500+ developer enterprise tribes.
            </p>
          </div>

          <div className="workflows-grid">
            {WORKFLOWS.map((wf) => (
              <div key={wf.id} className="workflow-pill-card">
                <span className="workflow-num">Workflow {wf.num}</span>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                  {wf.name}
                </h3>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', marginBottom: '8px' }}>
                  {wf.teamSizeLabel}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4, margin: '0 0 12px 0' }}>
                  {wf.description}
                </p>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                  Board Columns: {wf.columns.map(c => c.title).join(' ➔ ')}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Category 2: 1-Click API Studio */}
        <section className="feature-category">
          <div className="feature-category-header">
            <span className="feature-category-tag">Developer Automation</span>
            <h2 className="feature-category-title">🛠️ 1-Click API Webhook & REST Sync Studio</h2>
            <p className="feature-category-desc">
              Connect custom webhooks, CI/CD scripts, and developer tools in a single click. Trigger automated task transitions and query velocity metrics in real time.
            </p>
          </div>

          <div className="features-bento-grid">
            <div className="feature-card bento-tile-6">
              <div>
                <div className="feature-card-icon">🔑</div>
                <h3 className="feature-card-title">1-Click Live API Keys</h3>
                <p className="feature-card-desc">
                  Provision secret API keys instantly with one click (`sp_live_...`). Show, hide, or rotate keys anytime from your workspace integrations dashboard.
                </p>
              </div>
              <span className="feature-card-badge">REST API & Webhooks</span>
            </div>

            <div className="feature-card bento-tile-6">
              <div>
                <div className="feature-card-icon">🧪</div>
                <h3 className="feature-card-title">Interactive API Simulator</h3>
                <p className="feature-card-desc">
                  Test custom JSON payloads directly in your browser. View real-time HTTP response status codes (`200 OK`), response latency (`38ms`), and payload state.
                </p>
              </div>
              <span className="feature-card-badge">Live Test Console</span>
            </div>

            <div className="feature-card bento-tile-12">
              <div>
                <div className="feature-card-icon">💻</div>
                <h3 className="feature-card-title">Multi-Language SDK Snippets</h3>
                <p className="feature-card-desc">
                  Copy battle-tested code snippets for <strong>cURL</strong>, <strong>Node.js (Fetch API)</strong>, and <strong>Python (requests)</strong>. Pass custom `agile_workflow` and `workflow_column` parameters to automate board movement.
                </p>
              </div>
              <span className="feature-card-badge">cURL · Node.js · Python</span>
            </div>
          </div>
        </section>

        {/* Category 3: Live Stack Integrations */}
        <section className="feature-category">
          <div className="feature-category-header">
            <span className="feature-category-tag">Developer Ecosystem</span>
            <h2 className="feature-category-title">🔌 Native Stack Integrations</h2>
            <p className="feature-category-desc">
              Your sprint tools should talk to your codebase. SprintOS™ connects directly with GitHub, Discord, Slack, Vercel, and Google Calendar.
            </p>
          </div>

          <div className="features-bento-grid">
            <div className="feature-card bento-tile-4">
              <div>
                <div className="feature-card-icon">🐙</div>
                <h3 className="feature-card-title">GitHub Repo Sync</h3>
                <p className="feature-card-desc">
                  Automatically transition tasks to "Done" when pull requests are merged. Track repository commits and branch references.
                </p>
              </div>
              <span className="feature-card-badge">GitHub Integration</span>
            </div>

            <div className="feature-card bento-tile-4">
              <div>
                <div className="feature-card-icon">💬</div>
                <h3 className="feature-card-title">Discord & Slack Alerts</h3>
                <p className="feature-card-desc">
                  Broadcast real-time sprint blocker alerts, standup summaries, and proof of work submissions directly into designated channels.
                </p>
              </div>
              <span className="feature-card-badge">Chat Webhooks</span>
            </div>

            <div className="feature-card bento-tile-4">
              <div>
                <div className="feature-card-icon">🚀</div>
                <h3 className="feature-card-title">Vercel Deployment Tracker</h3>
                <p className="feature-card-desc">
                  Monitor live build deployment status and associate deployment logs with active sprint tasks.
                </p>
              </div>
              <span className="feature-card-badge">CI/CD Deployments</span>
            </div>
          </div>
        </section>

        {/* Category 4: Data Ownership & Security */}
        <section className="feature-category">
          <div className="feature-category-header">
            <span className="feature-category-tag">Compliance & PDF Export</span>
            <h2 className="feature-category-title">📄 Data Ownership & Printable PDF Reports</h2>
            <p className="feature-category-desc">
              You own your data. Download complete structured PDF reports or CSV archives for any workspace you manage in seconds.
            </p>
          </div>

          <div className="features-bento-grid">
            <div className="feature-card bento-tile-6">
              <div>
                <div className="feature-card-icon">📄</div>
                <h3 className="feature-card-title">Modular PDF Data Exporter</h3>
                <p className="feature-card-desc">
                  Select target workspace and check specific data sections (tasks, sprint history, meeting notes, team roster, integrations) to generate clean, printable vector PDF documents.
                </p>
              </div>
              <span className="feature-card-badge">Printable PDF & JSON</span>
            </div>

            <div className="feature-card bento-tile-6">
              <div>
                <div className="feature-card-icon">🔒</div>
                <h3 className="feature-card-title">Tamper-Proof Audit Logs</h3>
                <p className="feature-card-desc">
                  Log every read, write, and role modification action in a security audit log. Export PDF or CSV compliance reports for security audits.
                </p>
              </div>
              <span className="feature-card-badge">Security Audit Trail</span>
            </div>
          </div>
        </section>

        {/* Feature Comparison Matrix */}
        <section className="feature-category">
          <div className="feature-category-header">
            <span className="feature-category-tag">Plan Matrix</span>
            <h2 className="feature-category-title">📊 Feature Entitlements & Pricing Breakdown</h2>
          </div>

          <div className="feature-table-wrapper">
            <table className="feature-table">
              <thead>
                <tr>
                  <th>Feature Capability</th>
                  <th>Starter Tier ($0)</th>
                  <th>Team Tier ($29/mo)</th>
                  <th>Scale Tier ($79/mo)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Team Seat Capacity</strong></td>
                  <td>Up to 3 Members</td>
                  <td>Up to 15 Members</td>
                  <td>Unlimited Members</td>
                </tr>
                <tr>
                  <td><strong>Agile Workflows Unlocked</strong></td>
                  <td>2 Workflows (Ad-hoc, Kanban)</td>
                  <td>6 Workflows (XP, Lean, Scrumban, Scrum)</td>
                  <td>All 8 Workflows (Spotify & SAFe)</td>
                </tr>
                <tr>
                  <td><strong>1-Click API Webhook Studio</strong></td>
                  <td>Locked</td>
                  <td>Locked</td>
                  <td>⚡ Full Unlocked Access</td>
                </tr>
                <tr>
                  <td><strong>Printable PDF Data Export</strong></td>
                  <td>Basic JSON</td>
                  <td>Full PDF Reports</td>
                  <td>Full PDF & CSV Audit Reports</td>
                </tr>
                <tr>
                  <td><strong>Live Stack Webhooks (GitHub, Discord)</strong></td>
                  <td>Included</td>
                  <td>Included</td>
                  <td>Priority Execution</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* CTA Footer Box */}
        <div className="features-cta-box">
          <h2>Ready to Accelerate Your Engineering Velocity?</h2>
          <p>Join engineering teams shipping faster with SprintOS™ by Paper5™.</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <button className="btn-primary" style={{ padding: '12px 28px', fontSize: '15px' }} onClick={() => navigate('/signup')}>
              🚀 Start Free Workspace
            </button>
            <button className="btn-ghost" style={{ padding: '12px 28px', fontSize: '15px' }} onClick={() => navigate('/login')}>
              🔑 Sign In to Workspace
            </button>
          </div>
        </div>
      </div>
    </MarketingLayout>
  )
}
