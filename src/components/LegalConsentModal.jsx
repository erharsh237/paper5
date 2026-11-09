import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth, CURRENT_LEGAL_VERSION } from '../lib/AuthContext'
import LegalPolicyModal from './LegalPolicyModal'
import './Modal.css'

export default function LegalConsentModal() {
  const { userData, acceptLegalTerms } = useAuth()
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  const [policyDoc, setPolicyDoc] = useState(null)

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
    <>
      <div className="modal-backdrop" style={{ zIndex: 9999 }}>
        <div className="modal" style={{ maxWidth: '440px', padding: '32px' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>Updated Terms & Privacy Policy</h2>
          <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            We've updated our{' '}
            <button 
              type="button"
              onClick={() => setPolicyDoc('terms')} 
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit', fontWeight: 600 }}
            >
              Terms of Service
            </button>{' '}
            and{' '}
            <button 
              type="button"
              onClick={() => setPolicyDoc('privacy')} 
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit', fontWeight: 600 }}
            >
              Privacy Policy
            </button>{' '}
            to better protect your data and comply with new regulations.
            <br /><br />
            Please review and accept these updated terms to continue using Paper5.
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

      <LegalPolicyModal 
        isOpen={Boolean(policyDoc)} 
        docId={policyDoc} 
        onClose={() => setPolicyDoc(null)} 
      />
    </>
  )
}
