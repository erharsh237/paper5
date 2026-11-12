import { useScrollReveal } from '../hooks/useScrollReveal'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import MarketingNav from '../components/MarketingNav'
import MarketingFooter from '../components/MarketingFooter'
import { AnimatedGridBackgroundSection } from '../components/AnimatedGridBackground'
import SEOHead from '../components/SEOHead'
import AlertModal from '../components/ui/AlertModal'
import ContactModal from '../components/ContactModal'
import { encryptPlanParam } from '../lib/urlSecurity'
import { getAppUrl } from '../lib/domain'
import { safeRedirect } from '../lib/safeRedirect'
import { trackEvent } from '../lib/metrics'
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FolderX,
  ClockAlert,
  MessagesSquare,
  FolderGit2,
  Rocket,
  Compass,
  AlertCircle,
  Sparkles,
  Workflow,
  Plus,
  Eye,
  Terminal,
  HelpCircle,
  Download,
  Shield,
  Database,
  Activity,
  Sliders
} from 'lucide-react'
import './Landing.css'

export default function Landing() {
  useScrollReveal()
  const [alertMessage, setAlertMessage] = useState(null)
  const [isContactOpen, setIsContactOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(0) // Default first FAQ item open
  const [activeFeatureSlide, setActiveFeatureSlide] = useState(0)
  const [isFeaturePaused, setIsFeaturePaused] = useState(false)
  const [touchStartX, setTouchStartX] = useState(null)
  const [touchEndX, setTouchEndX] = useState(null)
  const [stompTriggered, setStompTriggered] = useState(false)
  const [stompKey, setStompKey] = useState(0)

  // Auto-scroll feature cards continuously; pause on hover or touch
  useEffect(() => {
    if (isFeaturePaused) return
    const interval = setInterval(() => {
      setActiveFeatureSlide((prev) => (prev === 5 ? 0 : prev + 1))
    }, 4500)
    return () => clearInterval(interval)
  }, [isFeaturePaused])

  useEffect(() => {
    setStompTriggered(false)
    const timer = setTimeout(() => {
      setStompTriggered(true)
    }, 120)
    return () => clearTimeout(timer)
  }, [stompKey])

  const replayStomp = () => {
    setStompTriggered(false)
    setStompKey(k => k + 1)
  }

  const featureTabs = [
    { id: 0, num: '01', label: 'Agile Kanban' },
    { id: 1, num: '02', label: 'Single Ownership' },
    { id: 2, num: '03', label: 'Live Risk Radar' },
    { id: 3, num: '04', label: 'Meeting Memory' },
    { id: 4, num: '05', label: 'GitHub Native' },
    { id: 5, num: '06', label: 'Audit & Exports' }
  ]

  const handlePrevSlide = () => {
    setActiveFeatureSlide((prev) => (prev === 0 ? 5 : prev - 1))
  }

  const handleNextSlide = () => {
    setActiveFeatureSlide((prev) => (prev === 5 ? 0 : prev + 1))
  }

  const handleTouchStart = (e) => {
    setTouchStartX(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e) => {
    setTouchEndX(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return
    const diff = touchStartX - touchEndX
    if (diff > 45) {
      handleNextSlide()
    } else if (diff < -45) {
      handlePrevSlide()
    }
    setTouchStartX(null)
    setTouchEndX(null)
  }
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const pricingTrackedRef = useRef(false)

  useEffect(() => {
    if (pricingTrackedRef.current) return
    const firePricingView = () => {
      if (pricingTrackedRef.current) return
      pricingTrackedRef.current = true
      trackEvent('pricing_view', { path: location.pathname })
    }
    if (location.pathname === '/pricing' || location.hash === '#pricing') {
      firePricingView()
      return
    }
    const el = document.getElementById('pricing')
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          firePricingView()
          observer.disconnect()
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [location.pathname, location.hash])

  const handleGetStarted = (planId = 'team') => {
    trackEvent('cta_click', { cta_name: 'get_started', plan: planId })
    const encryptedToken = encryptPlanParam(planId)
    try {
      localStorage.setItem('sprintos_selected_plan', planId)
    } catch (_) {}
    const target = getAppUrl(`/signup?p=${encryptedToken}`)
    window.open(target, '_blank', 'noopener,noreferrer')
  }

  const handlePlanClick = (planId) => {
    handleGetStarted(planId)
  }

  const scrollToSection = (e, sectionId) => {
    if (e) e.preventDefault()
    const el = document.getElementById(sectionId)
    if (el) {
      if (window.__lenis) {
        window.__lenis.scrollTo(el, { 
          offset: -84, 
          duration: 1.25, 
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) 
        })
      } else {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      window.history.pushState('', document.title, `#${sectionId}`)
    }
  }

  useEffect(() => {
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

  const toggleFaq = (index) => {
    setOpenFaq(prev => (prev === index ? -1 : index))
  }

  const faqs = [
    {
      question: "What is Paper5?",
      answer: "Paper5 is a project management and team accountability platform designed for small teams and startups. It brings agile task planning, single-owner deadlines, connected meeting notes, team analytics, and GitHub development sync together in one synchronized workspace."
    },
    {
      question: "Who should use Paper5?",
      answer: "Paper5 is built for small teams, technical founders, product builders, and startups that want clear task ownership and fast daily coordination without heavy enterprise setup or spreadsheet clutter."
    },
    {
      question: "How does Paper5 help small teams and startups?",
      answer: "Small teams move fast without a full-time project administrator. Paper5 keeps every member aligned with one-owner task accountability, transparent due dates, 1-click blocker alerts, and automated sprint progress visibility."
    },
    {
      question: "What features are available?",
      answer: "Paper5 includes agile Kanban and workflow boards, sprint and deadline management, single-owner task assignments with deliverable proof verification, live risk and velocity analytics, connected meeting notes, CSV and printable PDF exports, and optional GitHub, Discord, Slack, Google Calendar, and webhook integrations."
    },
    {
      question: "How can I create a team and invite members?",
      answer: "Sign up at app.paper5.co, verify your email with the 6-digit code, and follow the workspace onboarding wizard to create your team workspace. From Workspace Settings you can send direct email invitations or share a secure workspace join link so teammates can join as admins or collaborators."
    },
    {
      question: "How do I manage tasks and track deadlines?",
      answer: "Create tasks from your workspace dashboard or workflow board, assign one accountable owner and deadline, track status changes across stages, flag blockers for teammates when stuck, and verify completed deliverables before closing items."
    },
    {
      question: "Does Paper5 integrate with GitHub?",
      answer: "Yes. You can connect GitHub repositories, link pull requests to workspace tasks, monitor status updates, and streamline engineering handoffs inside your workspace integrations panel."
    },
    {
      question: "How can I contact support?",
      answer: "Reach our support team anytime through the Contact page at paper5.co/contact, via the in-app Give Feedback or Contact Sales forms, or by emailing support@paper5.co (and security@paper5.co for security disclosures). We typically respond within 12–24 business hours."
    }
  ]

  const isPricingRoute = location.pathname === '/pricing'

  return (
    <div className="landing-page">
      <SEOHead 
        title={isPricingRoute ? "Pricing | Paper5" : "Paper5 | Connected Project Workspace for Small Teams"} 
        description={
          isPricingRoute
            ? "Compare Paper5 Starter, Team, and Scale plans. Start free with core sprint management, task ownership, and GitHub sync with no credit card required."
            : "Paper5 is the operating workspace for small teams and startups. Bring your team's projects, tasks, deadlines, documents and development in one place."
        }
        canonicalUrl={isPricingRoute ? "https://paper5.co/pricing" : "https://paper5.co/"}
      />
      <MarketingNav />

      <main>
        {/* ════════════════════════════════════════════════════════════════
            1. HERO SECTION (Section 2)
            Headline, Subheadline, Primary/Secondary CTAs, Product Visual Hero
            ════════════════════════════════════════════════════════════════ */}
        <AnimatedGridBackgroundSection>
          <section className="hero-section" id="hero">
            <div className="hero-content">
              {/* Main Headline with Text Reveal Stomp Animation */}
              <h1 
                key={stompKey}
                className={`hero-headline hero-stomp-headline ${stompTriggered ? 'is-active' : ''}`}
                aria-label="Your projects. Your people. Everything is in sync"
                onClick={replayStomp}
                title="Click to replay stomp animation"
              >
                <div className="hero-stomp-row">
                  <span className="stomp-phrase">
                    <span className="stomp-word" style={{ '--delay': '200ms' }}>
                      <span className="stomp-word-inner">Your</span>
                    </span>
                    <span className="stomp-word" style={{ '--delay': '420ms' }}>
                      <span className="stomp-word-inner">projects.</span>
                    </span>
                  </span>
                  <span className="stomp-phrase">
                    <span className="stomp-word" style={{ '--delay': '800ms' }}>
                      <span className="stomp-word-inner">Your</span>
                    </span>
                    <span className="stomp-word" style={{ '--delay': '1020ms' }}>
                      <span className="stomp-word-inner">people.</span>
                    </span>
                  </span>
                </div>
                <div className="hero-stomp-row stomp-highlight">
                  <span className="stomp-phrase">
                    <span className="stomp-word" style={{ '--delay': '1440ms' }}>
                      <span className="stomp-word-inner">Everything</span>
                    </span>
                    <span className="stomp-word" style={{ '--delay': '1620ms' }}>
                      <span className="stomp-word-inner">is</span>
                    </span>
                    <span className="stomp-word" style={{ '--delay': '1760ms' }}>
                      <span className="stomp-word-inner">in</span>
                    </span>
                    <span className="stomp-word stomp-word-final" style={{ '--delay': '1940ms' }}>
                      <span className="stomp-word-inner">sync</span>
                    </span>
                  </span>
                </div>
              </h1>

              {/* Supporting Subheadline */}
              <p className="hero-subtext">
                Bring your projects, tasks, and team accountability together in one workspace. Give everyone the clarity to know what needs to happen and who owns it.
              </p>

              {/* CTA Action Group */}
              <div className="hero-cta-group">
                <button 
                  className="btn-primary btn-lg hero-btn-cta" 
                  onClick={() => handleGetStarted('team')}
                >
                  <span>Get Started for Free</span>
                  <ArrowRight size={18} />
                </button>
                <a 
                  href="#overview"
                  onClick={(e) => scrollToSection(e, 'overview')}
                  className="btn-ghost btn-lg hero-btn-explore"
                >
                  <Eye size={18} />
                  <span>Explore the Platform</span>
                </a>
              </div>

              {/* Supporting Microcopy */}
              <div className="hero-microcopy">
                <span>Free forever tier available</span>
                <span className="microcopy-dot">•</span>
                <span>No credit card required</span>
                <span className="microcopy-dot">•</span>
                <span>Setup in under 2 minutes</span>
              </div>
            </div>
          </section>
        </AnimatedGridBackgroundSection>

        {/* ════════════════════════════════════════════════════════════════
            2. THE PROBLEM SECTION (Section 3)
            "Your Team Isn't Unproductive. Your Workflow Is Disconnected."
            ════════════════════════════════════════════════════════════════ */}
        <section id="problem" className="problem-section reveal-on-scroll">
          <div className="section-container">
            <div className="section-header">
              <span className="section-kicker">| THE PROBLEM FACING SMALL TEAMS</span>
              <h2 className="section-title">
                Your Team Isn't Unproductive.<br />
                Your Workflow Is Disconnected.
              </h2>
              <p className="section-description">
                When project information is scattered across chat apps, spreadsheets, and disconnected tools, small teams spend more time coordinating than building.
              </p>
            </div>

            <div className="problem-split-layout reveal-stagger">
              {/* Left Column: Problem Breakdown Vectors */}
              <div className="problem-vectors-column">
                <div className="problem-vector-item">
                  <div className="vector-icon-wrap"><FolderX size={20} /></div>
                  <div className="vector-content">
                    <div className="vector-header">
                      <span className="vector-num">01</span>
                      <h4>Scattered Tasks & Fragmented Context</h4>
                    </div>
                    <p>Tasks live in spreadsheets, architecture decisions in Slack threads, and links buried in DMs. Context is lost on every handoff.</p>
                  </div>
                </div>

                <div className="problem-vector-item">
                  <div className="vector-icon-wrap"><Users size={20} /></div>
                  <div className="vector-content">
                    <div className="vector-header">
                      <span className="vector-num">02</span>
                      <h4>Ambiguous "Team" Ownership</h4>
                    </div>
                    <p>When tasks are vaguely assigned to "the squad", no single contributor feels clear accountability. Deliverables slip unnoticed.</p>
                  </div>
                </div>

                <div className="problem-vector-item">
                  <div className="vector-icon-wrap"><MessagesSquare size={20} /></div>
                  <div className="vector-content">
                    <div className="vector-header">
                      <span className="vector-num">03</span>
                      <h4>The "Quick Sync" Status Meeting Tax</h4>
                    </div>
                    <p>Founders rely on daily roll-calls and Slack pings just to find out who is doing what, shredding deep engineering focus time.</p>
                  </div>
                </div>

                <div className="problem-vector-item">
                  <div className="vector-icon-wrap"><ClockAlert size={20} /></div>
                  <div className="vector-content">
                    <div className="vector-header">
                      <span className="vector-num">04</span>
                      <h4>Surprise Eleventh-Hour Deadline Slips</h4>
                    </div>
                    <p>Blockers remain buried until the eve of release, leaving zero runway to adjust scope or swarm to unblock developers.</p>
                  </div>
                </div>
              </div>

              {/* Right Column: Diagnostic Workweek Audit Card */}
              <div className="problem-audit-column">
                <div className="diagnostic-audit-card">
                  <div className="audit-card-head">
                    <div className="audit-pulse-badge">
                      <span className="pulse-dot" />
                      <span>DISCONNECTION AUDIT • TYPICAL 5-DEV SQUAD</span>
                    </div>
                    <span className="audit-tag">Weekly Overhead</span>
                  </div>

                  <div className="audit-hero-stat">
                    <div className="stat-big-number">14.5 hrs</div>
                    <div className="stat-label">Lost per engineer every single week to fragmented coordination</div>
                  </div>

                  <div className="audit-friction-meters">
                    <div className="friction-meter-item">
                      <div className="friction-label-row">
                        <span>Status Update Roundtables</span>
                        <strong>4.2 hrs/wk</strong>
                      </div>
                      <div className="meter-track">
                        <div className="meter-fill red" style={{ width: '42%' }} />
                      </div>
                    </div>

                    <div className="friction-meter-item">
                      <div className="friction-label-row">
                        <span>Searching for Specs & Links in Chat</span>
                        <strong>3.8 hrs/wk</strong>
                      </div>
                      <div className="meter-track">
                        <div className="meter-fill amber" style={{ width: '38%' }} />
                      </div>
                    </div>

                    <div className="friction-meter-item">
                      <div className="friction-label-row">
                        <span>Waiting on Unassigned Reviews</span>
                        <strong>4.1 hrs/wk</strong>
                      </div>
                      <div className="meter-track">
                        <div className="meter-fill orange" style={{ width: '41%' }} />
                      </div>
                    </div>

                    <div className="friction-meter-item">
                      <div className="friction-label-row">
                        <span>Silent Blocker Resolution Surprises</span>
                        <strong>2.4 hrs/wk</strong>
                      </div>
                      <div className="meter-track">
                        <div className="meter-fill yellow" style={{ width: '24%' }} />
                      </div>
                    </div>
                  </div>

                  <div className="audit-card-footer">
                    <div className="audit-conclusion">
                      <span className="conclusion-badge">Total Loss</span>
                      <span>Over <strong>72+ engineering hours</strong> wasted every sprint on disconnects.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            3. THE SOLUTION SECTION (Section 4)
            "One Workspace. Complete Team Visibility."
            ════════════════════════════════════════════════════════════════ */}
        <section id="overview" className="solution-section reveal-on-scroll">
          <div className="section-container">
            <div className="section-header">
              <span className="section-kicker">| THE PAPER5 SOLUTION</span>
              <h2 className="section-title">
                One Workspace. Complete Team Visibility.
              </h2>
              <p className="section-description">
                Paper5 unites project organization, single-owner task accountability, meeting decisions, and GitHub development into one unified command center.
              </p>
            </div>

            <div className="solution-bento-grid reveal-stagger">
              {/* Bento Tile 1: Large Anchor Philosophy Tile */}
              <div className="bento-tile bento-tile-large">
                <div className="bento-tile-badge">
                  <ShieldCheck size={16} />
                  <span>01 • CORE PHILOSOPHY</span>
                </div>
                <h3>Single-Owner Accountability</h3>
                <p>
                  Every deliverable has exactly one accountable owner, an explicit deadline, and peer verification before it's marked done. No more diffuse "team" responsibilities or ambiguity.
                </p>
                <div className="bento-proof-preview">
                  <div className="proof-preview-top">
                    <span className="proof-tag-ready">Deliverable Ready for Review</span>
                    <span className="proof-tag-verified-pill"><Check size={12} /> Verification Required</span>
                  </div>
                  <div className="proof-task-name">"PostgreSQL Connection Pooling & SSL Migration"</div>
                  <div className="proof-meta-strip">
                    <div className="proof-owner-chip">
                      <span className="owner-avatar-pill">PK</span>
                      <span>Owner: <strong>Paras K. (Lead)</strong></span>
                    </div>
                    <span className="proof-due-date">Due Tomorrow</span>
                  </div>
                  <div className="proof-checklist-box">
                    <div className="chk-line"><Check size={13} color="#10b981" /> <span>Staging environment verified on port 6543</span></div>
                    <div className="chk-line"><Check size={13} color="#10b981" /> <span>All 18/18 integration tests passing</span></div>
                    <div className="chk-line"><Check size={13} color="#10b981" /> <span>Approved & signed off by Alex M.</span></div>
                  </div>
                </div>
              </div>

              {/* Bento Side Stack: Two Complementary Tiles */}
              <div className="bento-side-stack">
                {/* Bento Tile 2: Live Visibility */}
                <div className="bento-tile bento-tile-compact">
                  <div className="bento-tile-badge">
                    <Activity size={16} />
                    <span>02 • LIVE VISIBILITY</span>
                  </div>
                  <h4>Live Operational Visibility</h4>
                  <p>
                    Know what's in progress, what's blocked, and what's ready to ship without asking for status reports or scheduling 30-minute check-in calls.
                  </p>
                  <div className="bento-metric-strip">
                    <div className="bento-progress-header">
                      <span>Sprint 14 Velocity</span>
                      <strong style={{ color: '#10b981' }}>72% Shipped</strong>
                    </div>
                    <div className="bento-progress-track">
                      <div className="bento-progress-fill" style={{ width: '72%' }} />
                    </div>
                    <div className="bento-status-chips">
                      <span className="status-chip-green"><Check size={11} /> 0 Unresolved Blockers</span>
                      <span className="status-chip-blue">Live GitHub Sync</span>
                    </div>
                  </div>
                </div>

                {/* Bento Tile 3: Zero Overhead */}
                <div className="bento-tile bento-tile-compact">
                  <div className="bento-tile-badge">
                    <Zap size={16} />
                    <span>03 • VELOCITY</span>
                  </div>
                  <h4>Zero Administrative Overhead</h4>
                  <p>
                    A lightweight, keyboard-friendly interface designed for small engineering teams. Spend your days writing software, not configuring complex tickets.
                  </p>
                  <div className="bento-speed-pills">
                    <div className="speed-pill">
                      <kbd>⌘K</kbd> <span>Global Command Palette</span>
                    </div>
                    <div className="speed-pill">
                      <span className="latency-dot" /> <span>38ms Average API Latency</span>
                    </div>
                    <div className="speed-pill">
                      <span>⚡ Setup in &lt; 2 Minutes</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            4. CORE FEATURES SECTION (Section 5)
            Actual implemented Paper5 features with real UI previews
            ════════════════════════════════════════════════════════════════ */}
        <section id="features" className="features-showcase-section reveal-on-scroll">
          <div className="section-container">
            <div className="section-header">
              <span className="section-kicker">| CORE PLATFORM CAPABILITIES</span>
              <h2 className="section-title">
                Built for Execution. Designed for Accountability.
              </h2>
              <p className="section-description">
                Every feature in Paper5 exists to answer two fundamental questions: what needs to happen next, and who owns it?
              </p>
            </div>

            {/* Slider Viewport with Auto-Scroll (Hover to Pause) */}
            <div 
              className="features-slider-viewport"
              onMouseEnter={() => setIsFeaturePaused(true)}
              onMouseLeave={() => setIsFeaturePaused(false)}
              onTouchStart={(e) => {
                setIsFeaturePaused(true)
                handleTouchStart(e)
              }}
              onTouchMove={handleTouchMove}
              onTouchEnd={() => {
                handleTouchEnd()
                setTimeout(() => setIsFeaturePaused(false), 2500)
              }}
            >
              <div 
                className="features-slider-track"
                style={{ transform: `translateX(-${activeFeatureSlide * 100}%)` }}
              >
                {/* Slide 1: Agile Sprint & Kanban Engine */}
                <div 
                  className="feature-slide" 
                  role="tabpanel" 
                  id="feature-panel-0" 
                  aria-labelledby="feature-tab-0"
                  aria-hidden={activeFeatureSlide !== 0}
                >
                  <div className="feature-block-card">
                    <div className="feature-block-info">
                      <div className="feature-num-badge">01</div>
                      <h3>Agile Sprint & Kanban Engine</h3>
                      <p className="feature-summary">
                        Structured workflows designed for 3–10 member teams without bureaucratic overhead.
                      </p>
                      <p className="feature-detail">
                        Choose from Kanban, Scrum, or Lean workflows tailored specifically to your squad's rhythm. Manage sprint scope, view live WIP limits, and keep tasks flowing smoothly toward release.
                      </p>
                      <ul className="feature-benefits-list">
                        <li><CheckCircle2 size={16} /> <span><strong>Tailored Agile Frameworks:</strong> Pre-configured workflows ready out of the box.</span></li>
                        <li><CheckCircle2 size={16} /> <span><strong>Locked Sprint Scope:</strong> Prevent mid-cycle creep and maintain velocity.</span></li>
                        <li><CheckCircle2 size={16} /> <span><strong>Instant Blocker Swarms:</strong> Flag stuck tasks so teammates assist immediately.</span></li>
                      </ul>
                    </div>
                    <div className="feature-block-visual">
                      <div className="mock-board-card">
                        <div className="mock-board-header">
                          <span>Sprint 14 • Core Workflow</span>
                          <span className="pill-tag-verified">Scrum Active</span>
                        </div>
                        <div className="mock-board-columns">
                          <div className="mock-column">
                            <div className="mock-col-name">In Progress (2)</div>
                            <div className="mock-task-card active-card">
                              <div className="mock-task-tag">Core DB</div>
                              <div className="mock-task-title">PostgreSQL connection pooling</div>
                              <div className="mock-task-footer">
                                <span className="avatar-xs avatar-paras">PK</span>
                                <span>Due in 2d</span>
                              </div>
                            </div>
                          </div>
                          <div className="mock-column">
                            <div className="mock-col-name">Verified Done (4)</div>
                            <div className="mock-task-card done-card">
                              <div className="mock-task-tag">Security</div>
                              <div className="mock-task-title">2FA Authenticator Setup</div>
                              <div className="mock-task-footer">
                                <Check size={12} color="#16a34a" />
                                <span>Verified</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Slide 2: Single-Owner Accountability & Proof of Work */}
                <div 
                  className="feature-slide" 
                  role="tabpanel" 
                  id="feature-panel-1" 
                  aria-labelledby="feature-tab-1"
                  aria-hidden={activeFeatureSlide !== 1}
                >
                  <div className="feature-block-card">
                    <div className="feature-block-info">
                      <div className="feature-num-badge">02</div>
                      <h3>Single-Owner Accountability & Proof of Work</h3>
                      <p className="feature-summary">
                        Eliminate vague group assignments. Every deliverable has one accountable owner.
                      </p>
                      <p className="feature-detail">
                        Paper5 enforces clear ownership on every card. When work is completed, contributors submit verifiable deliverables (PR link, staging URL, or test proof) for peer verification before the card enters Done.
                      </p>
                      <ul className="feature-benefits-list">
                        <li><CheckCircle2 size={16} /> <span><strong>Explicit Task Ownership:</strong> Clear responsibility on every single deliverable.</span></li>
                        <li><CheckCircle2 size={16} /> <span><strong>Verifiable Proof Checklist:</strong> Test results, PR links, and review sign-offs.</span></li>
                        <li><CheckCircle2 size={16} /> <span><strong>Peer Sign-Off:</strong> High-trust verification by technical leads or peers.</span></li>
                      </ul>
                    </div>
                    <div className="feature-block-visual">
                      <div className="mock-proof-card">
                        <div className="mock-proof-head">
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Deliverable Verification</div>
                            <div className="mock-card-highlight">Stripe Webhook Idempotency</div>
                          </div>
                          <span className="proof-tag-pending">Pending Review</span>
                        </div>
                        <div className="mock-proof-body">
                          <div className="proof-item">
                            <CheckCircle2 size={14} color="#16a34a" />
                            <span>Integration test suite passing (18/18 tests)</span>
                          </div>
                          <div className="proof-item">
                            <CheckCircle2 size={14} color="#16a34a" />
                            <span>GitHub PR #42 approved by Alex M.</span>
                          </div>
                          <div className="proof-item">
                            <CheckCircle2 size={14} color="#16a34a" />
                            <span>Staging environment verified on Vercel preview</span>
                          </div>
                        </div>
                        <div className="mock-proof-footer">
                          <span className="btn-primary btn-sm" style={{ padding: '6px 14px', fontSize: '12px' }}>Verify & Complete</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Slide 3: Live Deadlines & Risk Alerts */}
                <div 
                  className="feature-slide" 
                  role="tabpanel" 
                  id="feature-panel-2" 
                  aria-labelledby="feature-tab-2"
                  aria-hidden={activeFeatureSlide !== 2}
                >
                  <div className="feature-block-card">
                    <div className="feature-block-info">
                      <div className="feature-num-badge">03</div>
                      <h3>Live Deadlines & Risk Alerts</h3>
                      <p className="feature-summary">
                        Proactive warnings that highlight potential slippage before deadlines pass.
                      </p>
                      <p className="feature-detail">
                        Paper5 continuously tracks task velocity, remaining days in the sprint, and unassigned dependencies to calculate real-time delivery risk. Never be caught off-guard by a surprise release delay.
                      </p>
                      <ul className="feature-benefits-list">
                        <li><CheckCircle2 size={16} /> <span><strong>Predictive Risk Alerts:</strong> Identify stalling tasks 3 to 5 days before deadlines.</span></li>
                        <li><CheckCircle2 size={16} /> <span><strong>Milestone Countdown:</strong> Visual countdown timers kept visible across your workspace.</span></li>
                        <li><CheckCircle2 size={16} /> <span><strong>Automated Email & Webhook Alerts:</strong> Urgent notifications sent when deadlines approach.</span></li>
                      </ul>
                    </div>
                    <div className="feature-block-visual">
                      <div className="mock-risk-card">
                        <div className="risk-metric-header">
                          <div>
                            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Sprint Velocity Accuracy</div>
                            <div className="mock-metric-val">94%</div>
                          </div>
                          <span className="risk-badge-low">Low Slippage Risk</span>
                        </div>
                        <div className="risk-task-alert">
                          <AlertTriangle size={16} color="#d97706" />
                          <div>
                            <strong>Attention Needed:</strong> "Custom Domain DNS" is due in 48h and marked as Blocked.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Slide 4: Connected Meeting Docs & Decision Logs */}
                <div 
                  className="feature-slide" 
                  role="tabpanel" 
                  id="feature-panel-3" 
                  aria-labelledby="feature-tab-3"
                  aria-hidden={activeFeatureSlide !== 3}
                >
                  <div className="feature-block-card">
                    <div className="feature-block-info">
                      <div className="feature-num-badge">04</div>
                      <h3>Connected Meeting Docs & Decision Logs</h3>
                      <p className="feature-summary">
                        Preserve meeting decisions and link them directly to sprint deliverables.
                      </p>
                      <p className="feature-detail">
                        Stop letting critical architecture decisions vanish in Slack threads. Paper5's Meeting space lets you document standups, sprint retrospectives, and architecture choices with permanent links to tasks.
                      </p>
                      <ul className="feature-benefits-list">
                        <li><CheckCircle2 size={16} /> <span><strong>Structured Standup Digests:</strong> Weekly summaries and retrospective logs.</span></li>
                        <li><CheckCircle2 size={16} /> <span><strong>Action Item Sync:</strong> Meeting tasks turn immediately into sprint cards.</span></li>
                        <li><CheckCircle2 size={16} /> <span><strong>Permanent Project Memory:</strong> Preserve context for every new contributor.</span></li>
                      </ul>
                    </div>
                    <div className="feature-block-visual">
                      <div className="mock-doc-card">
                        <div className="mock-doc-header">
                          <FileText size={16} color="#2563eb" />
                          <span>Sprint 14 Architecture Decisions</span>
                        </div>
                        <div className="mock-doc-body">
                          <p><strong>Decision:</strong> Route all high-frequency deadline reads through transaction pooler on port 6543.</p>
                          <div className="mock-action-box">
                            <div style={{ fontSize: '11px', fontWeight: 600, color: '#059669', marginBottom: '4px' }}>Linked Sprint Task:</div>
                            <div className="mock-action-text">"PostgreSQL Connection Pooling" — Owner: Paras K.</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Slide 5: Native GitHub Integration */}
                <div 
                  className="feature-slide" 
                  role="tabpanel" 
                  id="feature-panel-4" 
                  aria-labelledby="feature-tab-4"
                  aria-hidden={activeFeatureSlide !== 4}
                >
                  <div className="feature-block-card">
                    <div className="feature-block-info">
                      <div className="feature-num-badge">05</div>
                      <h3>Native GitHub Workflow Integration</h3>
                      <p className="feature-summary">
                        Connect your repository so code activity automatically updates project status.
                      </p>
                      <p className="feature-detail">
                        Attach pull requests directly to sprint cards. When a pull request is approved, CI checks pass, and code merges into main, Paper5 automatically transitions the deliverable to Done.
                      </p>
                      <ul className="feature-benefits-list">
                        <li><CheckCircle2 size={16} /> <span><strong>Direct PR & Commit Linking:</strong> Track pull request progress on the sprint card.</span></li>
                        <li><CheckCircle2 size={16} /> <span><strong>Automated Task Closing:</strong> Merged PRs update task states without manual clicks.</span></li>
                        <li><CheckCircle2 size={16} /> <span><strong>Live CI Check Status:</strong> Inspect test run statuses right on the board.</span></li>
                      </ul>
                    </div>
                    <div className="feature-block-visual">
                      <div className="mock-gh-card">
                        <div className="mock-gh-header">
                          <span className="tool-icon">🐙</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '13px' }}>GitHub Sync • Main Branch</div>
                            <div style={{ fontSize: '11.5px', color: '#64748b' }}>paper5/sprint-core</div>
                          </div>
                          <span className="tool-badge-live" style={{ marginLeft: 'auto' }}>Synced</span>
                        </div>
                        <div className="mock-gh-event">
                          <GitPullRequest size={14} color="#2563eb" />
                          <span>PR #44: "Connection pooling" merged by Paras K.</span>
                        </div>
                        <div className="mock-gh-action">
                          <CheckCircle2 size={14} color="#16a34a" />
                          <span>Task "PostgreSQL Pooling" auto-closed on merge</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Slide 6: 1-Click Printable PDF & Audit Exports */}
                <div 
                  className="feature-slide" 
                  role="tabpanel" 
                  id="feature-panel-5" 
                  aria-labelledby="feature-tab-5"
                  aria-hidden={activeFeatureSlide !== 5}
                >
                  <div className="feature-block-card">
                    <div className="feature-block-info">
                      <div className="feature-num-badge">06</div>
                      <h3>1-Click Printable PDF & Audit Exports</h3>
                      <p className="feature-summary">
                        Complete data ownership. Export printable summaries and CSV audits anytime.
                      </p>
                      <p className="feature-detail">
                        Never worry about proprietary lock-in. With one click, export crisp vector PDF summaries of your workspace, team workload reports, and full CSV exports for compliance, stakeholders, or records.
                      </p>
                      <ul className="feature-benefits-list">
                        <li><CheckCircle2 size={16} /> <span><strong>Vector PDF Summaries:</strong> Ready to print or share with external clients.</span></li>
                        <li><CheckCircle2 size={16} /> <span><strong>Full CSV & JSON Backups:</strong> Complete structured data export anytime.</span></li>
                        <li><CheckCircle2 size={16} /> <span><strong>100% Data Ownership:</strong> Your data belongs to you without vendor lock-in.</span></li>
                      </ul>
                    </div>
                    <div className="feature-block-visual">
                      <div className="mock-export-card">
                        <div className="export-card-head">
                          <Download size={18} />
                          <span>Workspace Export Studio</span>
                        </div>
                        <div className="export-options-list">
                          <div className="export-opt-item">
                            <FileText size={14} color="#dc2626" />
                            <div><strong>Printable Vector PDF Report</strong><div className="export-sub">Full sprint recap with task breakdown</div></div>
                          </div>
                          <div className="export-opt-item">
                            <Database size={14} color="#059669" />
                            <div><strong>CSV Compliance & Audit Log</strong><div className="export-sub">Raw timestamped record of all deliverables</div></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Slider Dots Indicator */}
            <div className="features-slider-dots">
              {featureTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-label={`Go to slide ${tab.num}: ${tab.label}`}
                  className={`slider-dot ${activeFeatureSlide === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveFeatureSlide(tab.id)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            5. BENEFITS SECTION (Section 6)
            "Less Chasing. More Building."
            ════════════════════════════════════════════════════════════════ */}
        <section id="benefits" className="benefits-section reveal-on-scroll">
          <div className="section-container">
            <div className="section-header">
              <span className="section-kicker">| THE OUTCOME FOR YOUR TEAM</span>
              <h2 className="section-title">
                Less Chasing. More Building.
              </h2>
              <p className="section-description">
                When responsibilities are clear and work is verified, your team moves faster with radically less coordination overhead.
              </p>
            </div>

            {/* Top Stat Ticker */}
            <div className="benefits-stats-bar">
              <div className="benefit-stat-item">
                <div className="stat-value">0</div>
                <div className="stat-caption">Status roll-call meetings needed per week</div>
              </div>
              <div className="benefit-stat-item">
                <div className="stat-value">100%</div>
                <div className="stat-caption">Single-owner clarity on every task deliverable</div>
              </div>
              <div className="benefit-stat-item">
                <div className="stat-value">&lt; 2m</div>
                <div className="stat-caption">Frictionless onboarding with zero tool training</div>
              </div>
              <div className="benefit-stat-item">
                <div className="stat-value">+38%</div>
                <div className="stat-caption">More uninterrupted weekly engineering build time</div>
              </div>
            </div>

            {/* Two-Column Editorial Value Ledger */}
            <div className="benefits-ledger-grid reveal-stagger">
              {/* Column 1: Operational Clarity */}
              <div className="ledger-column">
                <div className="ledger-column-head">
                  <span className="ledger-col-tag">CLARITY & ALIGNMENT</span>
                  <h3>Know the Score Without Asking</h3>
                </div>
                <div className="ledger-items-list">
                  <div className="ledger-row">
                    <div className="ledger-icon-wrap"><Eye size={18} /></div>
                    <div className="ledger-info">
                      <h4>Instant Roster Visibility</h4>
                      <p>See live active tasks, verified deliverables, and owners across the squad without interrupting engineers with status questions.</p>
                    </div>
                  </div>

                  <div className="ledger-row">
                    <div className="ledger-icon-wrap"><Clock size={18} /></div>
                    <div className="ledger-info">
                      <h4>Eliminate Coordination Roundtables</h4>
                      <p>Replace 30-minute status roundtables and daily standup roll-calls with a transparent command center that always mirrors reality.</p>
                    </div>
                  </div>

                  <div className="ledger-row">
                    <div className="ledger-icon-wrap"><ShieldCheck size={18} /></div>
                    <div className="ledger-info">
                      <h4>True Ownership & Pride in Shipping</h4>
                      <p>Every deliverable has one explicit owner who feels pride and clear responsibility for submitting verified proof of work.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 2: Shipping Velocity */}
              <div className="ledger-column">
                <div className="ledger-column-head">
                  <span className="ledger-col-tag">EXECUTION & SPEED</span>
                  <h3>Build Faster With Zero Drag</h3>
                </div>
                <div className="ledger-items-list">
                  <div className="ledger-row">
                    <div className="ledger-icon-wrap"><AlertTriangle size={18} /></div>
                    <div className="ledger-info">
                      <h4>Identify Bottlenecks Days Earlier</h4>
                      <p>Flagged blockers broadcast instant notifications so teammates can swarm and resolve obstacles days before release deadlines.</p>
                    </div>
                  </div>

                  <div className="ledger-row">
                    <div className="ledger-icon-wrap"><Layers size={18} /></div>
                    <div className="ledger-info">
                      <h4>Unified Tasks, Specs & GitHub Code</h4>
                      <p>Architecture decisions, standup digests, and GitHub pull requests live together so vital context is never lost across disjointed tools.</p>
                    </div>
                  </div>

                  <div className="ledger-row">
                    <div className="ledger-icon-wrap"><Rocket size={18} /></div>
                    <div className="ledger-info">
                      <h4>Spend Time Executing, Not Managing</h4>
                      <p>Reclaim hours every week to build, design, test, and ship software that delivers real customer value.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            6. HOW IT WORKS SECTION (Section 7)
            3 Simple Steps with Visual Diagram
            ════════════════════════════════════════════════════════════════ */}
        <section id="how-it-works" className="how-it-works-section reveal-on-scroll">
          <div className="section-container">
            <div className="section-header">
              <span className="section-kicker">| ONBOARDING WORKFLOW</span>
              <h2 className="section-title">
                Up and Running in Under Two Minutes.
              </h2>
              <p className="section-description">
                A friction-free setup designed for small teams that need to focus on building, not tool administration.
              </p>
            </div>

            <div className="workflow-timeline-track reveal-stagger">
              {/* Step 1 */}
              <div className="timeline-milestone">
                <div className="milestone-node-header">
                  <div className="milestone-badge">01</div>
                  <div className="milestone-connector-line" />
                </div>
                <div className="milestone-body">
                  <h3>Name Workspace & Pick Agile Flow</h3>
                  <p>
                    Set up your workspace in 30 seconds. Choose from Kanban, Scrum, or Lean frameworks pre-configured for squads of 3–10 members.
                  </p>
                  <div className="milestone-action-chip">
                    <span className="chip-active">✓ Kanban</span>
                    <span>Scrum</span>
                    <span>Lean</span>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="timeline-milestone">
                <div className="milestone-node-header">
                  <div className="milestone-badge">02</div>
                  <div className="milestone-connector-line" />
                </div>
                <div className="milestone-body">
                  <h3>Invite Squad & Connect GitHub</h3>
                  <p>
                    Bring in your engineers with frictionless email OTP. Authenticate your GitHub repo in one click for automated PR & commit sync.
                  </p>
                  <div className="milestone-action-chip repo-chip">
                    <span>🐙 paper5/core</span>
                    <span className="chip-status-dot" />
                    <span style={{ color: '#10b981', fontWeight: 600 }}>Active Sync</span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="timeline-milestone">
                <div className="milestone-node-header">
                  <div className="milestone-badge">03</div>
                </div>
                <div className="milestone-body">
                  <h3>Assign Single Owners & Ship Proof</h3>
                  <p>
                    Every deliverable gets one accountable owner. Contributors verify staging links and test results before work is peer-approved as Done.
                  </p>
                  <div className="milestone-action-chip proof-chip">
                    <Check size={13} color="#10b981" />
                    <span>Peer Verified Proof • Shipped</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            7. INTEGRATIONS SECTION (Section 8)
            GitHub, Slack, Discord, Calendar, REST API Studio
            ════════════════════════════════════════════════════════════════ */}
        <section id="integrations" className="integrations-section reveal-on-scroll">
          <div className="section-container">
            <div className="section-header">
              <span className="section-kicker">| DEVELOPER INTEGRATIONS</span>
              <h2 className="section-title">
                Connects Seamlessly with Your Existing Stack.
              </h2>
              <p className="section-description">
                Paper5 connects your development activity with project management so your tools stay in sync without manual ticket updates.
              </p>
            </div>

            <div className="integrations-split-layout reveal-stagger">
              {/* Left Column: Stack Roster */}
              <div className="integrations-roster-column">
                <div className="integration-roster-item">
                  <div className="roster-icon-wrap"><FolderGit2 size={22} /></div>
                  <div className="roster-info">
                    <div className="roster-title-row">
                      <h4>GitHub Native Sync</h4>
                      <span className="roster-status-pill live">Live & Native</span>
                    </div>
                    <p>Link pull requests, track commits, and auto-close deliverables when PRs merge into main.</p>
                  </div>
                </div>

                <div className="integration-roster-item">
                  <div className="roster-icon-wrap"><MessageSquare size={22} /></div>
                  <div className="roster-info">
                    <div className="roster-title-row">
                      <h4>Slack & Discord Webhooks</h4>
                      <span className="roster-status-pill webhook">Webhooks</span>
                    </div>
                    <p>Broadcast blocker alerts and milestone wins directly into your chosen team channels.</p>
                  </div>
                </div>

                <div className="integration-roster-item">
                  <div className="roster-icon-wrap"><Calendar size={22} /></div>
                  <div className="roster-info">
                    <div className="roster-title-row">
                      <h4>Google Calendar & Meet</h4>
                      <span className="roster-status-pill live">GIS OAuth</span>
                    </div>
                    <p>Sync meeting notes, sprint planning dates, and milestone releases natively with Google Identity.</p>
                  </div>
                </div>

                <div className="integration-roster-item">
                  <div className="roster-icon-wrap"><Zap size={22} /></div>
                  <div className="roster-info">
                    <div className="roster-title-row">
                      <h4>1-Click REST API Studio</h4>
                      <span className="roster-status-pill api">REST Engine</span>
                    </div>
                    <p>Provision instant API tokens (<code>sp_live_...</code>) for CI/CD automation and custom reporting.</p>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Interactive Developer Terminal */}
              <div className="integrations-terminal-column">
                <div className="dev-terminal-card">
                  <div className="terminal-header-bar">
                    <div className="terminal-dots">
                      <span className="t-dot red" />
                      <span className="t-dot yellow" />
                      <span className="t-dot green" />
                    </div>
                    <span className="terminal-title">curl — Paper5 Webhook & REST API</span>
                    <span className="terminal-lang-badge">BASH</span>
                  </div>

                  <div className="terminal-body-code">
                    <div className="code-comment"># Trigger deliverable verification from GitHub Actions</div>
                    <div className="code-line"><span className="code-cmd">curl</span> -X POST https://paper5.co/api/v1/deliverables/verify \</div>
                    <div className="code-line indent">-H <span className="code-str">"Authorization: Bearer sp_live_9f8a...4b12"</span> \</div>
                    <div className="code-line indent">-H <span className="code-str">"Content-Type: application/json"</span> \</div>
                    <div className="code-line indent">-d <span className="code-str">'{'{'}</span></div>
                    <div className="code-line double-indent"><span className="code-key">"deliverable_id"</span>: <span className="code-str">"del_postgres_pooling"</span>,</div>
                    <div className="code-line double-indent"><span className="code-key">"pr_url"</span>: <span className="code-str">"https://github.com/paper5/core/pull/42"</span>,</div>
                    <div className="code-line double-indent"><span className="code-key">"tests_passed"</span>: <span className="code-num">18</span>,</div>
                    <div className="code-line double-indent"><span className="code-key">"status"</span>: <span className="code-str">"VERIFIED_DONE"</span></div>
                    <div className="code-line indent"><span className="code-str">{'}'}'</span></div>
                  </div>

                  <div className="terminal-response-strip">
                    <div className="response-status">
                      <span className="status-code">HTTP 200 OK</span>
                      <span className="latency-time">⚡ 38ms</span>
                    </div>
                    <div className="response-message">Deliverable #del_postgres_pooling marked as verified &amp; moved to Done</div>
                  </div>
                </div>
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

        {/* ════════════════════════════════════════════════════════════════
            8. SOCIAL PROOF & TRUST ARCHITECTURE (Section 9)
            Engineered for Focus. Built on Transparency. (No fake testimonials)
            ════════════════════════════════════════════════════════════════ */}
        <section id="trust" className="trust-architecture-section reveal-on-scroll">
          <div className="section-container">
            <div className="section-header">
              <span className="section-kicker">| ENGINEERING PHILOSOPHY & SECURITY</span>
              <h2 className="section-title">
                Engineered for Focus. Built on Transparency.
              </h2>
              <p className="section-description">
                We believe software tools should accelerate execution, not create administrative burden. Here are the principles that govern how Paper5 is built.
              </p>
            </div>

            <div className="trust-blueprint-layout reveal-stagger">
              {/* Left Column: Security Blueprint Banner */}
              <div className="trust-blueprint-card">
                <div className="blueprint-badge">
                  <ShieldCheck size={18} />
                  <span>ARCHITECTURE & DATA INTEGRITY</span>
                </div>
                <h3>Cryptographic Tenant Isolation by Design</h3>
                <p>
                  Security isn't an afterthought or an enterprise addon in Paper5. Your data isolation is mathematically guaranteed at the database engine level.
                </p>

                <div className="blueprint-guarantees-list">
                  <div className="guarantee-row">
                    <CheckCircle2 size={16} color="#10b981" />
                    <div>
                      <strong>PostgreSQL Row-Level Security (RLS)</strong>
                      <span>Policies enforce tenant boundaries at the query execution level.</span>
                    </div>
                  </div>

                  <div className="guarantee-row">
                    <CheckCircle2 size={16} color="#10b981" />
                    <div>
                      <strong>Zero Third-Party Trackers or Data Selling</strong>
                      <span>No advertising pixels, no behavioral trackers. Your workflow is private.</span>
                    </div>
                  </div>

                  <div className="guarantee-row">
                    <CheckCircle2 size={16} color="#10b981" />
                    <div>
                      <strong>AES-256 at Rest & TLS 1.3 in Transit</strong>
                      <span>Industry standard cryptographic safeguards on all stored data.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Spec Ledger */}
              <div className="trust-specs-grid">
                <div className="spec-item">
                  <div className="spec-icon-box"><Download size={20} /></div>
                  <h4>100% Data Sovereignty</h4>
                  <p>Export printable vector PDFs and complete raw CSV compliance audits with a single click anytime.</p>
                </div>

                <div className="spec-item">
                  <div className="spec-icon-box"><Zap size={20} /></div>
                  <h4>Sub-50ms Query Latency</h4>
                  <p>Transaction connection pooling on port 6543 ensures instantaneous board loads and smooth drag-and-drop.</p>
                </div>

                <div className="spec-item">
                  <div className="spec-icon-box"><Lock size={20} /></div>
                  <h4>Two-Factor Authentication</h4>
                  <p>TOTP multi-factor security compatible with Google Authenticator, 1Password, and Authy.</p>
                </div>

                <div className="spec-item">
                  <div className="spec-icon-box"><Database size={20} /></div>
                  <h4>Zero Administrative Burden</h4>
                  <p>Engineered so you never need a certified Jira admin just to run a sprint or invite a developer.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            9. PRICING SECTION (Section 10)
            Starter (Free), Team (Recommended), Scale
            ════════════════════════════════════════════════════════════════ */}
        <section id="pricing" className="pricing-section reveal-on-scroll">
          <div className="section-container">
            <div className="section-header">
              <span className="section-kicker">| TRANSPARENT PRICING</span>
              <h2 className="section-title">
                Simple, Transparent Pricing. Free During Launch.
              </h2>
              <p className="section-description">
                Experience the complete connected workspace with all features unlocked during our launch phase. No credit card required. Pick the plan that fits your squad.
              </p>
            </div>

            <div className="pricing-grid reveal-stagger">
              {/* Starter Tier */}
              <div className="pricing-card">
                <div className="tier-header">
                  <div className="tier-name">Starter</div>
                  <p className="tier-target">For solo founders and tiny indie teams establishing initial workflows.</p>
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
                  <li><strong>1</strong> Workspace included</li>
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
                  <p className="tier-target">For growing startups that need to collaborate, assign owners, and integrate.</p>
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
                  <li>Connected Meeting Notes & Sync Digests</li>
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
                  <li>All Stack Integrations (GitHub, Slack, Discord, Calendar)</li>
                  <li>1-Click REST API Studio (<code>sp_live_...</code>)</li>
                  <li>Printable Vector PDF Workspace Reports & CSV Audit Logs</li>
                  <li>Advanced Team Velocity & Risk Analytics</li>
                  <li>Priority Developer Support</li>
                </ul>
              </div>
            </div>

            <div className="pricing-footnote">
              * During our public launch period, all plans are available at ₹0/month to empower startups without upfront friction. Workspace member limits are enforced within the application.
            </div>

            <div className="pricing-guarantee-ribbon">
              <div className="ribbon-item">
                <Check size={14} color="#10b981" />
                <span>No Credit Card Required</span>
              </div>
              <div className="ribbon-sep">•</div>
              <div className="ribbon-item">
                <Check size={14} color="#10b981" />
                <span>Instant Workspace Setup (&lt; 2 mins)</span>
              </div>
              <div className="ribbon-sep">•</div>
              <div className="ribbon-item">
                <Check size={14} color="#10b981" />
                <span>Full Access During Public Launch</span>
              </div>
              <div className="ribbon-sep">•</div>
              <div className="ribbon-item">
                <Check size={14} color="#10b981" />
                <span>1-Click Complete Data Export Anytime</span>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            10. FAQ SECTION (Section 11)
            Asymmetric Two-Column Support Hub with Accordion
            ════════════════════════════════════════════════════════════════ */}
        <section id="faq" className="faq-section reveal-on-scroll">
          <div className="section-container">
            <div className="faq-two-col-layout">
              {/* Left Column: Sticky Header & Direct Support Card */}
              <div className="faq-intro-column">
                <div className="sticky-faq-content">
                  <span className="section-kicker">| QUESTIONS & ANSWERS</span>
                  <h2 className="section-title">
                    Frequently Asked Questions.
                  </h2>
                  <p className="section-description">
                    Everything you need to know about Paper5, onboarding, security, and agile methodologies.
                  </p>

                  <div className="faq-contact-card">
                    <div className="contact-card-icon"><HelpCircle size={24} /></div>
                    <h4>Have a specific question?</h4>
                    <p>Our core engineering team is happy to discuss architecture, custom integrations, or team setup.</p>
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

              {/* Right Column: Clean Accordion Panels */}
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
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            11. FINAL CLOSING CTA SECTION (Section 12)
            "Bring Clarity to the Way Your Team Works."
            ════════════════════════════════════════════════════════════════ */}
        <section className="final-cta-section reveal-on-scroll">
          <div className="final-cta-container">
            <div className="final-cta-kicker">
              | Get Started in Under 2 Minutes
            </div>
            <h2 className="final-cta-headline">
              Bring Clarity to the Way Your Team Works.
            </h2>
            <p className="final-cta-subheadline">
              Give your team one place to organize work, own responsibilities, and move projects forward.
            </p>
            <div className="final-cta-buttons">
              <button 
                className="btn-primary btn-lg" 
                onClick={() => handleGetStarted('team')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <span>Get Started with Paper5</span>
                <ArrowRight size={18} />
              </button>
              <button 
                className="btn-ghost btn-lg" 
                onClick={() => setIsContactOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <MessageSquare size={16} />
                <span>Contact Team</span>
              </button>
            </div>
            <div className="final-cta-microcopy">
              <span>Free tier available</span>
              <span>•</span>
              <span>No credit card required</span>
              <span>•</span>
              <span>Instant workspace setup</span>
            </div>
          </div>
        </section>
      </main>

      {/* 12. FOOTER (Section 13) */}
      <MarketingFooter hideCTA={true} />

      {/* Modals */}
      <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  )
}
