import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth, CURRENT_LEGAL_VERSION } from '../lib/AuthContext'
import './Modal.css'

export default function LegalConsentModal() {
  const { userData, acceptLegalTerms } = useAuth()
  const location = useLocation()
  const [loading, setLoading] = useState(false)

  const publicAuthPaths = ['/login', '/signup', '/forgot-password', '/verify', '/auth/action']
  const isAuthPage = publicAuthPaths.some(p => location.pathname.startsWith(p))

  // Do not show on auth pages or if user is still in the onboarding flow (OnboardingWizardModal handles T&C for new users)
  if (isAuthPage || !userData || !userData.billing_plan_id || userData.billing_plan_id === 'unselected') return null
  
  const acceptedVer = userData.legalAcceptedVersion
  if (acceptedVer && acceptedVer >= CURRENT_LEGAL_VERSION) {
    return null
  }

  const handleAccept = async () => {
    setLoading(true)
    try {
      await acceptLegalTerms()
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" style={{ zIndex: 9999 }}>
      <div className="modal" style={{ maxWidth: '440px', padding: '32px' }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>Updated Terms & Privacy Policy</h2>
        <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          We've updated our <a href="/legal/terms" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Terms of Service</a> and <a href="/legal/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Privacy Policy</a> to better protect your data and comply with new regulations.
          <br /><br />
          Please review and accept these updated terms to continue using SprintOS.
        </p>

        <button 
          className="btn" 
          onClick={handleAccept} 
          disabled={loading}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {loading ? 'Saving...' : 'I Accept'}
        </button>
      </div>
    </div>
  )
}
