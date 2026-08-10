import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import logo from '../assets/logo.png'
import { Check, ShieldCheck, Zap, Sparkles } from 'lucide-react'

const TIERS = [
  {
    id: 'free',
    name: 'Starter',
    badge: 'Individual & Small Teams',
    price: 'Free',
    subtext: 'Free Forever',
    workspaces: '1 Workspace',
    seats: 'Up to 3 Seats',
    features: [
      '1 Workspace included',
      'Up to 3 Team Members',
      'Ad-hoc & Kanban Workflows',
      'GitHub PR Sync',
      'Vector PDF Data Export'
    ]
  },
  {
    id: 'team',
    name: 'Team',
    badge: 'Launch Special - Recommended',
    recommended: true,
    price: '$0',
    originalPrice: '$29/mo',
    subtext: '100% Unlocked during Launch',
    workspaces: '5 Workspaces',
    seats: 'Up to 7 Seats',
    features: [
      '5 Workspaces included',
      'Up to 7 Team Members',
      'All 8 Agile Methodology Tiers',
      'API Webhooks & Integrations',
      'Audit Logs & Strict Security'
    ]
  },
  {
    id: 'scale',
    name: 'Scale',
    badge: 'High-Velocity Engineering',
    price: '$0',
    originalPrice: '$79/mo',
    subtext: '100% Unlocked during Launch',
    workspaces: '10 Workspaces',
    seats: 'Unlimited Seats',
    features: [
      '10 Workspaces included',
      'Unlimited Team Members',
      'All 8 Agile Methodology Tiers',
      'Dedicated API Webhook Studio',
      'Priority Support & SLAs'
    ]
  }
]

export default function AccountTierModal() {
  const { user, userData, updateUserData } = useAuth()
  const [selectedTier, setSelectedTier] = useState('team')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Show modal ONLY if user is logged in, email is verified, BUT billing_plan_id is missing or unselected
  const needsTierSelection = Boolean(
    user && 
    user.emailVerified && 
    (!userData?.billing_plan_id || userData?.billing_plan_id === 'none' || userData?.billing_plan_id === 'unselected')
  )

  if (!needsTierSelection) return null

  const handleConfirmTier = async () => {
    setSaving(true)
    setError('')
    try {
      // 1. Update Supabase users table
      const { error: dbError } = await supabase
        .from('users')
        .update({ 
          billing_plan_id: selectedTier,
          billing_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (dbError) throw dbError

      // 2. Update AuthContext state locally so app unblocks immediately
      if (updateUserData) {
        await updateUserData({ billing_plan_id: selectedTier, billing_status: 'active' })
      } else {
        window.location.reload()
      }
    } catch (err) {
      console.error('Failed to select account tier:', err)
      setError(err?.message || 'Failed to set account tier. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999999,
      background: 'rgba(9, 9, 11, 0.88)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      overflowY: 'auto'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        maxWidth: '860px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        border: '1px solid #e4e4e7',
        padding: '32px',
        textAlign: 'center',
        color: '#18181b',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <img src={logo} alt="Paper5 Logo" style={{ height: '32px', width: 'auto' }} />
            <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: '#09090b' }}>SprintOS™ by Paper5™</span>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.02em', color: '#09090b' }}>
            Select Your Account Tier to Continue
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#71717a', lineHeight: 1.5, maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
            Choose an account tier to finish setting up your workspace. All paid plans are <strong>100% Free during Launch</strong>. Selection is required to proceed.
          </p>
        </div>

        {/* Tier Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px', textAlign: 'left' }}>
          {TIERS.map(tier => {
            const isSelected = selectedTier === tier.id
            return (
              <div 
                key={tier.id}
                onClick={() => setSelectedTier(tier.id)}
                style={{
                  borderRadius: '12px',
                  border: isSelected ? '2px solid #10b981' : '1px solid #e4e4e7',
                  background: isSelected ? 'rgba(16, 185, 129, 0.04)' : '#ffffff',
                  padding: '20px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 10px 25px -5px rgba(16, 185, 129, 0.15)' : 'none'
                }}
              >
                {tier.recommended && (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    right: '16px',
                    background: '#10b981',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '3px 10px',
                    borderRadius: '100px'
                  }}>
                    Recommended
                  </div>
                )}

                <div style={{ fontSize: '18px', fontWeight: 800, color: '#09090b', marginBottom: '4px' }}>
                  {tier.name}
                </div>
                <div style={{ fontSize: '11px', color: '#71717a', marginBottom: '12px' }}>
                  {tier.badge}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '28px', fontWeight: 900, color: '#09090b' }}>{tier.price}</span>
                  {tier.originalPrice && (
                    <span style={{ fontSize: '13px', color: '#a1a1aa', textDecoration: 'line-through' }}>{tier.originalPrice}</span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 700, marginBottom: '16px' }}>
                  {tier.subtext}
                </div>

                <div style={{ fontSize: '12px', fontWeight: 700, color: '#27272a', borderTop: '1px solid #f4f4f5', paddingTop: '12px', marginBottom: '8px' }}>
                  Includes: {tier.workspaces} ({tier.seats})
                </div>

                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {tier.features.map((feat, idx) => (
                    <li key={idx} style={{ fontSize: '12px', color: '#52525b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Check size={14} color="#10b981" style={{ flexShrink: 0 }} />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {error && (
          <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* Action Button */}
        <div>
          <button
            type="button"
            onClick={handleConfirmTier}
            disabled={saving}
            style={{
              width: '100%',
              maxWidth: '380px',
              padding: '14px 28px',
              borderRadius: '10px',
              background: '#09090b',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: 700,
              border: 'none',
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.7 : 1,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              transition: 'all 0.2s'
            }}
          >
            {saving ? 'Saving Account Tier...' : '🚀 Confirm & Continue to SprintOS'}
          </button>
          <div style={{ marginTop: '12px', fontSize: '11px', color: '#a1a1aa' }}>
            🔒 You can upgrade or modify your workspace plan anytime in Workspace Settings.
          </div>
        </div>
      </div>
    </div>
  )
}
