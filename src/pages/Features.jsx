import React from 'react'
import { useNavigate } from 'react-router-dom'
import MarketingLayout from '../components/MarketingLayout'
import SEOHead from '../components/SEOHead'
import { WORKFLOWS } from '../lib/workflows'
import { Layers, Code2, GitPullRequest, FileText, CheckCircle2, ShieldCheck } from 'lucide-react'
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
        <h1 className="features-title">
          Architected for High-Velocity Engineering Teams.
        </h1>
        <p className="features-subtitle">
          Eliminate administrative friction. SprintOS™ unites 8-tier Agile methodologies, 1-Click API automation, live stack integrations, and PDF data ownership in a single minimalist platform.
        </p>
        <div className="features-hero-actions">
          <button className="btn-primary" style={{ padding: '12px 28px', fontSize: '15px' }} onClick={() => navigate('/signup')}>
            🚀 Start Free Workspace
          </button>
          <button className="btn-ghost" style={{ padding: '12px 28px', fontSize: '15px' }} onClick={() => navigate('/product-integrations')}>
            ⚡ Explore Integrations
          </button>
        </div>
      </section>

      <div className="features-container">
        {/* Category 1: 8-Tier Agile Workflows */}
        <section className="feature-category">
          <div className="feature-category-header">
            <span className="feature-category-tag">Methodology Engine</span>
            <h2 className="feature-category-title">8-Tier Agile Workflow Alignment</h2>
            <p className="feature-category-desc">
              SprintOS™ dynamically aligns your board columns based on team size—from solo indie founders up to 500+ developer enterprise tribes.
            </p>
          </div>

          <div className="workflows-clean-grid">
            {WORKFLOWS.map((wf) => (
              <div key={wf.id} className="clean-feature-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span className="workflow-badge">Tier {wf.num}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#52525b' }}>{wf.teamSizeLabel}</span>
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 8px 0', color: '#000000' }}>
                  {wf.name}
                </h3>
                <p style={{ fontSize: '13px', color: '#27272a', lineHeight: 1.5, margin: '0 0 16px 0' }}>
                  {wf.description}
                </p>
                <div style={{ fontSize: '11px', color: '#52525b', fontFamily: 'var(--mono)', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '10px' }}>
                  Columns: {wf.columns.map(c => c.title).join(' ➔ ')}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Category 2: 1-Click API Studio */}
        <section className="feature-category">
          <div className="feature-category-header">
            <span className="feature-category-tag">Developer Automation</span>
            <h2 className="feature-category-title">1-Click API Webhook & REST Sync Studio</h2>
            <p className="feature-category-desc">
              Connect custom webhooks, CI/CD scripts, and developer tools in a single click. Trigger automated task transitions and query velocity metrics in real time.
            </p>
          </div>

          <div className="clean-three-grid">
            <div className="clean-feature-card">
              <div className="clean-card-icon"><Code2 size={20} /></div>
              <h3 className="clean-card-title">1-Click Live API Keys</h3>
              <p className="clean-card-desc">
                Provision secret API keys instantly with one click (`sp_live_...`). Show, hide, or rotate keys anytime from your workspace integrations dashboard.
              </p>
              <span className="clean-card-tag">REST API & Webhooks</span>
            </div>

            <div className="clean-feature-card">
              <div className="clean-card-icon"><Code2 size={20} /></div>
              <h3 className="clean-card-title">Interactive API Simulator</h3>
              <p className="clean-card-desc">
                Test custom JSON payloads directly in your browser. View real-time HTTP response status codes (`200 OK`), response latency (`38ms`), and payload state.
              </p>
              <span className="clean-card-tag">Live Test Console</span>
            </div>

            <div className="clean-feature-card">
              <div className="clean-card-icon"><Code2 size={20} /></div>
              <h3 className="clean-card-title">Multi-Language Code Snippets</h3>
              <p className="clean-card-desc">
                Copy battle-tested code snippets for cURL, Node.js (Fetch API), and Python (requests). Pass custom agile parameters to automate board movement.
              </p>
              <span className="clean-card-tag">cURL · Node.js · Python</span>
            </div>
          </div>
        </section>

        {/* Category 3: Live Stack Integrations */}
        <section className="feature-category">
          <div className="feature-category-header">
            <span className="feature-category-tag">Developer Ecosystem</span>
            <h2 className="feature-category-title">Native Stack Integrations</h2>
            <p className="feature-category-desc">
              Paper5™ lives where your code lives. Keep code commits, PR merges, chat alerts, and deployment updates synchronized without leaving your terminal.
            </p>
          </div>

          <div className="clean-three-grid">
            <div className="clean-feature-card">
              <div className="clean-card-icon"><GitPullRequest size={20} /></div>
              <h3 className="clean-card-title">GitHub Repository PR Sync</h3>
              <p className="clean-card-desc">
                Automatically transition sprint tasks to 'Merged' when pull requests are merged into your repository's main branch.
              </p>
              <span className="clean-card-tag">GitHub Action</span>
            </div>

            <div className="clean-feature-card">
              <div className="clean-card-icon"><GitPullRequest size={20} /></div>
              <h3 className="clean-card-title">Discord & Slack Standups</h3>
              <p className="clean-card-desc">
                Broadcast daily sprint digests and blocked task alerts directly to your team's chat channels without extra bot setup.
              </p>
              <span className="clean-card-tag">Discord & Slack</span>
            </div>

            <div className="clean-feature-card">
              <div className="clean-card-icon"><GitPullRequest size={20} /></div>
              <h3 className="clean-card-title">Google Calendar & Vercel Sync</h3>
              <p className="clean-card-desc">
                Bind sprint demo deadlines into Google Calendar agendas and track live Vercel production build statuses in your sprint header.
              </p>
              <span className="clean-card-tag">Calendar & Vercel</span>
            </div>
          </div>
        </section>

        {/* Category 4: PDF Ownership & Compliance */}
        <section className="feature-category">
          <div className="feature-category-header">
            <span className="feature-category-tag">Data Ownership & Security</span>
            <h2 className="feature-category-title">Vector PDF Ownership & Compliance</h2>
            <p className="feature-category-desc">
              Your data belongs to you. Export high-resolution vector PDF reports and audit logs whenever you need offline archival or stakeholder compliance.
            </p>
          </div>

          <div className="clean-two-grid">
            <div className="clean-feature-card">
              <div className="clean-card-icon"><FileText size={20} /></div>
              <h3 className="clean-card-title">Vector Printable PDF Data Export</h3>
              <p className="clean-card-desc">
                Generate clean, printable PDF documents of your active sprint metrics, member velocity, and task backlog with customizable section toggles.
              </p>
              <span className="clean-card-tag">Printable PDF</span>
            </div>

            <div className="clean-feature-card">
              <div className="clean-card-icon"><ShieldCheck size={20} /></div>
              <h3 className="clean-card-title">Strict Audit Logs & Compliance</h3>
              <p className="clean-card-desc">
                Export complete workspace security audit trails in CSV format. Track team membership changes, permission updates, and API key rotations.
              </p>
              <span className="clean-card-tag">CSV Audit Log</span>
            </div>
          </div>
        </section>

        {/* Entitlements Table */}
        <section className="feature-category" style={{ marginBottom: 0 }}>
          <div className="feature-category-header">
            <span className="feature-category-tag">Tier Entitlements</span>
            <h2 className="feature-category-title">Plan Capability Matrix</h2>
            <p className="feature-category-desc">
              Every plan includes full access during launch. Explore entitlement limits across plans.
            </p>
          </div>

          <div className="feature-table-wrapper">
            <table className="feature-table">
              <thead>
                <tr>
                  <th>Capability / Feature</th>
                  <th>Starter</th>
                  <th>Team (Launch Special)</th>
                  <th>Scale (Launch Special)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Agile Workflows</strong></td>
                  <td>2 Workflows (Ad-hoc, Kanban)</td>
                  <td>6 Workflows (Kanban, Scrum, XP, Lean, Scrumban)</td>
                  <td>⚡ All 8 Workflows (SAFe Enterprise)</td>
                </tr>
                <tr>
                  <td><strong>Max Workspaces</strong></td>
                  <td>1 Workspace</td>
                  <td>5 Workspaces</td>
                  <td>10 Workspaces</td>
                </tr>
                <tr>
                  <td><strong>Team Member Seats</strong></td>
                  <td>Up to 3 Members</td>
                  <td>Up to 7 Members</td>
                  <td>Unlimited Members</td>
                </tr>
                <tr>
                  <td><strong>Stack Integrations</strong></td>
                  <td>GitHub Sync</td>
                  <td>GitHub & Discord</td>
                  <td>GitHub, Discord, Slack, Calendar & Vercel</td>
                </tr>
                <tr>
                  <td><strong>1-Click API REST Studio</strong></td>
                  <td>Read-only API</td>
                  <td>Full API & Webhooks</td>
                  <td>⚡ Full API, Webhooks & Simulator</td>
                </tr>
                <tr>
                  <td><strong>Printable PDF Export</strong></td>
                  <td>Standard PDF</td>
                  <td>Custom PDF Sections</td>
                  <td>⚡ Vector PDF & CSV Security Audit Trail</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </MarketingLayout>
  )
}
