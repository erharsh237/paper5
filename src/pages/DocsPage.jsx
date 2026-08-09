import React, { useState } from 'react'
import MarketingLayout from '../components/MarketingLayout'
import SEOHead from '../components/SEOHead'
import { Search, Terminal, BookOpen, Key, Layers, GitPullRequest, FileText, Check, Copy } from 'lucide-react'
import './DocsPage.css'

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('getting-started')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState(null)

  const copyToClipboard = (code, id) => {
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const sections = [
    { id: 'getting-started', title: '🚀 Getting Started', group: 'Overview' },
    { id: 'agile-workflows', title: '⚡ Agile Workflow Engine', group: 'Overview' },
    { id: 'integrations', title: '🔌 Stack Webhooks & Integrations', group: 'Developer Guide' },
    { id: 'api-reference', title: '🛠️ 1-Click REST API Reference', group: 'Developer Guide' },
    { id: 'data-export', title: '📄 PDF Data Export & Compliance', group: 'Enterprise' }
  ]

  const filteredSections = sections.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <MarketingLayout>
      <SEOHead 
        title="Developer Documentation & API Reference | SprintOS™ by Paper5™" 
        description="Comprehensive developer documentation for SprintOS™: 8-tier Agile workflows, 1-Click REST API endpoints, GitHub & Slack webhooks, and PDF data compliance."
        canonicalUrl="https://paper5.co/docs"
      />

      <div className="docs-page-wrap">
        {/* Header Hero */}
        <header className="docs-hero">
          <div className="docs-hero-inner">
            <h1 className="docs-title">SprintOS™ Developer Documentation</h1>
            <p className="docs-subtitle">
              Everything you need to set up Agile workflows, integrate developer tools, and connect with 1-Click REST API webhooks.
            </p>
            <div className="docs-search-bar">
              <Search size={18} color="var(--text-tertiary)" />
              <input 
                type="text" 
                placeholder="Search documentation, endpoints, parameters..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </header>

        {/* Two-Column Documentation Portal Layout */}
        <div className="docs-layout-container">
          {/* Left Sidebar Navigation Tree */}
          <aside className="docs-sidebar">
            <div className="docs-sidebar-group">
              <span className="docs-sidebar-title">Overview</span>
              <ul className="docs-sidebar-links">
                {filteredSections.filter(s => s.group === 'Overview').map(s => (
                  <li key={s.id}>
                    <a 
                      className={`docs-sidebar-link ${activeSection === s.id ? 'active' : ''}`}
                      onClick={() => setActiveSection(s.id)}
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="docs-sidebar-group">
              <span className="docs-sidebar-title">Developer Guide</span>
              <ul className="docs-sidebar-links">
                {filteredSections.filter(s => s.group === 'Developer Guide').map(s => (
                  <li key={s.id}>
                    <a 
                      className={`docs-sidebar-link ${activeSection === s.id ? 'active' : ''}`}
                      onClick={() => setActiveSection(s.id)}
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="docs-sidebar-group">
              <span className="docs-sidebar-title">Enterprise</span>
              <ul className="docs-sidebar-links">
                {filteredSections.filter(s => s.group === 'Enterprise').map(s => (
                  <li key={s.id}>
                    <a 
                      className={`docs-sidebar-link ${activeSection === s.id ? 'active' : ''}`}
                      onClick={() => setActiveSection(s.id)}
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Main Article Content */}
          <main className="docs-main-content">
            
            {/* Section 1: Getting Started */}
            {(activeSection === 'getting-started' || searchQuery) && (
              <article className="docs-article-section" id="getting-started">
                <h2 className="docs-article-title">
                  <BookOpen size={24} color="#10b981" /> 🚀 Getting Started with SprintOS™
                </h2>
                <p className="docs-article-text">
                  SprintOS™ by Paper5™ is a high-velocity sprint management platform engineered to eliminate administrative friction. Sprints are time-boxed iterations where tasks automatically transition or roll over upon deadline expiration.
                </p>

                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '24px 0 12px 0' }}>Quickstart Onboarding Flow</h3>
                <ol style={{ paddingLeft: '20px', color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '14px' }}>
                  <li><strong>Create a Workspace:</strong> Sign up or log into your account and provision your team workspace.</li>
                  <li><strong>Select Agile Methodology:</strong> Choose from 8 pre-configured workflows tailored to your team size (Ad-hoc to SAFe).</li>
                  <li><strong>Invite Team Members:</strong> Assign roles (`Owner`, `Admin`, `Member`) to manage permissions.</li>
                  <li><strong>Connect Developer Stack:</strong> Provision a 1-Click API secret key or connect GitHub and Discord webhooks.</li>
                </ol>
              </article>
            )}

            {/* Section 2: Agile Workflow Engine */}
            {(activeSection === 'agile-workflows' || searchQuery) && (
              <article className="docs-article-section" id="agile-workflows">
                <h2 className="docs-article-title">
                  <Layers size={24} color="#10b981" /> ⚡ 8-Tier Agile Methodology Engine
                </h2>
                <p className="docs-article-text">
                  SprintOS™ dynamically configures board columns based on team size and methodology selection. Workflows adapt dynamically without losing task state.
                </p>

                <table className="docs-param-table">
                  <thead>
                    <tr>
                      <th>Workflow Name</th>
                      <th>Target Team Size</th>
                      <th>Aligned Board Columns</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>1. Ad-hoc Minimalist</strong></td>
                      <td>1 Solo Developer</td>
                      <td>To Do ➔ In Progress ➔ Done</td>
                    </tr>
                    <tr>
                      <td><strong>2. Kanban Continuous Flow</strong></td>
                      <td>2–5 Developers</td>
                      <td>Backlog ➔ In Progress ➔ Review ➔ Done</td>
                    </tr>
                    <tr>
                      <td><strong>3. Extreme Programming (XP)</strong></td>
                      <td>3–8 Developers</td>
                      <td>Planning ➔ Pair Coding ➔ CI Test ➔ Released</td>
                    </tr>
                    <tr>
                      <td><strong>4. Lean Software Engineering</strong></td>
                      <td>5–12 Developers</td>
                      <td>Identify Value ➔ Build ➔ Measure ➔ Learn ➔ Done</td>
                    </tr>
                    <tr>
                      <td><strong>5. Scrumban Hybrid</strong></td>
                      <td>8–15 Developers</td>
                      <td>Ready ➔ In Development ➔ Code Review ➔ Deployed</td>
                    </tr>
                    <tr>
                      <td><strong>6. Classic Scrum Iterative</strong></td>
                      <td>10–25 Developers</td>
                      <td>Sprint Backlog ➔ In Progress ➔ QA ➔ Completed</td>
                    </tr>
                    <tr>
                      <td><strong>7. Spotify Model Tribes</strong></td>
                      <td>25–100 Developers</td>
                      <td>Squad Backlog ➔ Chapter Review ➔ Tribe QA ➔ Shipped</td>
                    </tr>
                    <tr>
                      <td><strong>8. SAFe Scaled Enterprise</strong></td>
                      <td>50–500+ Enterprise</td>
                      <td>Portfolio Backlog ➔ PI Planning ➔ Execution ➔ Delivered</td>
                    </tr>
                  </tbody>
                </table>
              </article>
            )}

            {/* Section 3: Integrations & Webhooks */}
            {(activeSection === 'integrations' || searchQuery) && (
              <article className="docs-article-section" id="integrations">
                <h2 className="docs-article-title">
                  <GitPullRequest size={24} color="#10b981" /> 🔌 Stack Webhooks & Integrations
                </h2>
                <p className="docs-article-text">
                  Connect GitHub repositories, Vercel deployments, Discord alerts, and Slack standup broadcasts directly into your workspace.
                </p>

                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '20px 0 10px 0' }}>GitHub Auto-Closing Trigger</h3>
                <p className="docs-article-text">
                  When a pull request containing a task ID (e.g. `Fixes #104`) is merged into `main`, SprintOS™ automatically updates the task status to <strong>Done</strong>.
                </p>

                <div className="docs-code-block">
                  <div className="docs-code-header">
                    <span>GitHub Webhook Event Payload</span>
                    <button 
                      onClick={() => copyToClipboard(`{\n  "action": "closed",\n  "pull_request": {\n    "merged": true,\n    "title": "Fixes task #104: Optimize database queries"\n  }\n}`, 'gh-payload')}
                      style={{ background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      {copiedId === 'gh-payload' ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      {copiedId === 'gh-payload' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="docs-code-content">
{`{
  "action": "closed",
  "pull_request": {
    "merged": true,
    "title": "Fixes task #104: Optimize database queries"
  }
}`}
                  </pre>
                </div>
              </article>
            )}

            {/* Section 4: 1-Click API Reference */}
            {(activeSection === 'api-reference' || searchQuery) && (
              <article className="docs-article-section" id="api-reference">
                <h2 className="docs-article-title">
                  <Terminal size={24} color="#10b981" /> 🛠️ 1-Click REST API Reference
                </h2>
                <p className="docs-article-text">
                  All API requests require a Bearer token in the `Authorization` header (`Authorization: Bearer sp_live_...`). Provision API keys from Settings ➔ Integrations.
                </p>

                {/* Endpoint 1: Sync Task */}
                <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <span className="method-badge method-post">POST</span>
                    <code style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--mono)' }}>https://app.paper5.co/api/v1/sync</code>
                  </div>
                  <p className="docs-article-text">
                    Triggers automated task state updates and syncs sprint column status.
                  </p>

                  <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '12px 0 8px 0' }}>Request Body Parameters</h4>
                  <table className="docs-param-table">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Required</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><code>agile_workflow</code></td>
                        <td>String</td>
                        <td>Yes</td>
                        <td>Agile methodology ID (e.g. <code>scrum</code>, <code>kanban</code>, <code>xp</code>)</td>
                      </tr>
                      <tr>
                        <td><code>workflow_column</code></td>
                        <td>String</td>
                        <td>Yes</td>
                        <td>Target column ID (e.g. <code>in_progress</code>, <code>done</code>)</td>
                      </tr>
                      <tr>
                        <td><code>task_id</code></td>
                        <td>String</td>
                        <td>Optional</td>
                        <td>Specific task identifier to transition</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="docs-code-block">
                    <div className="docs-code-header">
                      <span>cURL Example Request</span>
                      <button 
                        onClick={() => copyToClipboard(`curl -X POST https://app.paper5.co/api/v1/sync \\\n  -H "Authorization: Bearer sp_live_key_99481" \\\n  -H "Content-Type: application/json" \\\n  -d '{"agile_workflow":"scrum","workflow_column":"done"}'`, 'curl-req')}
                        style={{ background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {copiedId === 'curl-req' ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                        {copiedId === 'curl-req' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="docs-code-content">
{`curl -X POST https://app.paper5.co/api/v1/sync \\
  -H "Authorization: Bearer sp_live_key_99481" \\
  -H "Content-Type: application/json" \\
  -d '{"agile_workflow":"scrum","workflow_column":"done"}'`}
                    </pre>
                  </div>

                  <div className="docs-code-block">
                    <div className="docs-code-header">
                      <span>HTTP 200 OK Response</span>
                    </div>
                    <pre className="docs-code-content">
{`{
  "status": "success",
  "http_code": 200,
  "execution_time_ms": 38,
  "sync_event": {
    "agile_workflow": "scrum",
    "workflow_column": "done",
    "aligned_columns": ["Sprint Backlog", "In Progress", "QA", "Done"],
    "timestamp": "2026-08-09T15:02:00.000Z"
  }
}`}
                    </pre>
                  </div>
                </div>
              </article>
            )}

            {/* Section 5: Data Export & Compliance */}
            {(activeSection === 'data-export' || searchQuery) && (
              <article className="docs-article-section" id="data-export">
                <h2 className="docs-article-title">
                  <FileText size={24} color="#10b981" /> 📄 PDF Data Export & Compliance
                </h2>
                <p className="docs-article-text">
                  SprintOS™ guarantees complete data portability. Workspace admins can export printable vector PDF reports or CSV security audit trails at any time.
                </p>

                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '20px 0 10px 0' }}>Selective Export Sections</h3>
                <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '14px' }}>
                  <li><strong>Tasks & Deadlines:</strong> Comprehensive breakdown of completed and active sprint tasks.</li>
                  <li><strong>Sprint History & Velocity:</strong> Historical velocity trend logs and milestone completion rates.</li>
                  <li><strong>Meeting Notes & Agendas:</strong> Saved Google Calendar meeting notes and standup transcripts.</li>
                  <li><strong>Security Audit Trails:</strong> Tamper-proof log records containing actor IDs, modified resources, and timestamps.</li>
                </ul>
              </article>
            )}

          </main>
        </div>
      </div>
    </MarketingLayout>
  )
}
