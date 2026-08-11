import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import MarketingNav from '../components/MarketingNav'
import MarketingFooter from '../components/MarketingFooter'
import { AnimatedGridBackgroundSection } from '../components/AnimatedGridBackground'
import ErrorBoundary from '../components/ErrorBoundary'
import { motion } from 'framer-motion'
import SEOHead from '../components/SEOHead'
import AlertModal from '../components/ui/AlertModal'
import { Zap, Code2, ShieldCheck, GitPullRequest, Layers, FileText, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import './Landing.css'

const ModernTextReveal = ({ text }) => {
  const [isStompDone, setIsStompDone] = useState(false)
  const [mounted, setMounted] = useState(false)
  const lines = text.split('<br />')

  useEffect(() => {
    setMounted(true)
  }, [])

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.02 },
    },
  }

  const child = {
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
    },
    hidden: {
      opacity: 0,
      y: 20,
      transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
    },
  }

  if (!mounted) {
    return (
      <div className="modern-text-reveal-static" style={{ opacity: 0, visibility: 'hidden' }}>
        {lines.map((line, i) => (
          <div key={i} className="modern-text-reveal-line">{line}</div>
        ))}
      </div>
    )
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      onAnimationComplete={() => setIsStompDone(true)}
      className={`modern-text-reveal ${isStompDone ? 'stomp-done' : ''}`}
    >
      {lines.map((line, lineIndex) => (
        <div key={lineIndex} className="modern-text-reveal-line">
          {line.trim().split(' ').map((word, index) => (
            <motion.span
              key={index}
              variants={child}
              style={{ marginRight: '0.25em', display: 'inline-block' }}
            >
              {word}
            </motion.span>
          ))}
        </div>
      ))}
    </motion.div>
  )
}

