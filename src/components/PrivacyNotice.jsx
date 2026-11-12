import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, SlidersHorizontal, X } from 'lucide-react'
import {
  getConsentState,
  hasMadeConsentChoice,
  saveConsentDecision,
  subscribeConsent,
  subscribeOpenConsentPreferences
} from '../lib/privacyPrefs'
import './PrivacyNotice.css'

export default function CookieConsent() {
  const [visible, setVisible] = useState(() => !hasMadeConsentChoice())
  const [showPrefs, setShowPrefs] = useState(false)
  const [analyticsEnabled, setAnalyticsEnabled] = useState(() => Boolean(getConsentState()?.analytics))

  useEffect(() => {
    const unsubConsent = subscribeConsent((state) => {
      setAnalyticsEnabled(Boolean(state?.analytics))
    })
    const unsubOpen = subscribeOpenConsentPreferences(() => {
      const current = getConsentState()
      setAnalyticsEnabled(Boolean(current?.analytics))
      setShowPrefs(true)
      setVisible(true)
    })
    return () => {
      unsubConsent()
      unsubOpen()
    }
  }, [])

  if (!visible) return null

  const handleAcceptAll = () => {
    saveConsentDecision(true)
    setShowPrefs(false)
    setVisible(false)
  }

  const handleRejectNonEssential = () => {
    saveConsentDecision(false)
    setShowPrefs(false)
    setVisible(false)
  }

  const handleSavePreferences = () => {
    saveConsentDecision(analyticsEnabled)
    setShowPrefs(false)
    setVisible(false)
  }

  return (
    <aside
      className="p5-consent-wrap"
      role="dialog"
      aria-label="Cookie and Privacy Preferences"
      aria-live="polite"
    >
      <div className="p5-consent-card">
        <div className="p5-consent-header">
          <div className="p5-consent-title-row">
            <ShieldCheck size={18} className="p5-consent-icon" aria-hidden="true" />
            <h2 className="p5-consent-title">Cookie &amp; Privacy Preferences</h2>
          </div>
          {hasMadeConsentChoice() && (
            <button
              type="button"
              className="p5-consent-close"
              onClick={() => setVisible(false)}
              aria-label="Close cookie preferences"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        <p className="p5-consent-body">
          Paper5 uses strictly necessary storage and session cookies (`HttpOnly` authentication tokens and security verification) so workspaces stay signed in and protected. Optional analytics cookies run only with your consent.{' '}
          <Link to="/privacy" className="p5-consent-link">Read Privacy Policy</Link>.
        </p>

        {showPrefs && (
          <div className="p5-consent-prefs">
            <div className="p5-consent-pref-row">
              <div>
                <div className="p5-consent-pref-name">Strictly Necessary</div>
                <div className="p5-consent-pref-desc">
                  Authentication sessions (`sb_access_token`, `sb_refresh_token`), anti-bot verification, and theme state. Always active.
                </div>
              </div>
              <span className="p5-consent-badge">Always Active</span>
            </div>

            <label className="p5-consent-pref-row p5-consent-pref-toggle" htmlFor="p5-analytics-consent">
              <div>
                <div className="p5-consent-pref-name">Analytics &amp; Telemetry</div>
                <div className="p5-consent-pref-desc">
                  Optional usage measurement (Google Tag Manager &amp; Google Analytics 4, Vercel Web Analytics, live presence, and error replay).
                </div>
              </div>
              <input
                id="p5-analytics-consent"
                type="checkbox"
                checked={analyticsEnabled}
                onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                className="p5-consent-checkbox"
              />
            </label>
          </div>
        )}

        <div className="p5-consent-actions">
          <button
            type="button"
            className="p5-consent-btn p5-consent-btn-ghost"
            onClick={() => setShowPrefs((prev) => !prev)}
          >
            <SlidersHorizontal size={14} aria-hidden="true" />
            <span>{showPrefs ? 'Hide Details' : 'Customize'}</span>
          </button>

          <div className="p5-consent-actions-right">
            <button
              type="button"
              className="p5-consent-btn p5-consent-btn-secondary"
              onClick={handleRejectNonEssential}
            >
              Reject Non-Essential
            </button>
            {showPrefs ? (
              <button
                type="button"
                className="p5-consent-btn p5-consent-btn-primary"
                onClick={handleSavePreferences}
              >
                Save Preferences
              </button>
            ) : (
              <button
                type="button"
                className="p5-consent-btn p5-consent-btn-primary"
                onClick={handleAcceptAll}
              >
                Accept All
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
