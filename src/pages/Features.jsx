import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MarketingLayout from '../components/MarketingLayout'
import SEOHead from '../components/SEOHead'
import { WORKFLOWS } from '../lib/workflows'
import { Code2, GitPullRequest, FileText, ShieldCheck, ChevronRight, Check } from 'lucide-react'
import './Features.css'

export default function Features() {
  const navigate = useNavigate()
  const [activeWorkflowId, setActiveWorkflowId] = useState('scrum')

  const selectedWorkflow = WORKFLOWS.find(w => w.id === activeWorkflowId) || WORKFLOWS[5]

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
        {/* Interactive Feature Section 1: 8-Tier Methodology Selector */}
        <section className="features-linear-section">
          <div className="section-head">
            <span className="section-label">01 / METHODOLOGY ENGINE</span>
            <h2>8-Tier Agile Workflow Alignment</h2>
            <p>Select your team size to preview the dynamic board column architecture.</p>
          </div>

          {/* Workflow Tabs Bar */}
          <div className="workflow-tabs-bar">
            {WORKFLOWS.map((wf) => (
              <button
                key={wf.id}
                onClick={() => setActiveWorkflowId(wf.id)}
                className={`workflow-tab-btn ${wf.id === activeWorkflowId ? 'active' : ''}`}
              >
                <span>Tier {wf.num}</span>
                <strong>{wf.name.split(' ')[0]}</strong>
              </button>
            ))}
          </div>

          {/* Selected Workflow Showcase */}
          <div className="workflow-detail-box">
            <div className="workflow-detail-main">
              <div className="workflow-header-row">
                <div>
                  <span className="wf-tag">Tier {selectedWorkflow.num} Methodology</span>
                  <h3 className="wf-title">{selectedWorkflow.name}</h3>
                </div>
                <div className="wf-size-pill">
                  Team Size: {selectedWorkflow.teamSizeLabel}
                </div>
              </div>
              <p className="wf-desc">{selectedWorkflow.description}</p>
              
              <div className="wf-practices-list">
                <h4 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#000000', margin: '0 0 12px 0' }}>Core Engineering Practices</h4>
                {selectedWorkflow.practices.map((practice, idx) => (
                  <div key={idx} className="practice-row">
                    <Check size={16} color="#000000" />
                    <span>{practice}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="workflow-columns-preview">
              <h4 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#000000', margin: '0 0 16px 0' }}>Dynamic Board Column Structure</h4>
              <div className="cols-flow-list">
                {selectedWorkflow.columns.map((col, idx) => (
                  <div key={col.id} className="col-flow-item">
                    <span className="col-idx">{idx + 1}</span>
                    <span className="col-name">{col.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Feature Section 2: Developer Automation */}
        <section className="features-linear-section">
          <div className="section-head">
            <span className="section-label">02 / DEVELOPER AUTOMATION</span>
            <h2>1-Click API Webhook & REST Sync Studio</h2>
            <p>Connect custom webhooks, CI/CD scripts, and developer tools in a single click.</p>
          </div>

          <div className="linear-feature-list">
            <div className="linear-feature-row">
              <div className="linear-feature-info">
                <div className="linear-icon"><Code2 size={20} /></div>
                <div>
                  <h3>1-Click Live API Keys</h3>
                  <p>Provision secret API keys instantly with one click (`sp_live_...`). Show, hide, or rotate keys anytime from your workspace integrations dashboard.</p>
                </div>
              </div>
              <span className="linear-feature-badge">REST API & Webhooks</span>
            </div>

            <div className="linear-feature-row">
              <div className="linear-feature-info">
                <div className="linear-icon"><Code2 size={20} /></div>
                <div>
                  <h3>Interactive API Simulator</h3>
                  <p>Test custom JSON payloads directly in your browser. View real-time HTTP response status codes (`200 OK`), response latency (`38ms`), and payload state.</p>
                </div>
              </div>
              <span className="linear-feature-badge">Live Test Console</span>
            </div>

            <div className="linear-feature-row">
              <div className="linear-feature-info">
                <div className="linear-icon"><Code2 size={20} /></div>
                <div>
                  <h3>Multi-Language Code Snippets</h3>
                  <p>Copy battle-tested code snippets for cURL, Node.js (Fetch API), and Python (requests). Pass custom agile parameters to automate board movement.</p>
                </div>
              </div>
              <span className="linear-feature-badge">cURL · Node.js · Python</span>
            </div>
          </div>
        </section>

        {/* Feature Section 3: Native Stack Integrations */}
        <section className="features-linear-section">
          <div className="section-head">
            <span className="section-label">03 / DEVELOPER ECOSYSTEM</span>
            <h2>Native Stack Integrations</h2>
            <p>Paper5™ lives where your code lives. Keep code commits, PR merges, and deployment updates synchronized.</p>
          </div>

          <div className="linear-feature-list">
            <div className="linear-feature-row">
              <div className="linear-feature-info">
                <div className="linear-icon"><GitPullRequest size={20} /></div>
                <div>
                  <h3>GitHub Repository PR Sync</h3>
                  <p>Automatically transition sprint tasks to 'Merged' when pull requests are merged into your repository's main branch.</p>
                </div>
              </div>
              <span className="linear-feature-badge">GitHub Action</span>
            </div>

            <div className="linear-feature-row">
              <div className="linear-feature-info">
                <div className="linear-icon"><GitPullRequest size={20} /></div>
                <div>
                  <h3>Discord & Slack Standups</h3>
                  <p>Broadcast daily sprint digests and blocked task alerts directly to your team's chat channels without extra bot setup.</p>
                </div>
              </div>
              <span className="linear-feature-badge">Discord & Slack</span>
            </div>

            <div className="linear-feature-row">
              <div className="linear-feature-info">
                <div className="linear-icon"><GitPullRequest size={20} /></div>
                <div>
                  <h3>Google Calendar & Vercel Sync</h3>
                  <p>Bind sprint demo deadlines into Google Calendar agendas and track live Vercel production build statuses in your sprint header.</p>
                </div>
              </div>
              <span className="linear-feature-badge">Calendar & Vercel</span>
            </div>
          </div>
        </section>

        {/* Feature Section 4: PDF Ownership & Audit Logs */}
        <section className="features-linear-section">
          <div className="section-head">
            <span className="section-label">04 / DATA OWNERSHIP & SECURITY</span>
            <h2>Vector PDF Ownership & Compliance</h2>
            <p>Your data belongs to you. Export high-resolution vector PDF reports and audit logs whenever you need offline archival.</p>
          </div>

          <div className="linear-feature-list">
            <div className="linear-feature-row">
              <div className="linear-feature-info">
                <div className="linear-icon"><FileText size={20} /></div>
                <div>
                  <h3>Vector Printable PDF Data Export</h3>
                  <p>Generate clean, printable PDF documents of your active sprint metrics, member velocity, and task backlog with customizable section toggles.</p>
                </div>
              </div>
              <span className="linear-feature-badge">Printable PDF</span>
            </div>

            <div className="linear-feature-row">
              <div className="linear-feature-info">
                <div className="linear-icon"><ShieldCheck size={20} /></div>
                <div>
                  <h3>Strict Audit Logs & Compliance</h3>
                  <p>Export complete workspace security audit trails in CSV format. Track team membership changes, permission updates, and API key rotations.</p>
                </div>
              </div>
              <span className="linear-feature-badge">CSV Audit Log</span>
            </div>
          </div>
        </section>

        {/* Plan Matrix Table */}
        <section className="features-linear-section" style={{ borderBottom: 'none' }}>
          <div className="section-head">
            <span className="section-label">05 / TIER ENTITLEMENTS</span>
            <h2>Plan Capability Matrix</h2>
            <p>Explore entitlement limits across plans during our free launch special.</p>
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
