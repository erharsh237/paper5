import React, { useState, useEffect, useRef } from 'react'
import { useScrollReveal } from '../hooks/useScrollReveal'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import MarketingNav from '../components/MarketingNav'
import MarketingFooter from '../components/MarketingFooter'
import AetherFlowHero from '../components/AetherFlowHero'
import SEOHead from '../components/SEOHead'
import AlertModal from '../components/ui/AlertModal'
import ContactModal from '../components/ContactModal'
import { getAppUrl } from '../lib/domain'
import { trackEvent } from '../lib/metrics'
import { smoothScrollTo, scrollToHome, scrollToPricing } from '../lib/smoothScroll'
import { 
  ArrowRight, 
  Check, 
  X,
  Layers, 
  Clock, 
  AlertTriangle, 
  GitPullRequest, 
  Calendar, 
  Users, 
  ShieldCheck, 
  Zap,
  Rocket, 
  CheckCircle2, 
  Lock, 
  ChevronDown, 
  AlertCircle, 
  Eye, 
  Terminal, 
  HelpCircle, 
  Download, 
  Shield, 
  Database, 
  Activity, 
  Sliders, 
  TrendingUp,
  MessageSquare
} from 'lucide-react'
import './Landing.css'

// ============================================================================
// PRICING CONFIGURATION
// ============================================================================
const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    target: 'For solo developers and small squads establishing initial sprint cadence.',
    futurePrice: null,
    period: 'Free forever plan',
    launchPrice: '₹0',
    popular: false,
    ctaText: 'Start for Free',
    features: [
      '1 Active Workspace',
      'Up to 3 squad members',
      '2 Agile Workflows (Ad-hoc, Kanban)',
      'Google Calendar Sync & Meeting Notes',
      'Personal focus dashboard & Sprint tracking',
      'Community developer support'
    ]
  },
  team: {
    id: 'team',
    name: 'Team',
    target: 'For growing product squads that need clear ownership, risk radar, and automated sync.',
    futurePrice: '₹200',
    period: '/ month after launch',
    launchPrice: '₹0',
    popular: true,
    ctaText: 'Claim Team Access',
    features: [
      'Everything in Starter, plus:',
      'Up to 5 workspaces and 7 squad members',
      '6 Agile Workflows (Kanban, Scrum, XP, Lean, Scrumban)',
      'Google Calendar & GitHub PR Sync',
      'Locked sprint boundary control & peer verification',
      'Connected meeting decisions & sync digests'
    ]
  },
  scale: {
    id: 'scale',
    name: 'Pro',
    target: 'For multi-squad teams requiring custom methodologies, audit reporting, and API access.',
    futurePrice: '₹500',
    period: '/ month after launch',
    launchPrice: '₹0',
    popular: false,
    ctaText: 'Claim Pro Access',
    features: [
      'Everything in Team, plus:',
      'Up to 10 workspaces & unlimited squad members',
      'All 8 Agile Workflows (Spotify Squads, SAFe Enterprise)',
      'All Integrations (Google Calendar, GitHub, Slack, Discord, Vercel)',
      '1-Click API Webhooks & REST Sync Studio',
      'Compliance audit logs & CSV export',
      'Priority developer support'
    ]
  }
}

