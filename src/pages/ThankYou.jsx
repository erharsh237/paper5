import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CheckCircle2, ArrowRight, Mail, BookOpen } from 'lucide-react'
import MarketingLayout from '../components/MarketingLayout'
import SEOHead from '../components/SEOHead'
import { trackEvent } from '../lib/metrics'

const TRACKED_SUBMISSION_KEY = 'p5_last_tracked_submission'

export default function ThankYou() {
  const { state } = useLocation()
  const isVerifiedSubmission = Boolean(state?.submitted && state?.submissionId)

  useEffect(() => {
    if (!isVerifiedSubmission) return
    try {
      const lastTracked = sessionStorage.getItem(TRACKED_SUBMISSION_KEY)
      if (lastTracked === state.submissionId) return
      sessionStorage.setItem(TRACKED_SUBMISSION_KEY, state.submissionId)
    } catch {
      // fallback if sessionStorage is unavailable
    }

    trackEvent('contact_submit', {
      form_source: state?.source || 'contact_page',
      subject: state?.subject || 'General Inquiry'
    })
  }, [isVerifiedSubmission, state?.submissionId, state?.source, state?.subject])

  return (
    <MarketingLayout>
      <SEOHead
        title="Thank You | Paper5"
        description="Confirmation page for Paper5 inquiries."
        noIndex
      />

      <div style={{ minHeight: '65vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 20px' }}>
        <div
          className="glass-panel"
          style={{
            maxWidth: '580px',
            width: '100%',
            padding: '44px 36px',
            borderRadius: '18px',
            border: '1px solid var(--border, #e4e4e7)',
            background: 'var(--bg-layer, #ffffff)',
            textAlign: 'center'
          }}
        >
          {isVerifiedSubmission ? (
            <>
              <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', marginBottom: '20px' }}>
                <CheckCircle2 size={36} aria-hidden="true" />
              </div>

              <h1 style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 12px 0', color: 'var(--text-primary, #09090b)' }}>
                Message Received
              </h1>

              <p style={{ fontSize: '15px', lineHeight: 1.65, color: 'var(--text-secondary, #52525b)', margin: '0 0 24px 0' }}>
                Thank you for contacting Paper5{state?.subject ? ` regarding "${state.subject}"` : ''}. A member of our team will review your note and reply to{' '}
                <strong>{state?.email || 'your email address'}</strong> within 12–24 business hours (Monday–Friday, IST/UTC).
              </p>

              <div style={{ textAlign: 'left', padding: '18px 20px', borderRadius: '12px', background: 'var(--bg-layer-2, rgba(0,0,0,0.03))', border: '1px solid var(--border, #e4e4e7)', marginBottom: '28px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-primary, #09090b)', marginBottom: '10px' }}>
                  What happens next
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13.5px', lineHeight: 1.65, color: 'var(--text-secondary, #52525b)' }}>
                  <li>Your message is routed to our engineering support or sales team.</li>
                  <li>For urgent follow-ups, email <a href="mailto:support@paper5.co" style={{ color: 'inherit', fontWeight: 600 }}>support@paper5.co</a>.</li>
                  <li>While you wait, browse our setup guides and workspace features below.</li>
                </ul>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '999px', background: 'rgba(79, 70, 229, 0.1)', color: 'var(--accent, #4f46e5)', marginBottom: '20px' }}>
                <Mail size={32} aria-hidden="true" />
              </div>

              <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 12px 0', color: 'var(--text-primary, #09090b)' }}>
                Looking to Contact Paper5?
              </h1>

              <p style={{ fontSize: '15px', lineHeight: 1.65, color: 'var(--text-secondary, #52525b)', margin: '0 0 28px 0' }}>
                This page displays confirmation details after you submit our contact form. If you would like to reach our team, please submit an inquiry on our contact page.
              </p>
            </>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
              <span>Back to Homepage</span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            {!isVerifiedSubmission ? (
              <Link to="/contact" className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                <span>Go to Contact Form</span>
              </Link>
            ) : (
              <Link to="/docs" className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                <BookOpen size={15} aria-hidden="true" />
                <span>Explore Documentation</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </MarketingLayout>
  )
}