const CapabilitiesCarousel = () => {
  const [scrollIndex, setScrollIndex] = useState(0)
  const carouselRef = useRef(null)

  const capabilities = [
    {
      icon: <Layers size={22} />,
      title: "8-Tier Agile Workflows",
      desc: "Align board columns dynamically for 1 Solo Developer up to 500+ SAFe Enterprise tribes."
    },
    {
      icon: <Code2 size={22} />,
      title: "1-Click REST API Studio",
      desc: "Provision live API keys (`sp_live_...`), copy cURL/Node code snippets, and execute live HTTP tests."
    },
    {
      icon: <GitPullRequest size={22} />,
      title: "GitHub & Stack Sync",
      desc: "Auto-close tasks on PR merge. Broadcast standup digests into Discord and Slack channels."
    },
    {
      icon: <FileText size={22} />,
      title: "Vector PDF Data Export",
      desc: "Export structured printable PDF workspace reports or CSV audit trails with selective section controls."
    }
  ]

  const scrollToCard = (index) => {
    setScrollIndex(index)
    if (carouselRef.current) {
      const container = carouselRef.current
      const card = container.children[index]
      if (card) {
        const containerLeft = container.getBoundingClientRect().left
        const cardLeft = card.getBoundingClientRect().left
        const offset = cardLeft - containerLeft + container.scrollLeft
        container.scrollTo({ left: offset, behavior: 'smooth' })
      }
    }
  }

  const handleNext = () => {
    const nextIdx = (scrollIndex + 1) % capabilities.length
    scrollToCard(nextIdx)
  }

  const handlePrev = () => {
    const prevIdx = (scrollIndex - 1 + capabilities.length) % capabilities.length
    scrollToCard(prevIdx)
  }

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Navigation Arrow Controls */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
        <button 
          onClick={handlePrev}
          className="btn-ghost btn-sm"
          style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-panel)', border: '1px solid var(--border)', cursor: 'pointer' }}
          aria-label="Previous capability"
        >
          <ChevronLeft size={18} />
        </button>
        <button 
          onClick={handleNext}
          className="btn-ghost btn-sm"
          style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-panel)', border: '1px solid var(--border)', cursor: 'pointer' }}
          aria-label="Next capability"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Track & Cards */}
      <div ref={carouselRef} className="features-carousel" style={{ scrollBehavior: 'smooth', padding: '12px 4px' }}>
        {capabilities.map((cap, idx) => (
          <div 
            key={idx} 
            className="bento-card" 
            style={{ 
              padding: '32px',
              border: idx === scrollIndex ? '1px solid #000000' : '1px solid var(--border)',
              boxShadow: idx === scrollIndex ? '0 8px 24px -4px rgba(0, 0, 0, 0.12)' : 'none',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onClick={() => scrollToCard(idx)}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f4f5f7', color: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              {cap.icon}
            </div>
            <h3 style={{ fontSize: '19px', fontWeight: 800, margin: '0 0 10px 0', color: 'var(--text-primary)' }}>{cap.title}</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              {cap.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Dots Indicator Bar */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
        {capabilities.map((_, idx) => (
          <span 
            key={idx}
            onClick={() => scrollToCard(idx)}
            style={{
              width: idx === scrollIndex ? '24px' : '8px',
              height: '8px',
              borderRadius: '100px',
              background: idx === scrollIndex ? '#000000' : 'rgba(0,0,0,0.15)',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default function Landing() {
  const [alertMessage, setAlertMessage] = useState(null)
  const { user } = useAuth()
  const location = useLocation()

  const navigate = useNavigate()

  const handlePlanClick = (planId) => {
    localStorage.setItem('sprintos_selected_plan', planId)
    if (user) {
      navigate('/')
    } else {
      navigate(`/signup?plan=${planId}`)
    }
  }

  useEffect(() => {
    document.title = "Paper5 | Engineering Execution & Sprint Tracking Platform"

    if (location.hash === '#pricing' || window.location.hash === '#pricing') {
      const timer = setTimeout(() => {
        const el = document.getElementById('pricing')
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [location.hash])

  return (
    <div className="landing-page">
      <SEOHead 
        title="Paper5 | Engineering Execution & Sprint Tracking Platform" 
        description="SprintOS™ by Paper5™ is the high-velocity engineering execution platform. 8-tier Agile workflows, 1-Click REST API webhooks, GitHub PR sync, and vector PDF data export."
        canonicalUrl="https://paper5.co"
      />
      <MarketingNav />

      <main>
        {/* Asymmetric Hero */}
        <AnimatedGridBackgroundSection>
          <section className="hero-section">
            <div className="hero-grid" style={{ gridTemplateColumns: '1fr', textAlign: 'center', maxWidth: '900px', margin: '0 auto' }}>
              <div className="hero-content">
                <h1>
                  <ErrorBoundary>
                    <ModernTextReveal text="Everything on paper.<br />Nothing on trust." />
                  </ErrorBoundary>
                </h1>
                <p style={{ fontSize: '19px', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '780px', margin: '0 auto' }}>
                  SprintOS™ by Paper5™ is the zero-friction engineering execution platform. Unites 8-tier Agile methodologies, 1-Click API webhooks, GitHub PR sync, and vector PDF data export in one interface.
                </p>
              </div>
            </div>
          </section>
        </AnimatedGridBackgroundSection>

        {/* Trust & Security Banner */}
        <section className="trust-section">
          <p className="trust-text" style={{ textAlign: 'center' }}>
            Powered by SOC2 Type II certified infrastructure with native GDPR and DPDP compliance.
          </p>
        </section>

        {/* Engineering Capabilities Carousel */}
        <section className="features-section" style={{ maxWidth: '1200px', margin: '0 auto', padding: '60px 24px' }}>
          <div className="section-header" style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2>Engineering-grade execution.</h2>
            <p>Built to stay out of your way until you need it.</p>
          </div>

          <CapabilitiesCarousel />
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="pricing-section">
          <div className="section-header" style={{ textAlign: 'center' }}>
            <h2>Everything is 100% Free during Launch.</h2>
            <p>Full unrestricted access to all features, integrations, and workspaces.</p>
          </div>

          <div className="pricing-grid">
            {/* Starter Tier */}
            <div className="pricing-card">
              <div className="tier-name">Starter</div>
              <div className="tier-price">
                <span className="amount">Free</span>
              </div>
              <p className="tier-desc">Perfect for solo founders and tiny indie teams testing the waters.</p>
              <button 
                className="btn-ghost w-full"
                onClick={() => handlePlanClick('starter')}
              >
                Get Started for Free
              </button>
              <ul className="tier-features">
                <li>1 Workspace</li>
                <li>Up to 3 Members</li>
                <li>⚡ 2 Agile Workflows (Ad-hoc, Kanban)</li>
                <li>GitHub Repository Sync</li>
                <li>Personal Focus Dashboard</li>
                <li>Basic Sprint Tracking</li>
              </ul>
            </div>

            {/* Team Tier (Recommended) */}
            <div className="pricing-card recommended">
              <div className="recommended-badge">Launch Special</div>
              <div className="tier-name">Team</div>
              <div className="tier-price">
                <span className="currency">₹</span>
                <span className="amount">0</span>
                <span className="period">/mo</span>
              </div>
              <p className="tier-desc">For growing startups that need to collaborate and integrate their stack.</p>
              <button 
                className="btn-primary w-full"
                onClick={() => handlePlanClick('team')}
              >
                Get Started for Free
              </button>
              <ul className="tier-features">
                <li>Up to 5 Workspaces</li>
                <li>Up to 7 Team Members</li>
                <li>⚡ 6 Agile Workflows (Kanban, Scrum, XP, Lean, Scrumban)</li>
                <li>GitHub & Google Calendar Integrations</li>
                <li>Locked Sprint Scope Control</li>
                <li>Proof of Work Peer Verification</li>
                <li>Sunday Sync Meeting Broadcasts</li>
              </ul>
            </div>

            {/* Scale Tier */}
            <div className="pricing-card">
              <div className="tier-name">Scale</div>
              <div className="tier-price">
                <span className="currency">₹</span>
                <span className="amount">0</span>
                <span className="period">/mo</span>
              </div>
              <p className="tier-desc">For mature teams requiring advanced reporting, automation, and support.</p>
              <button 
                className="btn-ghost w-full"
                onClick={() => handlePlanClick('scale')}
              >
                Get Started for Free
              </button>
              <ul className="tier-features">
                <li>Up to 10 Workspaces</li>
                <li>Unlimited Team Members</li>
                <li>⚡ All 8 Agile Workflows (Spotify Model & SAFe Enterprise)</li>
                <li>All Stack Integrations (Slack, Discord, Vercel, GitHub, Google Calendar)</li>
                <li>Advanced Velocity & Risk Analytics</li>
                <li>Strict Auditing Mode & CSV Export</li>
                <li>⚡ 1-Click API Webhook & REST Sync Studio</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
      <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />
    </div>
  )
}