export default function Landing() {
  useScrollReveal()
  const [alertMessage, setAlertMessage] = useState(null)
  const [isContactOpen, setIsContactOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)
  const [activeFeatureTab, setActiveFeatureTab] = useState('github')
  const [mobileActivePillar, setMobileActivePillar] = useState(0)
  const [activeOriginIndex, setActiveOriginIndex] = useState(0)
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const pricingTrackedRef = useRef(false)

  useEffect(() => {
    if (pricingTrackedRef.current) return
    const firePricingView = () => {
      if (pricingTrackedRef.current) return
      const pricingEl = document.getElementById('pricing')
      if (pricingEl) {
        const rect = pricingEl.getBoundingClientRect()
        if (rect.top < window.innerHeight && rect.bottom >= 0) {
          trackEvent('pricing_view', { source: 'landing_scroll' })
          pricingTrackedRef.current = true
        }
      }
    }
    window.addEventListener('scroll', firePricingView, { passive: true })
    firePricingView()
    return () => window.removeEventListener('scroll', firePricingView)
  }, [])

  const handleGetStarted = (planId = 'team') => {
    trackEvent('get_started_click', { plan: planId, source: 'landing_hero' })
    window.open(getAppUrl('/signup'), '_blank', 'noopener,noreferrer')
  }

  const handlePlanClick = (planId) => {
    trackEvent('pricing_plan_click', { plan: planId, source: 'landing_pricing' })
    window.open(getAppUrl(`/signup?plan=${planId}`), '_blank', 'noopener,noreferrer')
  }

  const scrollToSection = (e, sectionId) => {
    if (e) e.preventDefault()
    smoothScrollTo(sectionId, { offset: -84, duration: 850 })
    window.history.pushState('', document.title, `#${sectionId}`)
  }

  useEffect(() => {
    const isPricingTarget = location.pathname === '/pricing' || location.hash === '#pricing'
    const targetId = isPricingTarget ? 'pricing' : (location.hash ? location.hash.replace('#', '') : null)

    if (targetId) {
      const timer = setTimeout(() => {
        smoothScrollTo(targetId, { offset: -84, duration: 900 })
      }, 120)
      return () => clearTimeout(timer)
    }
  }, [location.pathname, location.hash])

  const toggleFaq = (index) => {
    setOpenFaq(prev => (prev === index ? -1 : index))
  }

  const featureTabs = [
    { id: 'github', label: 'GitHub Auto-Sync', icon: GitPullRequest },
    { id: 'scope', label: 'Sprint Boundary Control', icon: Lock },
    { id: 'owner', label: 'Single Ownership', icon: ShieldCheck },
    { id: 'radar', label: 'Roadblock Radar', icon: Activity }
  ]

  const faqs = [
    {
      question: "What is Paper5?",
      answer: "Paper5 is a project management and team workflow platform built for small engineering teams. It unites sprint planning, single-owner deliverables, roadblock notifications, and native GitHub development into one synchronized workspace."
    },
    {
      question: "How does GitHub synchronization work?",
      answer: "Paper5 connects directly to your GitHub repositories. When pull requests merge, linked sprint deliverables automatically advance to completed status with test logs and deploy staging links attached."
    },
    {
      question: "Why does Paper5 enforce single-owner deliverables?",
      answer: "Shared tickets with multiple assignees create bystander apathy and missed deadlines. Paper5 requires exactly one engineer per deliverable, ensuring unambiguous ownership and direct responsibility for shipping."
    },
    {
      question: "What happens when the public launch period ends?",
      answer: "All accounts created during the public launch will receive at least 30 days advance notice before any pricing changes take effect, with the option to remain on a grandfathered free tier."
    },
    {
      question: "How is our team data secured?",
      answer: "Your projects are stored in PostgreSQL protected by Row-Level Security (RLS) policies at the database layer. All data is encrypted with AES-256 at rest and TLS 1.3 in transit, with optional TOTP two-factor authentication."
    }
  ]

  const isPricingRoute = location.pathname === '/pricing'

  return (
    <div className="landing-page">
      <SEOHead 
        title={isPricingRoute ? "Pricing | Paper5" : "Paper5 | Project Management Software for Small Teams & Startups"} 
        description={
          isPricingRoute
            ? "Compare Paper5 Starter, Team, and Scale plans. Free forever tier available with core sprint and team task management, single ownership accountability, and GitHub sync."
            : "Paper5 is the connected project management software for small teams and startups. Organize daily tasks, automate sprint tracking with GitHub sync, and maintain team accountability without coordination drag."
        }
        canonicalUrl={isPricingRoute ? "https://paper5.co/pricing" : "https://paper5.co/"}
      />
      <MarketingNav />

      <main>
        {/* ════════════════════════════════════════════════════════════════
            1. HERO SECTION (DARK)
            Aether Flow Interactive Constellation Particle Mesh
            ════════════════════════════════════════════════════════════════ */}
        <AetherFlowHero 
          onGetStarted={() => handleGetStarted('team')}
          onExplore={(e) => scrollToSection(e, 'origin')}
        />

        

        {/* ════════════════════════════════════════════════════════════════
            3. PROBLEM & OUTCOME SECTION (DARK)
            "Less Chasing. More Building." — Operational Shift Comparison
            ════════════════════════════════════════════════════════════════ */}
        
        {/* ════════════════════════════════════════════════════════════════
            2. THE ORIGIN & PURPOSE SECTION (DARK)
            "Why We Built Paper5"
            ════════════════════════════════════════════════════════════════ */}
        <section id="origin" className="origin-purpose-section" aria-label="Origin and Purpose">
          <div className="section-container">
            <div className="origin-header">
              <span className="origin-kicker">THE ORIGIN AND PURPOSE</span>
              <h2 className="origin-title">Why We Built Paper5</h2>
            </div>

            {/* Mobile Tab Switcher */}
            <div className="origin-mobile-tabs mobile-only" role="tablist" aria-label="Origin Story Beats">
              <button 
                type="button"
                role="tab"
                aria-selected={activeOriginIndex === 0}
                className={`origin-tab-btn ${activeOriginIndex === 0 ? 'active' : ''}`}
                onClick={() => setActiveOriginIndex(0)}
              >
                <span className="origin-tab-dot disconnect-dot" />
                <span>The Disconnect</span>
              </button>
              <button 
                type="button"
                role="tab"
                aria-selected={activeOriginIndex === 1}
                className={`origin-tab-btn ${activeOriginIndex === 1 ? 'active' : ''}`}
                onClick={() => setActiveOriginIndex(1)}
              >
                <span className="origin-tab-dot breaking-dot" />
                <span>The Breaking Point</span>
              </button>
              <button 
                type="button"
                role="tab"
                aria-selected={activeOriginIndex === 2}
                className={`origin-tab-btn ${activeOriginIndex === 2 ? 'active' : ''}`}
                onClick={() => setActiveOriginIndex(2)}
              >
                <span className="origin-tab-dot resolution-dot" />
                <span>The Resolution</span>
              </button>
            </div>

            <div className="origin-narrative-grid">
              {/* Column 1: The Disconnect */}
              <div className={`origin-column disconnect ${activeOriginIndex === 0 ? 'mobile-visible' : 'mobile-hidden'}`}>
                <div className="origin-column-rule disconnect-rule" />
                <span className="origin-column-kicker disconnect-kicker">THE DISCONNECT</span>
                <h3 className="origin-column-title">Work was scattered across disconnected tools</h3>
                <p className="origin-column-text">
                  Our sprints lived in spreadsheets, architecture debates in chat threads, and pull request links in direct messages. Every handoff lost vital context and slowed team velocity.
                </p>
              </div>

              {/* Column 2: The Breaking Point */}
              <div className={`origin-column breaking-point ${activeOriginIndex === 1 ? 'mobile-visible' : 'mobile-hidden'}`}>
                <div className="origin-column-rule breaking-point-rule" />
                <span className="origin-column-kicker breaking-point-kicker">THE BREAKING POINT</span>
                <h3 className="origin-column-title">Diffuse ownership caused silent deadline slips</h3>
                <p className="origin-column-text">
                  Deliverables were vaguely assigned to the whole squad, so nobody took personal accountability. Sprints slipped quietly while daily status meetings drained engineering focus.
                </p>
              </div>

              {/* Column 3: The Resolution */}
              <div className={`origin-column resolution ${activeOriginIndex === 2 ? 'mobile-visible' : 'mobile-hidden'}`}>
                <div className="origin-column-rule resolution-rule" />
                <span className="origin-column-kicker resolution-kicker">THE RESOLUTION</span>
                <h3 className="origin-column-title">One synchronized workspace with single ownership</h3>
                <p className="origin-column-text">
                  We created Paper5 to bring task planning, meeting decisions, and GitHub development into one unified system with strict single owner clarity and instant blocker visibility.
                </p>
              </div>
            </div>

            {/* Mobile Swipe / Step Dots */}
            <div className="origin-mobile-dots mobile-only" aria-hidden="true">
              <button type="button" aria-label="Step 1" className={`origin-dot ${activeOriginIndex === 0 ? 'active' : ''}`} onClick={() => setActiveOriginIndex(0)} />
              <button type="button" aria-label="Step 2" className={`origin-dot ${activeOriginIndex === 1 ? 'active' : ''}`} onClick={() => setActiveOriginIndex(1)} />
              <button type="button" aria-label="Step 3" className={`origin-dot ${activeOriginIndex === 2 ? 'active' : ''}`} onClick={() => setActiveOriginIndex(2)} />
            </div>
          </div>
        </section>

        <section id="problem" className="editorial-pillars-section" aria-label="Core Operational Shift">
          <div className="section-container">
            <div className="section-header pillars-section-header">
              <span className="section-kicker">PROBLEM & OUTCOME</span>
              <h2 className="section-title">Less Chasing. More Building.</h2>
              <p className="section-description">
                Eliminate status roundtables, manual ticket triage, and diffuse accountability. Replace coordination drag with direct single ownership and automated visibility.
              </p>
            </div>

            {/* Mobile Pillar Switcher Tabs */}
            <div className="pillars-mobile-tabs mobile-only" role="tablist" aria-label="Operational Pillars">
              <button 
                type="button"
                role="tab"
                aria-selected={mobileActivePillar === 0}
                className={`pillar-tab-btn ${mobileActivePillar === 0 ? 'active' : ''}`}
                onClick={() => setMobileActivePillar(0)}
              >
                <Eye size={15} />
                <span>Clarity & Alignment</span>
              </button>
              <button 
                type="button"
                role="tab"
                aria-selected={mobileActivePillar === 1}
                className={`pillar-tab-btn ${mobileActivePillar === 1 ? 'active' : ''}`}
                onClick={() => setMobileActivePillar(1)}
              >
                <Rocket size={15} />
                <span>Execution & Speed</span>
              </button>
            </div>

            <div className="pillars-grid">
              {/* Left Pillar: Clarity & Alignment */}
              <div className={`pillar-column ${mobileActivePillar === 0 ? 'mobile-visible' : 'mobile-hidden'}`}>
                <div className="desktop-only">
                  <span className="pillar-kicker">CLARITY & ALIGNMENT</span>
                  <h2 className="pillar-title">Know the Score Without Asking</h2>
                  <div className="pillar-rule" />
                </div>

                <div className="pillar-items">
                  <div className="pillar-item">
                    <div className="pillar-icon-box">
                      <Eye size={17} />
                    </div>
                    <div className="pillar-text">
                      <h3>Instant Roster Visibility</h3>
                      <p>See live active tasks, verified deliverables, and owners across the squad without interrupting engineers with status questions.</p>
                    </div>
                  </div>

                  <div className="pillar-item">
                    <div className="pillar-icon-box">
                      <Clock size={17} />
                    </div>
                    <div className="pillar-text">
                      <h3>Eliminate Coordination Roundtables</h3>
                      <p>Replace 30-minute status roundtables and daily standup roll-calls with a transparent command center that always mirrors reality.</p>
                    </div>
                  </div>

                  <div className="pillar-item">
                    <div className="pillar-icon-box">
                      <ShieldCheck size={17} />
                    </div>
                    <div className="pillar-text">
                      <h3>True Ownership & Pride in Shipping</h3>
                      <p>Every deliverable has one explicit owner who feels pride and clear responsibility for submitting verified proof of work.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Pillar: Execution & Speed */}
              <div className={`pillar-column ${mobileActivePillar === 1 ? 'mobile-visible' : 'mobile-hidden'}`}>
                <div className="desktop-only">
                  <span className="pillar-kicker">EXECUTION & SPEED</span>
                  <h2 className="pillar-title">Build Faster With Zero Drag</h2>
                  <div className="pillar-rule" />
                </div>

                <div className="pillar-items">
                  <div className="pillar-item">
                    <div className="pillar-icon-box">
                      <AlertTriangle size={17} />
                    </div>
                    <div className="pillar-text">
                      <h3>Identify Bottlenecks Days Earlier</h3>
                      <p>Flagged blockers broadcast instant notifications so teammates can swarm and resolve obstacles days before release deadlines.</p>
                    </div>
                  </div>

                  <div className="pillar-item">
                    <div className="pillar-icon-box">
                      <Layers size={17} />
                    </div>
                    <div className="pillar-text">
                      <h3>Unified Tasks, Specs & GitHub Code</h3>
                      <p>Architecture decisions, standup digests, and GitHub pull requests live together so vital context is never lost across disjointed tools.</p>
                    </div>
                  </div>

                  <div className="pillar-item">
                    <div className="pillar-icon-box">
                      <Rocket size={17} />
                    </div>
                    <div className="pillar-text">
                      <h3>Spend Time Executing, Not Managing</h3>
                      <p>Reclaim hours every week to build, design, test, and ship software that delivers real customer value.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            4. CORE CAPABILITIES SECTION (LIGHT)
            "Code Merges. Tasks Close." — Tabbed Platform Showcase (No Carousel)
            ════════════════════════════════════════════════════════════════ */}
        <section id="features" className="features-showcase-section ">
          <div className="section-container">
            <div className="section-header features-compact-header">
              <span className="section-kicker">CORE PLATFORM CAPABILITIES</span>
              <h2 className="section-title">
                Code Merges. Tasks Close.
              </h2>
              <p className="section-description">
                Engineers work in their terminal and Git branches. Pull requests advance sprint deliverables automatically with staging proof attached.
              </p>
            </div>

            {/* Static Clean Tab Navigation */}
            <div className="features-tab-nav" role="tablist" aria-label="Feature Tabs">
              {featureTabs.map((tab) => {
                const IconComponent = tab.icon
                const isActive = activeFeatureTab === tab.id
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={isActive}
                    aria-controls={`panel-${tab.id}`}
                    className={`feature-tab-btn ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveFeatureTab(tab.id)}
                  >
                    <IconComponent size={16} />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Tabbed Interactive Feature Viewport */}
            <div className="features-tab-content">
              {/* Tab 1: GitHub Auto-Sync */}
              {activeFeatureTab === 'github' && (
                <div className="feature-panel-card" role="tabpanel" id="panel-github" aria-labelledby="tab-github">
                  <div className="panel-narrative">
                    <span className="panel-kicker">GITHUB NATIVE SYNCHRONIZATION</span>
                    <h3 className="panel-title">Your Code is the Source of Truth.</h3>
                    <p className="panel-desc">
                      Link branch commits and pull requests directly to sprint goals so deliverables close the moment code merges into staging.
                    </p>
                    <div className="panel-benefits-list">
                      <div className="panel-benefit-row">
                        <Check size={16} className="text-accent" />
                        <span>Automatic deliverable state changes when PRs are approved and merged.</span>
                      </div>
                      <div className="panel-benefit-row">
                        <Check size={16} className="text-accent" />
                        <span>Staging preview links and CI test summaries recorded automatically.</span>
                      </div>
                    </div>
                  </div>

                  <div className="panel-preview-visual">
                    <div className="visual-terminal-box">
                      <div className="terminal-header">
                        <div className="terminal-dots">
                          <span className="dot red" />
                          <span className="dot yellow" />
                          <span className="dot green" />
                        </div>
                        <span className="terminal-title">git status & paper5 webhook</span>
                      </div>
                      <div className="terminal-body">
                        <div className="term-line"><span className="term-cmd">$ git checkout</span> -b feat/payment-webhooks</div>
                        <div className="term-line"><span className="term-cmd">$ git commit</span> -m "feat: handle stripe webhook idempotency"</div>
                        <div className="term-line term-success"><Check size={12} /> Pull Request #142 opened: Ready for review</div>
                        <div className="term-line term-highlight">
                          <span className="term-badge">PAPER5 SYNC</span> Deliverable #del_pay_42 linked & updated
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Sprint Scope Control */}
              {activeFeatureTab === 'scope' && (
                <div className="feature-panel-card" role="tabpanel" id="panel-scope" aria-labelledby="tab-scope">
                  <div className="panel-narrative">
                    <span className="panel-kicker">SPRINT BOUNDARY CONTROL</span>
                    <h3 className="panel-title">Lock Sprint Scope. Defend Engineering Focus.</h3>
                    <p className="panel-desc">
                      Committed deliverables lock once a sprint kicks off. New requests automatically queue for the next cycle instead of interrupting active development.
                    </p>
                    <div className="panel-benefits-list">
                      <div className="panel-benefit-row">
                        <Check size={16} className="text-accent" />
                        <span>Prevent mid-cycle scope expansion and unplanned interruptions.</span>
                      </div>
                      <div className="panel-benefit-row">
                        <Check size={16} className="text-accent" />
                        <span>Dedicated backlog intake keeps active sprint velocity predictable.</span>
                      </div>
                    </div>
                  </div>

                  <div className="panel-preview-visual">
                    <div className="visual-surface-box">
                      <div className="surface-header">
                        <div className="surface-title"><Lock size={14} /> Active Sprint Boundary</div>
                        <span className="surface-status-tag">Locked</span>
                      </div>
                      <div className="surface-body">
                        <div className="surface-task-item">
                          <span className="task-dot active" />
                          <span className="task-name">Payment Webhook Processing</span>
                          <span className="task-owner">Alex Chen</span>
                        </div>
                        <div className="surface-task-item">
                          <span className="task-dot" />
                          <span className="task-name">Database Index Optimization</span>
                          <span className="task-owner">Sarah Lin</span>
                        </div>
                        <div className="surface-queue-alert">
                          <AlertCircle size={14} />
                          <span>Mid-cycle stakeholder request automatically queued for Sprint 14</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Single Ownership */}
              {activeFeatureTab === 'owner' && (
                <div className="feature-panel-card" role="tabpanel" id="panel-owner" aria-labelledby="tab-owner">
                  <div className="panel-narrative">
                    <span className="panel-kicker">ACCOUNTABLE EXECUTION</span>
                    <h3 className="panel-title">One Accountable Owner Per Deliverable.</h3>
                    <p className="panel-desc">
                      Diffuse multi-assignee tickets are eliminated. Every deliverable specifies a single responsible engineer who attaches staging test proof.
                    </p>
                    <div className="panel-benefits-list">
                      <div className="panel-benefit-row">
                        <Check size={16} className="text-accent" />
                        <span>Clear personal responsibility prevents bystander apathy.</span>
                      </div>
                      <div className="panel-benefit-row">
                        <Check size={16} className="text-accent" />
                        <span>Definition of done requires verified test and preview evidence.</span>
                      </div>
                    </div>
                  </div>

                  <div className="panel-preview-visual">
                    <div className="visual-surface-box">
                      <div className="surface-header">
                        <div className="surface-title"><ShieldCheck size={14} /> Deliverable Sign-Off</div>
                        <span className="surface-status-tag green">Ready to Close</span>
                      </div>
                      <div className="surface-body">
                        <div className="surface-owner-row">
                          <span className="owner-label">Single Owner:</span>
                          <span className="owner-val">Elena Rostova</span>
                        </div>
                        <div className="surface-checklist">
                          <div className="check-row"><Check size={13} color="#16a34a" /> CI Automated test suite passing (14/14)</div>
                          <div className="check-row"><Check size={13} color="#16a34a" /> Staging environment preview verified</div>
                          <div className="check-row"><Check size={13} color="#16a34a" /> Architecture PR merged by tech lead</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Roadblock Radar */}
              {activeFeatureTab === 'radar' && (
                <div className="feature-panel-card" role="tabpanel" id="panel-radar" aria-labelledby="tab-radar">
                  <div className="panel-narrative">
                    <span className="panel-kicker">PROACTIVE RISK DETECTION</span>
                    <h3 className="panel-title">Spot Roadblocks Days Ahead. Predictable Releases.</h3>
                    <p className="panel-desc">
                      Flagged blockers immediately broadcast notifications across the squad so teammates swarm and resolve obstacles long before release deadlines.
                    </p>
                    <div className="panel-benefits-list">
                      <div className="panel-benefit-row">
                        <Check size={16} className="text-accent" />
                        <span>Elevate stalled dependencies and third-party API issues instantly.</span>
                      </div>
                      <div className="panel-benefit-row">
                        <Check size={16} className="text-accent" />
                        <span>Maintain release confidence without surprising stakeholders on launch day.</span>
                      </div>
                    </div>
                  </div>

                  <div className="panel-preview-visual">
                    <div className="visual-surface-box">
                      <div className="surface-header">
                        <div className="surface-title"><Activity size={14} /> Sprint Health Radar</div>
                        <span className="surface-status-tag amber">1 Blocked Item</span>
                      </div>
                      <div className="surface-body">
                        <div className="surface-radar-alert">
                          <div className="alert-head">
                            <AlertTriangle size={14} color="#d97706" />
                            <strong>Stripe Webhook Rate Limit Dependency</strong>
                          </div>
                          <p>Alex Chen flagged a rate limit block. Squad teammates notified to swarm API credentials.</p>
                        </div>
                        <div className="surface-metric-pills">
                          <div className="metric-pill"><span className="label">Pace</span> <span className="val">On Track</span></div>
                          <div className="metric-pill"><span className="label">Confidence</span> <span className="val">High</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            5. ONBOARDING WORKFLOW SECTION (DARK)
            "Up and Running in Under Two Minutes." — The ONE setup-time claim
            ════════════════════════════════════════════════════════════════ */}
        <section id="how-it-works" className="how-it-works-section ">
          <div className="section-container">
            <div className="section-header">
              <span className="section-kicker">ONBOARDING PIPELINE</span>
              <h2 className="section-title">
                Up and Running in Under Two Minutes.
              </h2>
              <p className="section-description">
                A streamlined, friction-free deployment designed for small engineering teams that prioritize shipping over tool maintenance.
              </p>
            </div>

            <div className="workflow-cards-grid ">
              {/* Card 1: Workspace & Agile Cadence */}
              <div className="workflow-card">
                <div className="workflow-card-top">
                  <div className="workflow-card-icon">
                    <Sliders size={17} />
                  </div>
                  <span className="workflow-card-phase">WORKSPACE CONFIGURATION</span>
                </div>
                <div className="workflow-card-content">
                  <h3>Select Team Cadence</h3>
                  <p>
                    Deploy your squad environment with pre-calibrated sprint cycles and automated WIP constraints.
                  </p>
                </div>
                <div className="workflow-micro-ui">
                  <div className="micro-ui-header">
                    <span className="micro-label">Framework Profile</span>
                    <span className="micro-badge-neutral">Active</span>
                  </div>
                  <div className="micro-segmented-control">
                    <span className="segment-item active">Kanban</span>
                    <span className="segment-item">Scrum</span>
                    <span className="segment-item">Lean</span>
                  </div>
                  <div className="micro-meta-row">
                    <span className="meta-key">Sprint Cadence</span>
                    <span className="meta-val">Continuous Flow</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Git & Identity Sync */}
              <div className="workflow-card">
                <div className="workflow-card-top">
                  <div className="workflow-card-icon">
                    <GitPullRequest size={17} />
                  </div>
                  <span className="workflow-card-phase">SQUAD & REPO AUTHORIZATION</span>
                </div>
                <div className="workflow-card-content">
                  <h3>Invite Squad & Authorize Repo</h3>
                  <p>
                    Bring in engineers through passwordless email OTP and link your repository in one step.
                  </p>
                </div>
                <div className="workflow-micro-ui">
                  <div className="micro-ui-header">
                    <span className="micro-label">GitHub Integration</span>
                    <span className="micro-badge-green">Connected</span>
                  </div>
                  <div className="micro-code-snippet">
                    <span className="code-repo">repo: paper5/web-client</span>
                    <span className="code-branch">ref: refs/heads/main</span>
                  </div>
                  <div className="micro-meta-row">
                    <span className="meta-key">Auto Sync</span>
                    <span className="meta-val">Commits & Pull Requests</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Single Ownership & Proof of Work */}
              <div className="workflow-card">
                <div className="workflow-card-top">
                  <div className="workflow-card-icon">
                    <ShieldCheck size={17} />
                  </div>
                  <span className="workflow-card-phase">DELIVERABLE SIGN-OFF</span>
                </div>
                <div className="workflow-card-content">
                  <h3>Ship With Verifiable Proof</h3>
                  <p>
                    Assign one accountable owner per deliverable. Work closes once staging links and tests are validated.
                  </p>
                </div>
                <div className="workflow-micro-ui">
                  <div className="micro-ui-header">
                    <span className="micro-label">Deliverable Gate</span>
                    <span className="micro-badge-green">Validated</span>
                  </div>
                  <div className="micro-proof-item">
                    <span className="proof-title">Auth Middleware Cookies</span>
                    <span className="proof-sub">PR merged • Staging verified</span>
                  </div>
                  <div className="micro-meta-row">
                    <span className="meta-key">Gate Status</span>
                    <span className="meta-val">Peer Approved & Shipped</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            6. INTEGRATIONS SECTION (LIGHT)
            GitHub (one-line), Slack, Discord, Calendar, REST API Studio
            ════════════════════════════════════════════════════════════════ */}
        <section id="integrations" className="integrations-section ">
          <div className="section-container">
            <div className="section-header">
              <span className="section-kicker">DEVELOPER INTEGRATIONS</span>
              <h2 className="section-title">
                Connects Seamlessly with Your Existing Stack.
              </h2>
              <p className="section-description">
                Bring your communication, calendar, code repositories, and custom automations into one command center.
              </p>
            </div>

            <div className="integrations-cards-grid ">
              {/* 1. GitHub Native Sync (Kept as one-line item per instructions) */}
              <div className="integration-app-card">
                <div className="app-card-icon"><GitPullRequest size={20} /></div>
                <div className="app-card-info">
                  <h3>GitHub Native Sync</h3>
                  <p>Real-time branch commit tracking, automated PR status updates, and deploy link syncing.</p>
                </div>
              </div>

              {/* 2. Slack Workspace Feed */}
              <div className="integration-app-card">
                <div className="app-card-icon"><MessageSquare size={20} /></div>
                <div className="app-card-info">
                  <h3>Slack Broadcasts</h3>
                  <p>Post automated sprint kickoffs, blocker swarms, and daily digest summaries directly to channels.</p>
                </div>
              </div>

              {/* 3. Discord Engineering Swarms */}
              <div className="integration-app-card">
                <div className="app-card-icon"><Users size={20} /></div>
                <div className="app-card-info">
                  <h3>Discord Webhooks</h3>
                  <p>Stream real-time sprint events and deliverable sign-offs to your technical community channels.</p>
                </div>
              </div>

              {/* 4. Google Calendar Milestone Sync */}
              <div className="integration-app-card">
                <div className="app-card-icon"><Calendar size={20} /></div>
                <div className="app-card-info">
                  <h3>Google Calendar Sync</h3>
                  <p>Synchronize release deadlines and sprint milestones directly with engineering team calendars.</p>
                </div>
              </div>

              {/* 5. Linear Migration Importer */}
              <div className="integration-app-card">
                <div className="app-card-icon"><Layers size={20} /></div>
                <div className="app-card-info">
                  <h3>Linear Workspace Importer</h3>
                  <p>One-click migration utility to import existing issue hierarchies, labels, and backlogs without loss.</p>
                </div>
              </div>

              {/* 6. REST API Studio */}
              <div className="integration-app-card">
                <div className="app-card-icon"><Terminal size={20} /></div>
                <div className="app-card-info">
                  <h3>REST API Studio</h3>
                  <p>Programmatic curl access to query sprints, trigger deliverable checks, and export team telemetry.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            7. SECURITY ARCHITECTURE (DARK)
            Compact 4-Item Icon Grid with Plain-Language Sentences
            ════════════════════════════════════════════════════════════════ */}
        <section id="trust" className="trust-architecture-section ">
          <div className="section-container">
            <div className="section-header">
              <span className="section-kicker">ENGINEERING INTEGRITY & SECURITY</span>
              <h2 className="section-title">
                Cryptographic Tenant Isolation & Security
              </h2>
              <p className="section-subtitle-plain">
                Your squad's projects and code metadata are mathematically segregated in PostgreSQL, so cross-tenant data access is strictly prevented.
              </p>
              <p className="section-description-plain">
                In plain terms: Every team's projects and code data live in their own private, locked database partition, protected by banking-grade encryption at rest and in transit.
              </p>
            </div>

            {/* Compact 4-Item Icon Grid */}
            <div className="security-compact-grid ">
              <div className="security-card">
                <div className="security-card-icon"><Shield size={20} /></div>
                <h3>Tenant Isolation</h3>
                <p>PostgreSQL Row-Level Security policies mathematically partition every workspace at query time.</p>
              </div>

              <div className="security-card">
                <div className="security-card-icon"><Lock size={20} /></div>
                <h3>End-to-End Encryption</h3>
                <p>Standard AES-256 cryptographic storage at rest and TLS 1.3 protocol encryption for all data in transit.</p>
              </div>

              <div className="security-card">
                <div className="security-card-icon"><CheckCircle2 size={20} /></div>
                <h3>Two-Factor Authentication</h3>
                <p>TOTP multi-factor security compatible with Google Authenticator, 1Password, and hardware tokens.</p>
              </div>

              <div className="security-card">
                <div className="security-card-icon"><Download size={20} /></div>
                <h3>Complete Data Ownership</h3>
                <p>Download full workspace exports in raw CSV or printable vector PDF format anytime with no lock-in.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            8. PRICING SECTION (LIGHT)
            Transparent Plans • Free During Launch • Structured Tiers
            ════════════════════════════════════════════════════════════════ */}
        <section id="pricing" className="pricing-section ">
          <div className="section-container">
            <div className="section-header">
              <span className="section-kicker">TRANSPARENT PRICING</span>
              <h2 className="section-title">
                Simple Plans. Free During Launch.
              </h2>
              <p className="section-description">
                Experience the complete connected workspace with all features unlocked during our public launch. Pick the plan that fits your squad.
              </p>
            </div>

            <div className="pricing-grid ">
              {/* Starter Tier */}
              <div className="pricing-card">
                <div className="tier-header">
                  <div className="tier-name">{PLANS.starter.name}</div>
                  <p className="tier-target">{PLANS.starter.target}</p>
                </div>
                <div className="tier-price-box">
                  <div className="tier-future-strikethrough">
                    <span style={{ fontWeight: 700, color: '#15803d', fontSize: '13px', display: 'inline-block' }}>
                      Free Forever Plan
                    </span>
                  </div>
                  <div className="tier-launch-active">
                    <span className="currency">₹</span>
                    <span className="amount">0</span>
                    <span className="period">/ month • forever</span>
                  </div>
                </div>
                <button 
                  className="btn-ghost w-full"
                  onClick={() => handlePlanClick('starter')}
                >
                  {PLANS.starter.ctaText}
                </button>
                <ul className="tier-features">
                  {PLANS.starter.features.map((feat, i) => (
                    <li key={i}>{feat}</li>
                  ))}
                </ul>
              </div>

              {/* Team Tier (Recommended) */}
              <div className="pricing-card recommended">
                <div className="recommended-badge">Recommended • Launch Access</div>
                <div className="tier-header">
                  <div className="tier-name">{PLANS.team.name}</div>
                  <p className="tier-target">{PLANS.team.target}</p>
                </div>
                <div className="tier-price-box">
                  <div className="tier-future-strikethrough">
                    <span className="struck-price">{PLANS.team.futurePrice}</span>
                    <span className="future-period">{PLANS.team.period}</span>
                  </div>
                  <div className="tier-launch-active">
                    <span className="currency">₹</span>
                    <span className="amount">0</span>
                    <span className="period">during launch</span>
                  </div>
                </div>
                <button 
                  className="btn-primary w-full"
                  onClick={() => handlePlanClick('team')}
                >
                  {PLANS.team.ctaText}
                </button>
                <ul className="tier-features">
                  {PLANS.team.features.map((feat, i) => (
                    <li key={i} className={i === 0 ? 'tier-feature-lead' : ''}>{feat}</li>
                  ))}
                </ul>
              </div>

              {/* Scale Tier */}
              <div className="pricing-card">
                <div className="tier-header">
                  <div className="tier-name">{PLANS.scale.name}</div>
                  <p className="tier-target">{PLANS.scale.target}</p>
                </div>
                <div className="tier-price-box">
                  <div className="tier-future-strikethrough">
                    <span className="struck-price">{PLANS.scale.futurePrice}</span>
                    <span className="future-period">{PLANS.scale.period}</span>
                  </div>
                  <div className="tier-launch-active">
                    <span className="currency">₹</span>
                    <span className="amount">0</span>
                    <span className="period">during launch</span>
                  </div>
                </div>
                <button 
                  className="btn-ghost w-full"
                  onClick={() => handlePlanClick('scale')}
                >
                  {PLANS.scale.ctaText}
                </button>
                <ul className="tier-features">
                  {PLANS.scale.features.map((feat, i) => (
                    <li key={i} className={i === 0 ? 'tier-feature-lead' : ''}>{feat}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Clear Launch Policy Note */}
            {/* TODO: replace with finalized policy when launch pricing transitions */}
            <div className="pricing-launch-policy-box">
              <p>
                <strong>What happens when launch ends?</strong> All workspaces registered during the public launch will receive at least 30 days advance notice before any billing begins, with an option to stay on a grandfathered free tier.
              </p>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            9. FAQ & CLOSING CTA SECTION (DARK)
            Concise Questions + Single Contact Link + Primary Final Action
            ════════════════════════════════════════════════════════════════ */}
        <section id="faq" className="faq-section ">
          <div className="section-container">
            <div className="faq-two-col-layout">
              {/* Left Column: Sticky Header */}
              <div className="faq-intro-column">
                <div className="sticky-faq-content">
                  <span className="section-kicker">QUESTIONS & ANSWERS</span>
                  <h2 className="section-title">
                    Frequently Asked Questions.
                  </h2>
                  <p className="section-description">
                    Everything you need to know about Paper5, GitHub development workflows, and team onboarding.
                  </p>
                </div>
              </div>

              {/* Right Column: Clean Accordion Panels + Direct Contact Support Block */}
              <div className="faq-accordion-column">
                <div className="faq-accordion-container">
                  {faqs.map((faq, idx) => (
                    <div 
                      key={idx} 
                      className={`faq-item ${openFaq === idx ? 'open' : ''}`}
                    >
                      <button 
                        className="faq-question-btn"
                        onClick={() => toggleFaq(idx)}
                        aria-expanded={openFaq === idx}
                      >
                        <span>{faq.question}</span>
                        <ChevronDown size={18} className="faq-chevron" />
                      </button>
                      {openFaq === idx && (
                        <div className="faq-answer-panel">
                          <p>{faq.answer}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Direct Contact Block placed immediately below FAQ list */}
                <div className="faq-contact-card" style={{ marginTop: '24px' }}>
                  <div className="contact-card-icon"><HelpCircle size={22} /></div>
                  <h3>Have a specific architecture question?</h3>
                  <p>Our core engineering team is available to discuss custom workflows and squad setups.</p>
                  <button 
                    type="button" 
                    className="btn-ghost btn-sm"
                    onClick={() => setIsContactOpen(true)}
                  >
                    <span>Speak with Our Team</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            10. FULL-WIDTH CLOSING FINAL CTA SECTION
            Edge-to-edge black background from left to right + redesigned button
            ════════════════════════════════════════════════════════════════ */}
        <section className="final-cta-full-section" aria-label="Ready to Ship with Clarity">
          <div className="section-container">
            <div className="final-cta-content">
              <div className="final-cta-kicker">
                READY TO SHIP WITH CLARITY
              </div>
              <h2 className="final-cta-headline">
                Bring Clarity to the Way Your Team Works.
              </h2>
              <p className="final-cta-subheadline">
                Give your squad one place to organize sprints, own deliverables, and ship code without coordination drag.
              </p>
              <div className="final-cta-action-row">
                <button 
                  className="final-cta-action-btn" 
                  onClick={() => handleGetStarted('team')}
                >
                  <span>Start Building Free</span>
                  <ArrowRight size={18} className="final-cta-btn-arrow" />
                </button>
              </div>
              <div className="final-cta-trust-strip">
                <span>Free during launch</span>
                <span className="dot-sep" aria-hidden="true">•</span>
                <span>No credit card required</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <MarketingFooter hideCTA={true} />

      {/* Modals */}
      <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  )
}
