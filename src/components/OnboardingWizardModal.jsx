import { useState, useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { createWorkspace } from '../lib/workspaces'
import { supabase } from '../lib/supabase'
import logo from '../assets/logo.png'
import { Check, ArrowRight, Database, ShieldAlert, Sparkles, Building2, Users, Layers, ShieldCheck } from 'lucide-react'
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
  const location = useLocation()

  // 4-Step Wizard: 1: Pricing/Tier, 2: T&C Consent, 3: Workspace Creation, 4: Data Storing Consent
  const [step, setStep] = useState(1)
  const [selectedTier, setSelectedTier] = useState('team')

  // Step 2: Legal Consent State
  const [termsAccepted, setTermsAccepted] = useState(true)
  const [dpaAccepted, setDpaAccepted] = useState(true)

  // Step 3: Workspace Creation Form State
  const [wsName, setWsName] = useState('')
  const [teamSize, setTeamSize] = useState('2-5')
  const [agileWorkflow, setAgileWorkflow] = useState('kanban')

  // Step 4: Data Storing Consent State (Default Turned Off)
  const [saveData, setSaveData] = useState(false)
  
  const [isPrimaryAdmin, setIsPrimaryAdmin] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const publicAuthPaths = ['/login', '/signup', '/forgot-password', '/verify', '/auth/action']
  const isAuthPage = publicAuthPaths.some(p => location.pathname.startsWith(p))

  // Determine if the user is the FIRST ADMIN creator vs an invited member/co-admin
  useEffect(() => {
    if (!user || isAuthPage) return

    let isMounted = true
    const checkRole = async () => {
      try {
        // 1. Check workspace memberships: if user is already a member of an existing workspace created by someone else
        const { data: memberships } = await supabase
          .from('workspace_members')
          .select('role, workspace_id')
          .eq('user_id', user.id)

        if (memberships && memberships.length > 0) {
          // Check if any workspace is owned by someone else
          const { data: ownedWs } = await supabase
            .from('workspaces')
            .select('id')
            .eq('owner_id', user.id)

          if (!ownedWs || ownedWs.length === 0) {
            // User is a member/co-admin in someone else's workspace — NOT primary creator!
            if (isMounted) setIsPrimaryAdmin(false)
            if (userData?.billing_plan_id === 'unselected') {
              await supabase.from('users').update({ billing_plan_id: 'member' }).eq('id', user.id)
              if (updateUserData) updateUserData({ billing_plan_id: 'member' })
            }
            return
          }
        }

        // 2. Check if user has pending invites to join an existing workspace
        if (user?.email) {
          try {
            const { data: invites, error: inviteErr } = await supabase
              .from('workspace_invites')
              .select('id')
              .eq('email', user.email)
              .eq('status', 'pending')

            if (!inviteErr && invites && invites.length > 0) {
              // User was invited — NOT primary creator!
              if (isMounted) setIsPrimaryAdmin(false)
              if (userData?.billing_plan_id === 'unselected') {
                await supabase.from('users').update({ billing_plan_id: 'member' }).eq('id', user.id)
                if (updateUserData) updateUserData({ billing_plan_id: 'member' })
              }
              return
            }
          } catch (invErr) {
            console.error('Pending invites query error ignored:', invErr)
          }
        }

        // User is the FIRST ADMIN creator of a new workflow
        if (isMounted) setIsPrimaryAdmin(true)
      } catch (err) {
        console.error('Failed to check primary admin role:', err)
        if (isMounted) setIsPrimaryAdmin(true)
      }
    }

    checkRole()
    return () => { isMounted = false }
  }, [user, userData, isAuthPage, updateUserData])

  // Hard gating: modal renders ONLY for the FIRST PRIMARY ADMIN of a workflow on non-auth pages
  const needsOnboarding = Boolean(
    !isAuthPage &&
    user && 
    userData &&
    isPrimaryAdmin === true &&
    (!userData.billing_plan_id || userData.billing_plan_id === 'none' || userData.billing_plan_id === 'unselected' || !userData.legal_accepted_at)
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
      setStep(3)
      return
    }

    setLoading(true)
    setError('')

    try {
      // 1. Update Supabase users table with selected Account Tier & Legal Consent
      const { error: dbError } = await supabase
        .from('users')
        .update({ 
          billing_plan_id: selectedTier,
          billing_status: 'active',
          legal_accepted_version: '1.0.0',
          legal_accepted_at: new Date().toISOString(),
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
            <img src={logo} alt="SprintOS Logo" style={{ height: '32px', width: 'auto' }} />
            <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: '#09090b' }}>
              SprintOS {wsName.trim() ? `| ${wsName.trim()}` : ''}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: step === 1 ? '#10b981' : '#71717a' }}>
              <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: step === 1 ? '#10b981' : '#e4e4e7', color: step === 1 ? '#ffffff' : '#71717a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>1</span>
              Pricing & Tier
            </div>
            <div style={{ color: '#d4d4d8' }}>•</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: step === 2 ? '#10b981' : '#71717a' }}>
              <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: step === 2 ? '#10b981' : '#e4e4e7', color: step === 2 ? '#ffffff' : '#71717a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>2</span>
              T&C & Consent
            </div>
            <div style={{ color: '#d4d4d8' }}>•</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: step === 3 ? '#10b981' : '#71717a' }}>
              <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: step === 3 ? '#10b981' : '#e4e4e7', color: step === 3 ? '#ffffff' : '#71717a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>3</span>
              Workspace
            </div>
            <div style={{ color: '#d4d4d8' }}>•</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: step === 4 ? '#10b981' : '#71717a' }}>
              <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: step === 4 ? '#10b981' : '#e4e4e7', color: step === 4 ? '#ffffff' : '#71717a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>4</span>
              Data Consent
            </div>
          </div>

          <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.02em', color: '#09090b' }}>
            {step === 1 && 'Select Your Account Tier'}
            {step === 2 && 'Terms & Compliance Agreements'}
            {step === 3 && 'Create Your Team Workspace'}
            {step === 4 && 'Data Storage & Persistence Preference'}
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#71717a', lineHeight: 1.5, maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
            {step === 1 && 'Choose an account tier to unlock SprintOS. Paid plans are 100% Free during Launch.'}
            {step === 2 && 'Review and accept our legal terms, privacy policy, and data processing agreement to continue.'}
            {step === 3 && 'Name your workspace and align your agile workflow methodology.'}
            {step === 4 && 'Choose whether to enable persistent cloud database backup or transient memory mode.'}
          </p>
        </div>

        {error && (
          <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', textAlign: 'left' }}>
            {error}
          </div>
        )}

        {/* STEP 1: Account Tier Selection */}
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
                padding: '14px',
                borderRadius: '10px',
                background: '#09090b',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              <span>Continue to Terms & Consent</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* STEP 2: T&C and Legal Consent */}
        {step === 2 && (
          <div style={{ textAlign: 'left', maxWidth: '640px', margin: '0 auto' }}>
            <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#0f172a', fontWeight: 700, fontSize: '15px' }}>
                <ShieldCheck size={20} color="#10b981" />
                <span>SprintOS Legal & Compliance Framework</span>
              </div>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, margin: '0 0 16px 0' }}>
                Before setting up your workspace, please review our legal terms. By continuing, you agree to comply with our terms of service, privacy practices, and security agreements.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#1e293b' }}>
                  <input 
                    type="checkbox" 
                    checked={termsAccepted} 
                    onChange={e => setTermsAccepted(e.target.checked)} 
                    style={{ marginTop: '3px', accentColor: '#10b981', width: '16px', height: '16px' }}
                  />
                  <span>
                    I accept the <a href="/terms" target="_blank" rel="noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>Terms of Service</a> and <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>Privacy Policy</a>.
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#1e293b' }}>
                  <input 
                    type="checkbox" 
                    checked={dpaAccepted} 
                    onChange={e => setDpaAccepted(e.target.checked)} 
                    style={{ marginTop: '3px', accentColor: '#10b981', width: '16px', height: '16px' }}
                  />
                  <span>
                    I acknowledge the <a href="/dpa" target="_blank" rel="noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>Data Processing Agreement (DPA)</a> and vendor subprocessors.
                  </span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  padding: '14px 20px',
                  borderRadius: '10px',
                  background: '#f4f4f5',
                  color: '#27272a',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: '1px solid #e4e4e7',
                  cursor: 'pointer'
                }}
              >
                ← Back
              </button>

              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!termsAccepted || !dpaAccepted}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '10px',
                  background: (!termsAccepted || !dpaAccepted) ? '#9ca3af' : '#09090b',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: (!termsAccepted || !dpaAccepted) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <span>Accept & Continue to Workspace</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Workspace Creation */}
        {step === 3 && (
          <div style={{ textAlign: 'left', maxWidth: '640px', margin: '0 auto' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#27272a', marginBottom: '6px', display: 'block' }}>
                1. Workspace Name:
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text"
                  placeholder="e.g. Acme Product Engineering"
                  value={wsName}
                  onChange={e => setWsName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 40px',
                    borderRadius: '8px',
                    border: '1px solid #d4d4d8',
                    fontSize: '14px',
                    background: '#ffffff',
                    color: '#09090b',
                    outline: 'none',
                    fontWeight: 500
                  }}
                  autoFocus
                />
                <Building2 size={18} color="#71717a" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#27272a', marginBottom: '6px', display: 'block' }}>
                2. Expected Team Size:
              </label>
              <select
                value={teamSize}
                onChange={e => handleTeamSizeChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #d4d4d8',
                  fontSize: '14px',
                  background: '#ffffff',
                  color: '#09090b',
                  outline: 'none',
                  fontWeight: 500
                }}
              >
                {TEAM_SIZE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#27272a', margin: 0 }}>
                  3. Aligned Agile Workflow Methodology:
                </label>
                <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                  Auto-aligned to Team Size
                </span>
              </div>
              
              <select
                value={agileWorkflow}
                onChange={e => setAgileWorkflow(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #d4d4d8',
                  fontSize: '14px',
                  background: '#ffffff',
                  color: '#09090b',
                  outline: 'none',
                  fontWeight: 500
                }}
              >
                {WORKFLOWS.map(wf => (
                  <option key={wf.id} value={wf.id}>
                    {wf.num}. {wf.name} ({wf.teamSizeLabel})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                style={{
                  padding: '14px 20px',
                  borderRadius: '10px',
                  background: '#f4f4f5',
                  color: '#27272a',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: '1px solid #e4e4e7',
                  cursor: 'pointer'
                }}
              >
                ← Back
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!wsName.trim()) {
                    setError('Please enter a workspace name to continue.')
                    return
                  }
                  setError('')
                  setStep(4)
                }}
                disabled={!wsName.trim()}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '10px',
                  background: !wsName.trim() ? '#9ca3af' : '#09090b',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: !wsName.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <span>Continue to Data Storage Consent</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Data Storing Consent */}
        {step === 4 && (
          <div style={{ textAlign: 'left', maxWidth: '640px', margin: '0 auto' }}>
            <div style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '20px',
              marginBottom: '28px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Database size={20} color={saveData ? '#10b981' : '#64748b'} />
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>Cloud Data Persistence</span>
                </div>
                
                <button
                  type="button"
                  role="switch"
                  aria-checked={saveData}
                  onClick={() => setSaveData(!saveData)}
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    width: '48px',
                    height: '26px',
                    borderRadius: '34px',
                    border: 'none',
                    backgroundColor: saveData ? '#10b981' : '#cbd5e1',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                    padding: 0,
                    outline: 'none'
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    height: '20px',
                    width: '20px',
                    left: saveData ? '25px' : '3px',
                    top: '3px',
                    backgroundColor: '#ffffff',
                    borderRadius: '50%',
                    transition: 'left 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                </button>
              </div>

              {saveData ? (
                <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#10b981' }}>✓</span> Cloud Sync Enabled (Recommended)
                  </div>
                  Workspaces, sprints, and team task items are securely persisted in encrypted database storage for cross-device synchronization and team collaboration.
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: '#b45309', lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldAlert size={16} color="#d97706" /> Zero-Data Retention Mode Active
                  </div>
                  No workspace telemetry or task data is stored on remote servers. All sprint items exist strictly in local browser memory. Closing your browser session permanently purges transient workspace data.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={loading}
                style={{
                  padding: '14px 20px',
                  borderRadius: '10px',
                  background: '#f4f4f5',
                  color: '#27272a',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: '1px solid #e4e4e7',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                ← Back
              </button>

              <button
                type="button"
                onClick={handleCompleteOnboarding}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '10px',
                  background: '#10b981',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                }}
              >
                <span>{loading ? 'Setting up Workspace...' : '🚀 Launch SprintOS Workspace'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
