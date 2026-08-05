import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import MarketingNav from '../components/MarketingNav'
import MarketingFooter from '../components/MarketingFooter'
import { AnimatedGridBackgroundSection } from '../components/AnimatedGridBackground'
import ErrorBoundary from '../components/ErrorBoundary'
import { motion } from 'framer-motion'
import logo from '../assets/logo.png'
import SEOHead from '../components/SEOHead'
import './Landing.css'
import AlertModal from '../components/ui/AlertModal'

const ModernTextReveal = ({ text }) => {
  const [isStompDone, setIsStompDone] = useState(false)
  const lines = text.split('<br />')
  
  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.25, delayChildren: 0.3 },
    },
  }

  const child = {
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
    },
    hidden: {
      opacity: 0,
      y: 40,
      transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
    },
  }

  return (
    <motion.span
      variants={container}
      initial="hidden"
      animate="visible"
      onAnimationComplete={() => setIsStompDone(true)}
      className={`modern-text-reveal ${isStompDone ? 'stomp-done' : ''}`}
      style={{ display: 'inline-block' }}
    >
      {lines.map((line, lineIndex) => (
        <span key={lineIndex} style={{ display: 'block' }}>
          {line.trim().split(' ').map((word, index) => (
            <motion.span
              key={index}
              variants={child}
              style={{ marginRight: '0.25em', display: 'inline-block' }}
            >
              {word}
            </motion.span>
          ))}
        </span>
      ))}
    </motion.span>
  )
}

export default function Landing() {
  const [alertMessage, setAlertMessage] = useState(null)
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isBillingAnnual, setIsBillingAnnual] = useState(false)
  const [loadingPriceId, setLoadingPriceId] = useState(null)

  const loadRazorpayScript = () => {
    return new Promise((resolve, reject) => {
      if (window.Razorpay) return resolve(true)
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => reject(new Error('Razorpay failed to load'))
      document.body.appendChild(script)
    })
  }

  useEffect(() => {
    document.title = "Paper5 | Engineering Execution Platform"
    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) metaDesc.content = "Strict compliance, automated standups, and crystal-clear analytics—so you can focus on shipping."
  }, [])

  const handleSubscribe = async (priceId) => {
    if (!user) {
      navigate('/signup')
      return
    }
    
    try {
      setLoadingPriceId(priceId)
      
      try {
        await loadRazorpayScript()
      } catch (err) {
        setAlertMessage("Checkout initialization failed. Please disable any active ad blockers and retry.")
        return
      }
      
      const createSubscription = httpsCallable(functions, 'createRazorpaySubscription')
      const result = await createSubscription({ planId: priceId })
      const { subscriptionId, keyId, mock } = result.data



      const options = {
        key: keyId,
        subscription_id: subscriptionId,
        name: 'SprintOS',
        description: 'Engineering Execution Platform Subscription',
        handler: function (response) {
          window.location.assign('/workspace?billing=success')
        },
        prefill: {
          email: user.email,
        },
        theme: {
          color: '#111827'
        }
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', function (response){
        setAlertMessage("Transaction failed. Please verify your payment details and try again.")
        setLoadingPriceId(null)
      })
      rzp.open()

    } catch (error) {
      console.error('Checkout error:', error)
      setAlertMessage('Unable to establish a secure checkout session. Please try again later.')
      setLoadingPriceId(null)
    }
  }

  return (
    <div className="landing-page">
      <SEOHead 
        title="Paper5 | Engineering Execution & Sprint Tracking Platform" 
        description="SprintOS by Paper5 is the engineering execution platform for tech startups. Streamline sprint planning, automate stack integrations (GitHub, Slack, Discord, Vercel), and track team velocity."
        canonicalUrl="https://paper5.com"
      />
      <MarketingNav />

      <main>
        {/* Asymmetric Hero */}
        <AnimatedGridBackgroundSection>
          <section className="hero-section">
            <div className="hero-grid">
              <div className="hero-content">
                <h1>
                  <ErrorBoundary>
                    <ModernTextReveal text="Everything on paper.<br />Nothing on trust." />
                  </ErrorBoundary>
                </h1>
                <p>
                  Strict compliance, automated standups, and crystal-clear analytics—so you can focus on shipping.
                </p>
                <div className="hero-cta-group">
                  {user ? (
                    <button className="btn-primary btn-lg" onClick={() => navigate('/workspace')}>Open Dashboard</button>
                  ) : (
                    <button className="btn-primary btn-lg" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>Start for free</button>
                  )}
                </div>
              </div>
            </div>
          </section>
        </AnimatedGridBackgroundSection>

        {/* Security / Trust Section */}
        <section className="trust-section">
          <p className="trust-text">Enterprise-grade security and reliability. SOC2 Type II, GDPR, and DPDP compliant infrastructure.</p>
        </section>

        {/* Features Carousel */}
        <section className="features-section">
          <div className="section-header">
            <h2>Engineering-grade tracking.</h2>
            <p>Designed to stay out of your way until you need it.</p>
          </div>
          <div className="features-carousel">
            <div className="bento-card">
              <h3>Strict Data Isolation</h3>
              <p>Every workspace is cryptographically isolated. We meet DPDP standards out of the box so you don't have to think about compliance.</p>
            </div>
            <div className="bento-card">
              <h3>Automated Standups</h3>
              <p>Daily digests delivered straight to your inbox, keeping the team aligned without useless meetings.</p>
            </div>
            <div className="bento-card">
              <h3>Velocity Analytics</h3>
              <p>Real-time burndown charts and risk detection. Know if a sprint is failing before the deadline hits.</p>
            </div>
            <div className="bento-card">
              <h3>Deep Integrations</h3>
              <p>Connect GitHub, Slack, and Vercel. Paper5 lives where your code lives, updating automatically based on your real activity.</p>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="pricing-section">
          <div className="section-header">
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
                onClick={() => navigate('/signup')}
              >
                Get Started for Free
              </button>
              <ul className="tier-features">
                <li>1 Workspace</li>
                <li>Unlimited Members</li>
                <li>Basic GitHub Integration</li>
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
                onClick={() => navigate('/signup')}
              >
                Get Started for Free
              </button>
              <ul className="tier-features">
                <li>Unlimited Workspaces</li>
                <li>Unlimited Members</li>
                <li>GitHub, Slack & Vercel</li>
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
                onClick={() => navigate('/signup')}
              >
                Get Started for Free
              </button>
              <ul className="tier-features">
                <li>Unlimited Workspaces</li>
                <li>Unlimited Members</li>
                <li>Advanced Risk Analytics</li>
                <li>Github, Google Calendar, Discord, Slack, Vercel integration</li>
                <li>Priority API Access</li>
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
