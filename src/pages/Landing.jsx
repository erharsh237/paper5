import { useScrollReveal } from '../hooks/useScrollReveal'
import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import MarketingNav from '../components/MarketingNav'
import MarketingFooter from '../components/MarketingFooter'
import { AnimatedGridBackgroundSection } from '../components/AnimatedGridBackground'
import SEOHead from '../components/SEOHead'
import AlertModal from '../components/ui/AlertModal'
import { encryptPlanParam } from '../lib/urlSecurity'
import { getAppUrl } from '../lib/domain'
import { 
  ArrowRight, 
  Check, 
  Layers, 
  Clock, 
  AlertTriangle, 
  FileText, 
  GitPullRequest, 
  Code2, 
  Calendar, 
  Users, 
  ShieldCheck, 
  ExternalLink,
  MessageSquare,
  Zap,
  CheckCircle2,
  Lock,
  ChevronRight,
  FolderX,
  ClockAlert,
  MessagesSquare,
  FolderGit2,
  Rocket,
  Compass,
  AlertCircle
} from 'lucide-react'
import './Landing.css'

export default function Landing() {
  useScrollReveal()
  const [alertMessage, setAlertMessage] = useState(null)
  const [activePreviewTab, setActivePreviewTab] = useState('workflow') // 'workflow' | 'knowledge' | 'visibility'
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const handleGetStarted = (planId = 'team') => {
    const encryptedToken = encryptPlanParam(planId)
    localStorage.setItem('sprintos_selected_plan', planId)
    if (user) {
      navigate('/workspace')
    } else {
      const target = getAppUrl(`/signup?p=${encryptedToken}`)
      if (target.startsWith('http')) {
        window.location.href = target
      } else {
        navigate(target)
      }
    }
  }

  const handlePlanClick = (planId) => {
    handleGetStarted(planId)
  }

  useEffect(() => {
    document.title = "Paper5 | The Connected Project Workspace for Small Teams"

    if (location.pathname === '/pricing' || location.hash === '#pricing' || window.location.hash === '#pricing') {
      const timer = setTimeout(() => {
        const el = document.getElementById('pricing')
        if (el) {
          if (window.__lenis) {
          window.__lenis.scrollTo(el, { offset: -84, duration: 1.35, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) })
        } else {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        }
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [location.pathname, location.hash])

  return (
    <div className="landing-page">
      <SEOHead 
        title="Paper5 | The Connected Project Workspace for Small Teams & Startups" 
        description="Paper5 brings your team's projects, tasks, deadlines, documents and development activity together in one connected workspace, so everyone knows what's happening and what needs attention."
        canonicalUrl="https://paper5.co"
      />
      <MarketingNav />

      <main>
        {/* ── 1. HERO SECTION ── */}
        <AnimatedGridBackgroundSection>
          <section className="hero-section">
            <div className="hero-content">

              {/* Main Headline */}
              <h1 className="hero-headline">
                Your entire project.<br />
                One connected workspace.
              </h1>

              {/* Supporting Copy */}
              <p className="hero-subtext">
                Stop chasing updates, searching through spreadsheets and losing important project information. Paper5 brings your team's projects, tasks, deadlines, documents and development activity together, so everyone knows what's happening and what needs attention.
              </p>

              {/* CTA Group */}
              <div className="hero-cta-group">
                <button 
                  className="btn-primary btn-lg" 
                  onClick={() => handleGetStarted('team')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <span>Get Started for Free</span>
                  <ArrowRight size={18} />
                </button>
                <a 
                  href="#problem"
                  onClick={(e) => {
                    e.preventDefault();
                    const el = document.getElementById('problem');
                    if (el) {
                      if (window.__lenis) {
                        window.__lenis.scrollTo(el, { offset: -84, duration: 1.25, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
                      } else {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }
                  }}
                  className="btn-ghost btn-lg"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
                >
                  <span>Explore Paper5</span>
                  <ChevronRight size={16} />
                </a>
              </div>

              {/* Supporting Microcopy */}
              <div className="hero-microcopy">
                <span>Built for small teams and startups.</span>
                <span className="microcopy-dot">•</span>
                <span>Free during launch</span>
                <span className="microcopy-dot">•</span>
                <span>No credit card required</span>
              </div>
            </div>

            {/* Visual Product Preview (High-Fidelity Paper5 Workspace) */}
            <div className="hero-preview-container">
              <div className="preview-window">
                {/* Window Chrome Header */}
                <div className="preview-chrome">
                  <div className="preview-dots">
                    <span className="dot dot-red" />
                    <span className="dot dot-yellow" />
                    <span className="dot dot-green" />
                  </div>
                  <div className="preview-address-bar">
                    <Lock size={12} color="#64748b" />
                    <span>app.paper5.co/alpha-team/workspace</span>
                  </div>
                  <div className="preview-live-pill">
                    <span className="live-indicator" />
                    <span>Live Connected</span>
                  </div>
                </div>

                {/* Sub-Header & Perspective Switcher */}
                <div className="preview-subnav">
                  <div className="preview-title-meta">
                    <div className="preview-workspace-name">
                      <strong>Alpha Team</strong> / Sprint 14 Launch
                    </div>
                    <div className="preview-status-pill">
                      <span>In Progress • 68% Completed</span>
                    </div>
                  </div>

                  <div className="preview-tabs">
                    <button 
                      className={`preview-tab-btn ${activePreviewTab === 'workflow' ? 'active' : ''}`}
                      onClick={() => setActivePreviewTab('workflow')}
                    >
                      <Layers size={14} />
                      <span>Workflow & Tasks</span>
                    </button>
                    <button 
                      className={`preview-tab-btn ${activePreviewTab === 'knowledge' ? 'active' : ''}`}
                      onClick={() => setActivePreviewTab('knowledge')}
                    >
                      <FileText size={14} />
                      <span>Project Knowledge</span>
                    </button>
                    <button 
                      className={`preview-tab-btn ${activePreviewTab === 'visibility' ? 'active' : ''}`}
                      onClick={() => setActivePreviewTab('visibility')}
                    >
                      <GitPullRequest size={14} />
                      <span>Connected Tools</span>
                    </button>
                  </div>
                </div>

                {/* Preview Body Content */}
                <div className="preview-body">
                  {/* TAB 1: WORKFLOW & TASKS */}
                  {activePreviewTab === 'workflow' && (
                    <div className="preview-board-grid">
                      {/* Column 1: Sprint Backlog */}
                      <div className="preview-board-col">
                        <div className="preview-col-header">
                          <span className="col-title">Sprint Backlog</span>
                          <span className="col-count">2</span>
                        </div>
                        <div className="preview-card">
                          <div className="preview-card-tags">
                            <span className="card-badge badge-blue">Backend</span>
                            <span className="card-badge badge-priority-high">High</span>
                          </div>
                          <div className="preview-card-title">Stripe webhook idempotency & retry logic</div>
                          <div className="preview-card-meta">
                            <div className="card-assignee">
                              <span className="avatar-xs">AM</span>
                              <span>Alex M.</span>
                            </div>
                            <span className="card-due">Due Tomorrow</span>
                          </div>
                        </div>
                        <div className="preview-card">
                          <div className="preview-card-tags">
                            <span className="card-badge badge-gray">Product</span>
                            <span className="card-badge badge-priority-med">Med</span>
                          </div>
                          <div className="preview-card-title">Customer onboarding email welcome sequence</div>
                          <div className="preview-card-meta">
                            <div className="card-assignee">
                              <span className="avatar-xs">SK</span>
                              <span>Sarah K.</span>
                            </div>
                            <span className="card-due">Due Friday</span>
                          </div>
                        </div>
                      </div>

                      {/* Column 2: In Progress */}
                      <div className="preview-board-col">
                        <div className="preview-col-header">
                          <span className="col-title">In Progress</span>
                          <span className="col-count">2</span>
                        </div>
                        <div className="preview-card card-featured">
                          <div className="preview-card-tags">
                            <span className="card-badge badge-purple">Core</span>
                            <span className="card-badge badge-priority-urgent">Urgent</span>
                          </div>
                          <div className="preview-card-title">PostgreSQL connection pooling & read-replica routing</div>
                          <div className="preview-card-extra">
                            <div className="github-sync-pill">
                              <span className="gh-icon">🐙</span>
                              <span>PR #42: Checks Passing</span>
                            </div>
                          </div>
                          <div className="preview-card-meta">
                            <div className="card-assignee">
                              <span className="avatar-xs">PK</span>
                              <span>Paras K.</span>
                            </div>
                            <span className="card-due" style={{ color: '#0f172a', fontWeight: 600 }}>Due in 2d</span>
                          </div>
                        </div>
                        <div className="preview-card">
                          <div className="preview-card-tags">
                            <span className="card-badge badge-blue">Frontend</span>
                            <span className="card-badge badge-priority-high">High</span>
                          </div>
                          <div className="preview-card-title">Responsive mobile navigation & drawer accessibility</div>
                          <div className="preview-card-meta">
                            <div className="card-assignee">
                              <span className="avatar-xs">ER</span>
                              <span>Elena R.</span>
                            </div>
                            <span className="card-due">Due in 3d</span>
                          </div>
                        </div>
                      </div>

                      {/* Column 3: Blockers & Reviews */}
                      <div className="preview-board-col">
                        <div className="preview-col-header">
                          <span className="col-title">Blockers & Reviews</span>
                          <span className="col-count">1</span>
                        </div>
                        <div className="preview-card card-blocker-highlight">
                          <div className="preview-card-tags">
                            <span className="card-badge badge-red">Blocker Flagged</span>
                          </div>
                          <div className="preview-card-title">Domain DNS SSL verification for client white-labeling</div>
                          <div className="blocker-reason-box">
                            <strong>Blocker:</strong> Waiting for root nameserver delegation from client devops.
                          </div>
                          <div className="preview-card-meta">
                            <div className="card-assignee">
                              <span className="avatar-xs">TK</span>
                              <span>Tariq K.</span>
                            </div>
                            <span className="status-badge-inline">Swarm Requested</span>
                          </div>
                        </div>
                      </div>

                      {/* Column 4: Done & Verified */}
                      <div className="preview-board-col">
                        <div className="preview-col-header">
                          <span className="col-title">Done & Verified</span>
                          <span className="col-count">2</span>
                        </div>
                        <div className="preview-card card-done">
                          <div className="preview-card-tags">
                            <span className="card-badge badge-green">Verified</span>
                          </div>
                          <div className="preview-card-title">Two-Factor Authentication with authenticator apps</div>
                          <div className="proof-of-work-pill">
                            <Check size={12} color="#16a34a" />
                            <span>Proof of work verified</span>
                          </div>
                          <div className="preview-card-meta">
                            <div className="card-assignee">
                              <span className="avatar-xs">AM</span>
                              <span>Alex M.</span>
                            </div>
                            <span className="card-completed-date">Yesterday</span>
                          </div>
                        </div>
                        <div className="preview-card card-done">
                          <div className="preview-card-tags">
                            <span className="card-badge badge-green">Verified</span>
                          </div>
                          <div className="preview-card-title">Standup notes sync & reflection panel setup</div>
                          <div className="preview-card-meta">
                            <div className="card-assignee">
                              <span className="avatar-xs">SK</span>
                              <span>Sarah K.</span>
                            </div>
                            <span className="card-completed-date">2d ago</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: PROJECT KNOWLEDGE & NOTES */}
                  {activePreviewTab === 'knowledge' && (
                    <div className="preview-knowledge-layout">
                      <div className="knowledge-sidebar">
                        <div className="knowledge-side-title">Project Knowledge Base</div>
                        <div className="knowledge-side-item active">
                          <FileText size={14} />
                          <span>Sprint 14 Architecture Decisions</span>
                        </div>
                        <div className="knowledge-side-item">
                          <FileText size={14} />
                          <span>Weekly Sync & Retrospective (Oct 28)</span>
                        </div>
                        <div className="knowledge-side-item">
                          <FileText size={14} />
                          <span>API Authentication Standards</span>
                        </div>
                        <div className="knowledge-side-item">
                          <FileText size={14} />
                          <span>Client Deliverable Specifications</span>
                        </div>
                      </div>
                      <div className="knowledge-viewer">
                        <div className="knowledge-header">
                          <h3>Sprint 14 Architecture Decisions</h3>
                          <div className="knowledge-meta">Updated yesterday • Author: Paras K. • 4 Decisions Recorded</div>
                        </div>
                        <div className="knowledge-content-mock">
                          <div className="doc-section">
                            <strong>Decision 1: Connection Pooling Strategy</strong>
                            <p>We have decided to route all high-frequency deadline reads through Supabase's connection pooler on port 6543 to eliminate socket exhaustion under burst traffic.</p>
                          </div>
                          <div className="doc-section">
                            <strong>Decision 2: Blocker Swarm Protocol</strong>
                            <p>Any task marked as "Blocked" immediately notifies assigned helpers via email and mirrors an urgent card into Slack `#team-sprint-alerts`.</p>
                          </div>
                          <div className="doc-section">
                            <strong>Action Items:</strong>
                            <ul style={{ margin: '6px 0 0 16px', color: '#475569' }}>
                              <li>Alex M. — Finalize database schema migration by Thursday</li>
                              <li>Elena R. — Verify keyboard tab navigation across modals</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: CONNECTED DEVELOPMENT & TOOLS */}
                  {activePreviewTab === 'visibility' && (
                    <div className="preview-tools-layout">
                      <div className="tool-card-preview">
                        <div className="tool-card-head">
                          <div className="tool-info">
                            <span className="tool-icon">🐙</span>
                            <div>
                              <h4>GitHub Repository Sync</h4>
                              <p>Repo: <code>paper5/sprint-core</code> (Main branch)</p>
                            </div>
                          </div>
                          <span className="tool-badge-live">Live & Syncing</span>
                        </div>
                        <div className="tool-feed">
                          <div className="tool-feed-item">
                            <CheckCircle2 size={14} color="#16a34a" />
                            <span>PR #42 merged into <code>main</code> — auto-closed task "API Token Revocation"</span>
                          </div>
                          <div className="tool-feed-item">
                            <GitPullRequest size={14} color="#2563eb" />
                            <span>PR #44 opened: "Add PostgreSQL read-replica support" (All checks passing)</span>
                          </div>
                        </div>
                      </div>

                      <div className="tool-card-preview">
                        <div className="tool-card-head">
                          <div className="tool-info">
                            <span className="tool-icon">💬</span>
                            <div>
                              <h4>Slack & Discord Webhook Alerts</h4>
                              <p>Channel: <code>#alpha-sprint-alerts</code></p>
                            </div>
                          </div>
                          <span className="tool-badge-live">Active</span>
                        </div>
                        <div className="tool-feed">
                          <div className="tool-feed-item">
                            <AlertCircle size={14} color="#dc2626" />
                            <span>Blocker notification broadcasted for "Domain DNS SSL verification"</span>
                          </div>
                        </div>
                      </div>

                      <div className="tool-card-preview">
                        <div className="tool-card-head">
                          <div className="tool-info">
                            <span className="tool-icon">⚡</span>
                            <div>
                              <h4>1-Click REST API Studio</h4>
                              <p>Key: <code>sp_live_9f8a...4b12</code> (Status: Active)</p>
                            </div>
                          </div>
                          <span className="tool-badge-live">Ready</span>
                        </div>
                        <div className="tool-feed">
                          <div className="tool-feed-item">
                            <Code2 size={14} color="#059669" />
                            <span>CI/CD deployment trigger verified: HTTP 200 OK (Latency 48ms)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </AnimatedGridBackgroundSection>

        {/* ── 2. TRUST / VALUE STRIP ── */}
        <section className="value-strip-section reveal-on-scroll">
          <div className="value-strip-container">
            <h2 className="value-strip-title">
              Everything connected. Everyone on the same page.
            </h2>

            <div className="value-strip-grid reveal-stagger">
              <div className="value-strip-item">
                <div className="value-strip-icon-box">
                  <Layers size={20} />
                </div>
                <h3>One workspace for your projects</h3>
                <p>Consolidate project planning, daily execution and team communication without jumping between disconnected tools.</p>
              </div>

              <div className="value-strip-item">
                <div className="value-strip-icon-box">
                  <Clock size={20} />
                </div>
                <h3>Clear ownership and deadlines</h3>
                <p>Assign explicit task owners, transparent due dates and verified proof-of-work delivery so responsibilities are never ambiguous.</p>
              </div>

              <div className="value-strip-item">
                <div className="value-strip-icon-box">
                  <GitPullRequest size={20} />
                </div>
                <h3>Connected development workflows</h3>
                <p>Link pull requests, surface live CI check statuses and connect your developer tools without manual ticket updates.</p>
              </div>

              <div className="value-strip-item">
                <div className="value-strip-icon-box">
                  <FileText size={20} />
                </div>
                <h3>Project information that stays organised</h3>
                <p>Keep meeting notes, architecture decisions, resource links and retrospective learnings readily accessible in one hub.</p>
              </div>
            </div>

            {/* Sub-strip: Accurate, Substantiated Security Assurance */}
            <div className="security-assurance-bar">
              <ShieldCheck size={16} color="#059669" />
              <span>
                <strong>Verified Security Standards:</strong> TLS 1.3 encryption in transit, AES-256 data protection at rest, PostgreSQL Row-Level Security tenant isolation, and optional Two-Factor Authentication (2FA).
              </span>
            </div>
          </div>
        </section>

        {/* ── 3. SECTION: THE PROBLEM ── */}
        <section id="problem" className="problem-section">
          <div className="section-container">
            <div className="section-header">
              <h2 className="section-title">
                Running a startup is hard enough.<br />
                Managing the work shouldn't be.
              </h2>
              <p className="section-description">
                Your project information shouldn't be scattered across spreadsheets, chat messages, documents and disconnected tools. Paper5 helps bring your team's work and information together.
              </p>
            </div>

            <div className="problem-cards-grid reveal-stagger">
              {/* Problem 1 */}
              <div className="problem-card">
                <div className="problem-card-icon">
                  <FolderX size={24} />
                </div>
                <div className="problem-number">01</div>
                <h3>Scattered information</h3>
                <p>
                  Tasks in spreadsheets, documents in Drive, decisions in chat and important links buried in conversations.
                </p>
                <div className="problem-impact">
                  Context gets lost every time a team member switches tasks or a new contributor joins.
                </div>
              </div>

              {/* Problem 2 */}
              <div className="problem-card">
                <div className="problem-card-icon">
                  <ClockAlert size={24} />
                </div>
                <div className="problem-number">02</div>
                <h3>Unclear project progress</h3>
                <p>
                  Deadlines approach, blockers remain unresolved and nobody has a reliable picture of what is happening.
                </p>
                <div className="problem-impact">
                  Decisions are made on stale assumptions rather than live, verified deliverables.
                </div>
              </div>

              {/* Problem 3 */}
              <div className="problem-card">
                <div className="problem-card-icon">
                  <MessagesSquare size={24} />
                </div>
                <div className="problem-number">03</div>
                <h3>Too much coordination</h3>
                <p>
                  Constant meetings, manual updates and repeated status questions take time away from actual work.
                </p>
                <div className="problem-impact">
                  Founders and leads lose valuable hours asking "what is everyone working on right now?"
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. SECTION: CORE CAPABILITIES ── */}
        <section id="capabilities" className="capabilities-section">
          <div className="section-container">
            <div className="section-header">
              <h2 className="section-title">
                Everything your team needs to move projects forward.
              </h2>
              <p className="section-description">
                A connected workspace for planning, execution and project knowledge.
              </p>
            </div>

            <div className="capability-groups-stack">
              {/* Group 01: Project Execution */}
              <div className="capability-group-card reveal-on-scroll">
                <div className="capability-group-info">
                  <div className="group-number">01</div>
                  <h3 className="group-title">Project Execution</h3>
                  <p className="group-subtitle">Organise work and keep everyone aligned.</p>
                  <p className="group-desc">
                    Move projects from idea to delivery with structured clarity. Every task has a single owner, an explicit deadline, and peer verification to guarantee high-trust execution.
                  </p>
                  <ul className="capability-feature-list">
                    <li>
                      <CheckCircle2 size={16} />
                      <span><strong>Tasks and assignments:</strong> Clear single-owner accountability without vague group assignments.</span>
                    </li>
                    <li>
                      <CheckCircle2 size={16} />
                      <span><strong>Deadlines and milestones:</strong> Transparent deliverable dates with automatic notification alerts.</span>
                    </li>
                    <li>
                      <CheckCircle2 size={16} />
                      <span><strong>Sprint & workflow planning:</strong> Dynamic board layouts suited to your team size (Kanban, Scrum, Lean).</span>
                    </li>
                    <li>
                      <CheckCircle2 size={16} />
                      <span><strong>Blocker tracking:</strong> Immediate alert routing when tasks get stuck so teammates can swarm and resolve them.</span>
                    </li>
                    <li>
                      <CheckCircle2 size={16} />
                      <span><strong>Progress visibility:</strong> Live board states showing verified progress without status check-in meetings.</span>
                    </li>
                  </ul>
                </div>
                <div className="capability-group-visual visual-execution">
                  <div className="visual-card-preview">
                    <div className="visual-preview-header">
                      <span>Task Execution State</span>
                      <span className="pill-tag-verified">Proof of Work Verified</span>
                    </div>
                    <div className="visual-task-title">OAuth2 authentication flow & token refresh</div>
                    <div className="visual-task-owner-row">
                      <span className="avatar-sm">AM</span>
                      <div>
                        <div className="visual-owner-name">Alex Miller</div>
                        <div className="visual-owner-role">Lead Engineer • Due in 2 days</div>
                      </div>
                    </div>
                    <div className="visual-task-progress-box">
                      <div className="progress-label-row">
                        <span>Sprint 14 Completion</span>
                        <strong>75%</strong>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: '75%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Group 02: Project Knowledge */}
              <div className="capability-group-card reverse reveal-on-scroll">
                <div className="capability-group-info">
                  <div className="group-number">02</div>
                  <h3 className="group-title">Project Knowledge</h3>
                  <p className="group-subtitle">Keep important project information accessible.</p>
                  <p className="group-desc">
                    Never lose context in chat threads again. Paper5 preserves meeting notes, architectural decisions, and key project links right alongside the work they belong to.
                  </p>
                  <ul className="capability-feature-list">
                    <li>
                      <CheckCircle2 size={16} />
                      <span><strong>Documents and resources:</strong> Centralize design specs, product briefs and live resource links.</span>
                    </li>
                    <li>
                      <CheckCircle2 size={16} />
                      <span><strong>Meeting notes & sync digests:</strong> Record weekly syncs, action items and reflections in one permanent log.</span>
                    </li>
                    <li>
                      <CheckCircle2 size={16} />
                      <span><strong>Project decisions:</strong> Document architectural choices and trade-offs so context is preserved forever.</span>
                    </li>
                    <li>
                      <CheckCircle2 size={16} />
                      <span><strong>Shared project context:</strong> Ensure every contributor has immediate access to critical project history.</span>
                    </li>
                    <li>
                      <CheckCircle2 size={16} />
                      <span><strong>Vector PDF & CSV exports:</strong> Export printable workspace reports and audit trails with one click.</span>
                    </li>
                  </ul>
                </div>
                <div className="capability-group-visual visual-knowledge">
                  <div className="visual-card-preview">
                    <div className="visual-preview-header">
                      <span>Meeting Log & Decisions</span>
                      <span className="pill-tag-doc">Oct 28 Standup</span>
                    </div>
                    <div className="visual-doc-title">Sprint 14 Kickoff & Scope Lock</div>
                    <div className="visual-doc-bullets">
                      <div className="bullet-item">• Decided to lock sprint scope after Day 1 to eliminate mid-cycle creep.</div>
                      <div className="bullet-item">• GitHub webhook auto-close configured on pull request merge.</div>
                      <div className="bullet-item">• Client review scheduled for Friday 3:00 PM UTC.</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Group 03: Team & Development Visibility */}
              <div className="capability-group-card reveal-on-scroll">
                <div className="capability-group-info">
                  <div className="group-number">03</div>
                  <h3 className="group-title">Team & Development Visibility</h3>
                  <p className="group-subtitle">Understand what's happening across your team and connected tools.</p>
                  <p className="group-desc">
                    Bridge the gap between code and project management. Monitor contributor workload, inspect real pull request statuses, and keep external stakeholders informed.
                  </p>
                  <ul className="capability-feature-list">
                    <li>
                      <CheckCircle2 size={16} />
                      <span><strong>Team responsibilities:</strong> Transparent roster visibility showing each contributor's focus areas and workload.</span>
                    </li>
                    <li>
                      <CheckCircle2 size={16} />
                      <span><strong>GitHub integration:</strong> Direct PR linking, branch checks, and commit history tied directly to deliverables.</span>
                    </li>
                    <li>
                      <CheckCircle2 size={16} />
                      <span><strong>Development workflow visibility:</strong> Real-time understanding of what is coded, tested, and ready to ship.</span>
                    </li>
                    <li>
                      <CheckCircle2 size={16} />
                      <span><strong>Connected external services:</strong> Webhooks to Slack & Discord plus native Google Calendar sync.</span>
                    </li>
                    <li>
                      <CheckCircle2 size={16} />
                      <span><strong>1-Click REST API Studio:</strong> Provision API keys (`sp_live_...`) to automate custom CI/CD pipelines.</span>
                    </li>
                  </ul>
                </div>
                <div className="capability-group-visual visual-visibility">
                  <div className="visual-card-preview">
                    <div className="visual-preview-header">
                      <span>Developer Stack Sync</span>
                      <span className="pill-tag-active">Live Webhook</span>
                    </div>
                    <div className="visual-tool-status-row">
                      <div className="tool-status-item">
                        <span className="tool-badge-pill"><FolderGit2 size={13} color="#2563eb" /> GitHub</span>
                        <span>PR #42 (Merged)</span>
                      </div>
                      <div className="tool-status-item">
                        <span className="tool-badge-pill"><MessageSquare size={13} color="#059669" /> Slack</span>
                        <span>#team-alerts (Digest Sent)</span>
                      </div>
                      <div className="tool-status-item">
                        <span className="tool-badge-pill"><Calendar size={13} color="#d97706" /> Calendar</span>
                        <span>Sunday Sync (Synced)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. SECTION: CONNECTED WORKSPACE ── */}
        <section className="connected-workspace-section">
          <div className="section-container">
            <div className="section-header">
              <h2 className="section-title">
                Keep your existing tools. Bring your project together.
              </h2>
              <p className="section-description">
                Your team already has tools it relies on. Paper5 is designed to bring relevant project information together without forcing you to abandon your existing workflows.
              </p>
            </div>

            <div className="integrations-card-grid reveal-stagger">
              {/* GitHub */}
              <div className="integration-box">
                <div className="integration-box-head">
                  <div className="integration-icon-wrap"><FolderGit2 size={24} color="#0f172a" /></div>
                  <span className="integration-status live">Live & Native</span>
                </div>
                <h3>GitHub</h3>
                <p>
                  Link pull requests, track commits, and surface CI check runs directly on sprint tasks with automated task closing.
                </p>
                <div className="integration-meta">Available on all plans</div>
              </div>

              {/* Slack */}
              <div className="integration-box">
                <div className="integration-box-head">
                  <div className="integration-icon-wrap"><MessageSquare size={24} color="#0f172a" /></div>
                  <span className="integration-status live">Live Webhook</span>
                </div>
                <h3>Slack</h3>
                <p>
                  Mirror blocker alerts, review requests and weekly standup reflections directly into your chosen team channels.
                </p>
                <div className="integration-meta">Incoming webhook sync</div>
              </div>

              {/* Discord */}
              <div className="integration-box">
                <div className="integration-box-head">
                  <div className="integration-icon-wrap"><MessagesSquare size={24} color="#0f172a" /></div>
                  <span className="integration-status live">Live Webhook</span>
                </div>
                <h3>Discord</h3>
                <p>
                  Broadcast milestone accomplishments and real-time blocker warnings into your Discord developer channels.
                </p>
                <div className="integration-meta">Incoming webhook sync</div>
              </div>

              {/* Google Calendar */}
              <div className="integration-box">
                <div className="integration-box-head">
                  <div className="integration-icon-wrap"><Calendar size={24} color="#0f172a" /></div>
                  <span className="integration-status live">Live & Native</span>
                </div>
                <h3>Google Calendar</h3>
                <p>
                  Sync meeting notes, sprint planning schedules and milestone deadlines natively using Google Identity Services.
                </p>
                <div className="integration-meta">Token-based GIS integration</div>
              </div>

              {/* 1-Click REST API */}
              <div className="integration-box">
                <div className="integration-box-head">
                  <div className="integration-icon-wrap"><Zap size={24} color="#0f172a" /></div>
                  <span className="integration-status live">Live & Native</span>
                </div>
                <h3>1-Click REST API Studio</h3>
                <p>
                  Generate live API keys (`sp_live_...`) to update task states, trigger automated reviews, and fetch metrics from your custom scripts.
                </p>
                <div className="integration-meta">cURL, Node.js & Python snippets</div>
              </div>

              {/* Roadmap Integrations */}
              <div className="integration-box planned">
                <div className="integration-box-head">
                  <div className="integration-icon-wrap"><Rocket size={24} color="#0f172a" /></div>
                  <span className="integration-status roadmap">On Roadmap</span>
                </div>
                <h3>Figma & Linear</h3>
                <p>
                  Bi-directional synchronization for product design frames, issue imports, and cross-platform task alignment.
                </p>
                <div className="integration-meta">Approved future roadmap</div>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '36px' }}>
              <Link to="/product-integrations" className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <span>View Full Integrations Documentation</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── 6. SECTION: HOW IT WORKS ── */}
        <section className="how-it-works-section">
          <div className="section-container">
            <div className="section-header">
              <h2 className="section-title">
                Get your team organised in minutes.
              </h2>
              <p className="section-description">
                A friction-free setup designed for small teams that need to focus on building, not tool management.
              </p>
            </div>

            <div className="how-it-works-steps-grid reveal-stagger">
              {/* Step 1 */}
              <div className="step-card">
                <span className="step-index">01</span>
                <h3>Create your workspace</h3>
                <p>
                  Set up your team, choose your workflow methodology (Kanban, Scrum, or Lean), and create your first project.
                </p>
              </div>

              {/* Step 2 */}
              <div className="step-card">
                <span className="step-index">02</span>
                <h3>Organise your work</h3>
                <p>
                  Bring together tasks, deadlines, responsibilities and project information in structured, transparent boards.
                </p>
              </div>

              {/* Step 3 */}
              <div className="step-card">
                <span className="step-index">03</span>
                <h3>Connect your tools</h3>
                <p>
                  Connect supported integrations like GitHub, Slack, or Google Calendar to bring relevant information into your workspace.
                </p>
              </div>

              {/* Step 4 */}
              <div className="step-card">
                <span className="step-index">04</span>
                <h3>Move projects forward</h3>
                <p>
                  Keep your team aligned, resolve blockers as soon as they arise, and always understand what needs attention next.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 7. SECTION: WHO IS PAPER5 FOR? ── */}
        <section className="audience-section">
          <div className="section-container">
            <div className="section-header">
              <h2 className="section-title">
                Built for teams that build things together.
              </h2>
              <p className="section-description">
                Designed to support small, agile teams through their most critical growth phases.
              </p>
            </div>

            <div className="audience-cards-grid reveal-stagger">
              {/* Audience 1 */}
              <div className="audience-card">
                <div className="audience-icon-wrap">
                  <Compass size={24} />
                </div>
                <h3>Early-stage startups</h3>
                <p>
                  Keep your projects organised while your team grows. Move fast with clear ownership, transparent sprints, and central project knowledge without drowning in spreadsheets.
                </p>
                <div className="audience-highlight">
                  Ideal for 2 to 10 person founding teams moving from MVP to launch.
                </div>
              </div>

              {/* Audience 2 */}
              <div className="audience-card">
                <div className="audience-icon-wrap">
                  <Code2 size={24} />
                </div>
                <h3>Small software teams</h3>
                <p>
                  Coordinate tasks, deadlines and development work without unnecessary overhead. Keep GitHub PRs, sprint iterations, and architectural choices connected to project goals.
                </p>
                <div className="audience-highlight">
                  Ideal for developer squads wanting lightweight Agile tracking.
                </div>
              </div>

              {/* Audience 3 */}
              <div className="audience-card">
                <div className="audience-icon-wrap">
                  <Users size={24} />
                </div>
                <h3>Independent teams and agencies</h3>
                <p>
                  Keep client projects, responsibilities and important information organised. Share verifiable deliverables, manage milestone deadlines, and export clean PDF reports.
                </p>
                <div className="audience-highlight">
                  Ideal for client-facing teams requiring clear proof-of-work delivery.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 8. SECTION: PRICING ── */}
        <section id="pricing" className="pricing-section">
          <div className="section-container">
            <div className="section-header">
              <h2 className="section-title">
                Simple, transparent pricing. 100% free during launch.
              </h2>
              <p className="section-description">
                Experience the complete connected workspace with all features unlocked during our launch period. No credit card required. Pick the plan that fits your team.
              </p>
            </div>

            <div className="pricing-grid reveal-stagger">
              {/* Starter Tier */}
              <div className="pricing-card">
                <div className="tier-header">
                  <div className="tier-name">Starter</div>
                  <p className="tier-target">For solo founders and tiny indie teams testing the waters.</p>
                </div>
                <div className="tier-price-box">
                  <span className="amount">Free</span>
                  <span className="period">/ forever</span>
                </div>
                <button 
                  className="btn-ghost w-full"
                  onClick={() => handlePlanClick('starter')}
                >
                  Get Started for Free
                </button>
                <ul className="tier-features">
                  <li><strong>1</strong> Workspace</li>
                  <li>Up to <strong>3</strong> Team Members</li>
                  <li>Core Agile Workflows (Kanban & Ad-hoc)</li>
                  <li>GitHub Repository Sync</li>
                  <li>Personal Focus Dashboard</li>
                  <li>Basic Sprint & Deadline Tracking</li>
                  <li>Community Support</li>
                </ul>
              </div>

              {/* Team Tier (Recommended) */}
              <div className="pricing-card recommended">
                <div className="recommended-badge">Recommended • Launch Special</div>
                <div className="tier-header">
                  <div className="tier-name">Team</div>
                  <p className="tier-target">For growing startups that need to collaborate and integrate their stack.</p>
                </div>
                <div className="tier-price-box">
                  <span className="currency">₹</span>
                  <span className="amount">0</span>
                  <span className="period">/ month during launch</span>
                </div>
                <button 
                  className="btn-primary w-full"
                  onClick={() => handlePlanClick('team')}
                >
                  Get Started for Free
                </button>
                <ul className="tier-features">
                  <li>Up to <strong>5</strong> Workspaces</li>
                  <li>Up to <strong>7</strong> Team Members</li>
                  <li>Advanced Agile Workflows (Scrum, XP, Lean, Scrumban)</li>
                  <li>GitHub & Google Calendar Integrations</li>
                  <li>Locked Sprint Scope Control</li>
                  <li>Proof of Work Peer Verification</li>
                  <li>Meeting Notes & Sunday Sync Digest</li>
                  <li>Instant Blocker Email & Slack Notifications</li>
                </ul>
              </div>

              {/* Scale Tier */}
              <div className="pricing-card">
                <div className="tier-header">
                  <div className="tier-name">Scale</div>
                  <p className="tier-target">For teams requiring advanced integrations, automation, and larger scale.</p>
                </div>
                <div className="tier-price-box">
                  <span className="currency">₹</span>
                  <span className="amount">0</span>
                  <span className="period">/ month during launch</span>
                </div>
                <button 
                  className="btn-ghost w-full"
                  onClick={() => handlePlanClick('scale')}
                >
                  Get Started for Free
                </button>
                <ul className="tier-features">
                  <li>Up to <strong>10</strong> Workspaces</li>
                  <li><strong>Unlimited</strong> Team Members</li>
                  <li>All <strong>8</strong> Agile Workflows (Spotify Model & SAFe Enterprise)</li>
                  <li>All Stack Integrations (GitHub, Slack, Discord, Calendar, Vercel)</li>
                  <li>1-Click REST API Studio (`sp_live_...`)</li>
                  <li>Vector Printable PDF Workspace Reports & CSV Audit Trail</li>
                  <li>Advanced Team Velocity & Risk Analytics</li>
                  <li>Priority Developer Support</li>
                </ul>
              </div>
            </div>

            <div className="pricing-footnote">
              * During our launch phase, all plans are available at ₹0/month to help small teams get organized without upfront cost. Plan limits are enforced in the app to guarantee optimal performance.
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
      <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />
    </div>
  )
}
