import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { createWorkspace } from '../lib/workspaces'
import { supabase } from '../lib/supabase'
import logo from '../assets/logo.png'
import { Check, ArrowRight, Database, ShieldAlert, Sparkles, Building2, Users, Layers } from 'lucide-react'
import { TEAM_SIZE_OPTIONS, WORKFLOWS, getRecommendedWorkflow } from '../lib/workflows'

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

export default function OnboardingWizardModal() {
  const { user, userData, updateUserData } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1) // 1: Tier Selection, 2: Workspace Creation & Data Consent
  const [selectedTier, setSelectedTier] = useState('team')

  // Workspace Creation Form State
  const [wsName, setWsName] = useState('')
  const [teamSize, setTeamSize] = useState('2-5')
  const [agileWorkflow, setAgileWorkflow] = useState('kanban')
  const [saveData, setSaveData] = useState(true)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Hard gating: modal renders ONLY if user is logged in & verified, BUT missing tier selection OR missing workspace
  const needsOnboarding = Boolean(
    user && 
    user.emailVerified && 
    (!userData?.billing_plan_id || userData?.billing_plan_id === 'none' || userData?.billing_plan_id === 'unselected')
  )

  if (!needsOnboarding) return null

  const handleTeamSizeChange = (val) => {
    setTeamSize(val)
    const recommended = getRecommendedWorkflow(val)
    setAgileWorkflow(recommended.id)
  }

  const handleCompleteOnboarding = async (e) => {
    if (e) e.preventDefault()
    if (!wsName.trim()) {
      setError('Please enter a workspace name to continue.')
      return
    }

    setLoading(true)
    setError('')

    try {
      // 1. Update Supabase users table with selected Account Tier
      const { error: dbError } = await supabase
        .from('users')
        .update({ 
          billing_plan_id: selectedTier,
          billing_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (dbError) throw dbError

      // 2. Create Initial Workspace with Save Data Preference & Workflow
      const newWs = await createWorkspace(
        user.id, 
        user.email, 
        wsName.trim(), 
        teamSize, 
        agileWorkflow, 
        saveData
      )

      // 3. Update AuthContext state locally so app unblocks instantly
      if (updateUserData) {
        await updateUserData({ billing_plan_id: selectedTier, billing_status: 'active' })
      }

      // 4. Navigate directly into the newly created workspace
      navigate(`/${newWs.id}`, { replace: true })
    } catch (err) {
      console.error('Failed to complete onboarding:', err)
      setError(err?.message || 'Failed to complete setup. Please try again.')
    } finally {
      setLoading(false)
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
        maxWidth: '840px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        border: '1px solid #e4e4e7',
        padding: '32px',
        textAlign: 'center',
        color: '#18181b',
        position: 'relative'
      }}>
        {/* Header with Step Indicator */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <img src={logo} alt="Paper5 Logo" style={{ height: '32px', width: 'auto' }} />
            <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: '#09090b' }}>SprintOS™ Onboarding</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '12px', 
              fontWeight: 700,
              color: step === 1 ? '#10b981' : '#71717a'
            }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: step === 1 ? '#10b981' : '#e4e4e7', color: step === 1 ? '#ffffff' : '#71717a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>1</span>
              Account Tier
            </div>
            <div style={{ color: '#d4d4d8' }}>•</div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '12px', 
              fontWeight: 700,
              color: step === 2 ? '#10b981' : '#71717a'
            }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: step === 2 ? '#10b981' : '#e4e4e7', color: step === 2 ? '#ffffff' : '#71717a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>2</span>
              Workspace & Data Preference
            </div>
          </div>

          <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.02em', color: '#09090b' }}>
            {step === 1 ? 'Select Your Account Tier' : 'Provision Your Workspace'}
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#71717a', lineHeight: 1.5, maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
            {step === 1 
              ? 'Choose an account tier to unlock SprintOS. Paid plans are 100% Free during Launch.' 
              : 'Set up your team workspace and configure cloud data persistence preferences.'}
          </p>
        </div>

        {error && (
          <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', textAlign: 'left' }}>
            {error}
          </div>
        )}

        {/* STEP 1: Account Tier Cards */}
        {step === 1 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '28px', textAlign: 'left' }}>
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

            <button
              type="button"
              onClick={() => setStep(2)}
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
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span>Next: Setup Workspace & Data Preferences</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* STEP 2: Workspace Provisioning & Data Storage Consent */}
        {step === 2 && (
          <form onSubmit={handleCompleteOnboarding} style={{ textAlign: 'left' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '24px' }}>
              {/* Workspace Name */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#18181b', marginBottom: '6px' }}>
                  Workspace Name
                </label>
                <input 
                  type="text"
                  placeholder="e.g. Acme Engineering or Starlight Product"
                  value={wsName}
                  onChange={e => setWsName(e.target.value)}
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #d4d4d8',
                    fontSize: '14px',
                    color: '#09090b',
                    background: '#ffffff'
                  }}
                />
              </div>

              {/* Team Size & Workflow */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#18181b', marginBottom: '6px' }}>
                    Team Size
                  </label>
                  <select
                    value={teamSize}
                    onChange={e => handleTeamSizeChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #d4d4d8',
                      fontSize: '14px',
                      color: '#09090b',
                      background: '#ffffff'
                    }}
                  >
                    {TEAM_SIZE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#18181b', marginBottom: '6px' }}>
                    Agile Methodology Workflow
                  </label>
                  <select
                    value={agileWorkflow}
                    onChange={e => setAgileWorkflow(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #d4d4d8',
                      fontSize: '14px',
                      color: '#09090b',
                      background: '#ffffff'
                    }}
                  >
                    {WORKFLOWS.map(wf => (
                      <option key={wf.id} value={wf.id}>{wf.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 💾 Save Data to Cloud Database Toggle & Disclaimers */}
              <div style={{ padding: '16px', background: '#f4f4f5', borderRadius: '10px', border: '1px solid #e4e4e7' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700, color: '#09090b' }}>
                      💾 Save Data to Cloud Database
                    </h4>
                    <p style={{ margin: 0, fontSize: '12px', color: '#71717a' }}>
                      {saveData 
                        ? 'Cloud Persistence Active: Workspace tasks, sprints, and settings are stored in PostgreSQL.' 
                        : '🔒 Zero-Data Retention Mode: Data is stored in browser memory only and destroyed on session close.'}
                    </p>
                  </div>
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={saveData} 
                      onChange={e => setSaveData(e.target.checked)} 
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                {/* Dynamic Disclaimers */}
                <div style={{ 
                  padding: '10px 12px', 
                  borderRadius: '6px', 
                  fontSize: '11px', 
                  lineHeight: 1.45,
                  background: saveData ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  color: saveData ? '#047857' : '#b91c1c',
                  border: saveData ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)'
                }}>
                  <strong>Disclaimer:</strong> {saveData 
                    ? 'Workspace data is encrypted and backed up daily in our secure cloud database. While automated snapshots and point-in-time recovery are maintained, administrators remain responsible for maintaining local offline backups via Workspace Settings → Export.'
                    : 'Data is stored solely in volatile browser session memory. Closing your tab, clearing cache, or logging out will permanently erase workspace data. Neither Paper5™ nor SprintOS™ will be held responsible or liable for any data loss resulting from Zero-Data Retention Mode.'}
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid #f4f4f5', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={loading}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  background: 'none',
                  border: '1px solid #d4d4d8',
                  color: '#3f3f46',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Back to Tiers
              </button>

              <button
                type="submit"
                disabled={loading || !wsName.trim()}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  background: '#09090b',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: loading ? 'wait' : 'pointer',
                  opacity: (loading || !wsName.trim()) ? 0.6 : 1,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
              >
                {loading ? 'Creating Workspace...' : '🚀 Launch SprintOS Workspace'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
