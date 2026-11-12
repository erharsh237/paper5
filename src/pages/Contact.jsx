import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import MarketingLayout from '../components/MarketingLayout'
import SEOHead from '../components/SEOHead'
import Turnstile from '../components/Turnstile'
import { Mail, Clock, ShieldCheck, MessageSquare, Send, CheckCircle2, ArrowRight } from 'lucide-react'
import { useSubmitRateLimit } from '../hooks/useSubmitRateLimit'
import './Contact.css'

export default function Contact() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'General Inquiry',
    message: '',
    website: ''
  })
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileRef = useRef(null)
  const hasTurnstileKey = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const { isLockedOut, cooldownRemaining, startCooldown } = useSubmitRateLimit(30, 5)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    if (!formData.email.trim() || !formData.message.trim()) {
      setError('Please provide your email address and message.')
      return
    }
    if (formData.message.trim().length < 5) {
      setError('Please enter a message of at least 5 characters.')
      return
    }

    if (isLockedOut) {
      setError(`Please wait ${cooldownRemaining}s before submitting again.`)
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const response = await fetch('/api/public?action=contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          subject: formData.subject,
          message: formData.message.trim(),
          website: formData.website,
          turnstileToken,
          source: 'Paper5 Contact Page'
        })
      })

      const data = await response.json().catch(() => ({}))
      if (response.ok) {
        const submittedEmail = formData.email.trim()
        const submittedSubject = formData.subject
        setSubmitted(true)
        setFormData({ name: '', email: '', subject: 'General Inquiry', message: '', website: '' })
        navigate('/thank-you', {
          state: {
            submitted: true,
            submissionId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            source: 'contact_page',
            subject: submittedSubject,
            email: submittedEmail
          }
        })
      } else {
        throw new Error(data.error || 'Failed to deliver message.')
      }
    } catch (err) {
      console.error('Contact submission error:', err)
      if (turnstileRef.current) turnstileRef.current.reset()
      setError(err?.message || 'Something went wrong. You can also email us directly at support@paper5.co.')
    } finally {
      setSubmitting(false)
      startCooldown()
    }
  }

  return (
    <MarketingLayout>
      <SEOHead 
        title="Contact Us & Team Support | Paper5"
        description="Get in touch with Paper5. Reach out for sales inquiries, technical support, enterprise security disclosures, or product feedback."
        canonicalUrl="https://paper5.co/contact"
      />

      <div className="contact-page">
        {/* Hero Section */}
        <header className="contact-hero">
          <div className="contact-badge">
            <span className="contact-badge-dot"></span>
            <span>GET IN TOUCH</span>
          </div>
          <h1 className="contact-title">We are here to help.</h1>
          <p className="contact-subtitle">
            Have questions about Paper5, enterprise plans, or need technical support? Send us a message or reach out directly.
          </p>
        </header>

        {/* Content Section */}
        <div className="contact-container">
          <div className="contact-grid">
            {/* Form Column */}
            <div className="contact-card">
              <h2 className="contact-form-title">Send us a message</h2>
              <p className="contact-form-desc">
                Fill out the form below and a member of our team will respond within 12–24 hours.
              </p>

              {submitted ? (
                <div className="contact-success">
                  <CheckCircle2 size={40} style={{ margin: '0 auto 12px auto' }} />
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 700 }}>Thank you for reaching out!</h3>
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5 }}>
                    We have received your message and will get back to you at your email address shortly.
                  </p>
                  <button 
                    className="btn-secondary" 
                    style={{ marginTop: '16px', padding: '8px 16px', fontSize: '13px' }}
                    onClick={() => setSubmitted(false)}
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  {error && <div className="contact-error">{error}</div>}

                  <div style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }} aria-hidden="true">
                    <label htmlFor="contact-website">Website</label>
                    <input
                      id="contact-website"
                      name="website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={formData.website}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="contact-form-group">
                    <label className="contact-label" htmlFor="contact-name">Your Name</label>
                    <input 
                      id="contact-name"
                      name="name"
                      type="text"
                      maxLength={100}
                      className="contact-input"
                      placeholder="e.g. Alex Morgan"
                      value={formData.name}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="contact-form-group">
                    <label className="contact-label" htmlFor="contact-email">Work Email *</label>
                    <input 
                      id="contact-email"
                      name="email"
                      type="email"
                      required
                      maxLength={254}
                      className="contact-input"
                      placeholder="alex@company.com"
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="contact-form-group">
                    <label className="contact-label" htmlFor="contact-subject">Topic / Subject</label>
                    <select 
                      id="contact-subject"
                      name="subject"
                      className="contact-select"
                      value={formData.subject}
                      onChange={handleChange}
                    >
                      <option value="General Inquiry">General Inquiry</option>
                      <option value="Sales & Enterprise">Sales &amp; Enterprise Demo</option>
                      <option value="Technical Support">Technical Support &amp; Bugs</option>
                      <option value="Billing & Invoices">Billing &amp; Invoices</option>
                      <option value="Security Disclosure">Security &amp; Compliance</option>
                      <option value="Product Feedback">Product Feedback</option>
                    </select>
                  </div>

                  <div className="contact-form-group">
                    <label className="contact-label" htmlFor="contact-message">Message *</label>
                    <textarea 
                      id="contact-message"
                      name="message"
                      required
                      minLength={5}
                      maxLength={3000}
                      className="contact-textarea"
                      placeholder="Tell us what you need help with..."
                      value={formData.message}
                      onChange={handleChange}
                    ></textarea>
                  </div>

                  {hasTurnstileKey && (
                    <Turnstile
                      ref={turnstileRef}
                      action="contact"
                      onSuccess={(tok) => setTurnstileToken(tok)}
                      onExpire={() => setTurnstileToken('')}
                    />
                  )}

                  <button 
                    type="submit" 
                    className="contact-submit-btn" 
                    disabled={submitting || isLockedOut}
                  >
                    {submitting ? (
                      <span>Sending...</span>
                    ) : (
                      <>
                        <span>Send Message</span>
                        <Send size={16} />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Support Sidebar Info Column */}
            <div className="contact-sidebar">
              <div className="contact-info-card">
                <div className="contact-icon-box">
                  <Mail size={20} />
                </div>
                <div>
                  <h3 className="contact-info-title">Email Customer Support</h3>
                  <p className="contact-info-desc">For general help, workspace troubleshooting, or account questions.</p>
                  <a href="mailto:support@paper5.co" className="contact-info-link">
                    support@paper5.co &rarr;
                  </a>
                </div>
              </div>

              <div className="contact-info-card">
                <div className="contact-icon-box">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="contact-info-title">Rapid Response SLA</h3>
                  <p className="contact-info-desc">We respond to all verified workspace inquiries within 12–24 business hours.</p>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Monday – Friday (IST / UTC)</span>
                </div>
              </div>

              <div className="contact-info-card">
                <div className="contact-icon-box">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="contact-info-title">Security &amp; Vulnerabilities</h3>
                  <p className="contact-info-desc">For encrypted vulnerability reports or compliance inquiries.</p>
                  <a href="mailto:security@paper5.co" className="contact-info-link">
                    security@paper5.co &rarr;
                  </a>
                </div>
              </div>

              <div className="contact-info-card">
                <div className="contact-icon-box">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className="contact-info-title">Community &amp; Updates</h3>
                  <p className="contact-info-desc">Follow our development updates, release notes, and product announcements.</p>
                  <a href="https://x.com/paper5hq" target="_blank" rel="noreferrer" className="contact-info-link">
                    @paper5hq on X &rarr;
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <section className="contact-faq-section">
          <h2 className="contact-faq-title">Frequently Asked Questions</h2>
          <p className="contact-faq-subtitle">Common questions from engineering teams moving to Paper5.</p>

          <div className="contact-faq-grid">
            <div className="contact-faq-item">
              <h4>How do I invite my engineering team?</h4>
              <p>Once you create a workspace, visit Workspace Settings &gt; Team Members and send instant email invitations or copy your secure workspace join link.</p>
            </div>
            <div className="contact-faq-item">
              <h4>Can I export all our project data?</h4>
              <p>Yes. Paper5 guarantees full data ownership. You can export complete vector PDF workspace summaries and CSV reports anytime from your settings.</p>
            </div>
            <div className="contact-faq-item">
              <h4>Where is our data hosted?</h4>
              <p>Paper5 infrastructure is hosted in enterprise-grade ISO 27001 / SOC2 Type II certified data centers with strict PostgreSQL Row-Level Security isolation.</p>
            </div>
          </div>
        </section>
      </div>
    </MarketingLayout>
  )
}
