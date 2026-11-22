import { useState } from 'react'
import { Check, X } from 'lucide-react'
import './PricingModal.css'

const PLAN_LEVELS = {
  free: 1,
  starter: 1,
  member: 1,
  unselected: 1,
  none: 1,
  team: 2,
  pro: 3,
  scale: 3,
  enterprise: 3
}

export default function PricingModal({ isOpen, onClose, currentPlan, onSelectPlan, initialCycle = 'monthly' }) {
  const [isAnnual, setIsAnnual] = useState(initialCycle === 'annual')
  const [loadingPlan, setLoadingPlan] = useState(null)

  if (!isOpen) return null

  const handleSelect = async (planId) => {
    setLoadingPlan(planId)
    try {
      await onSelectPlan(planId, isAnnual ? 'annual' : 'monthly')
    } finally {
      setLoadingPlan(null)
    }
  }

  const normalizedCurrent = (currentPlan || 'starter').toLowerCase().trim()
  const currentLevel = PLAN_LEVELS[normalizedCurrent] || 1

  const getButtonProps = (targetPlanId) => {
    const targetLevel = PLAN_LEVELS[targetPlanId] || 1
    const planName = targetPlanId === 'pro' || targetPlanId === 'scale' ? 'Pro' : (targetPlanId.charAt(0).toUpperCase() + targetPlanId.slice(1))
    
    if (targetLevel === currentLevel) {
      return { label: `Continue with ${planName}`, disabled: false, className: 'pm-btn pm-btn-primary' }
    }
    if (targetLevel < currentLevel) {
      return { label: `Switch to ${planName}`, disabled: false, className: 'pm-btn pm-btn-ghost' }
    }
    return { label: targetPlanId === 'starter' ? 'Start for Free' : `Claim ${planName} Access`, disabled: false, className: 'pm-btn pm-btn-primary' }
  }

  return (
    <div className="pricing-modal-overlay" onClick={onClose}>
      <div className="pricing-modal-content" onClick={e => e.stopPropagation()}>
        <button className="pricing-modal-close" onClick={onClose} aria-label="Close modal">
          <X size={18} />
        </button>
        
        <div className="pm-header">
          <h2>Launch Special: 100% Free Access</h2>
          <p>All features, integrations, and workspaces are completely unlocked during our early access period.</p>

          {/* Billing Cycle Switcher */}
          <div className="pm-cycle-wrapper">
            <div className="pm-cycle-container">
              <button
                type="button"
                className={`pm-cycle-btn ${!isAnnual ? 'active' : ''}`}
                onClick={() => setIsAnnual(false)}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                className={`pm-cycle-btn ${isAnnual ? 'active' : ''}`}
                onClick={() => setIsAnnual(true)}
              >
                <span>Annual Billing</span>
                <span className="pm-discount-tag">Save 20%</span>
              </button>
            </div>
          </div>
        </div>

        <div className="pm-grid">
          {/* Starter Tier */}
          <div className="pm-card">
            <div className="pm-card-header">
              <div className="pm-tier-title">Starter</div>
              <p className="pm-tier-desc">For solo builders and small squads establishing initial cadence.</p>
            </div>

            <div className="pm-price-box">
              <div className="pm-strikethrough">
                <span className="free-forever">Free Forever Plan</span>
              </div>
              <div className="pm-price-main">
                <span className="pm-price-currency">₹</span>
                <span className="pm-price-amount">0</span>
                <span className="pm-price-period">/ month · forever</span>
              </div>
            </div>
            
            {(() => {
              const btn = getButtonProps('starter')
              return (
                <button 
                  className={btn.className}
                  onClick={() => handleSelect('starter')}
                  disabled={btn.disabled || loadingPlan === 'starter'}
                >
                  {loadingPlan === 'starter' ? 'Updating...' : btn.label}
                </button>
              )
            })()}

            <ul className="pm-features">
              <li className="pm-feature-item">
                <Check size={16} className="pm-check-icon" />
                <span>1 Active Workspace</span>
              </li>
              <li className="pm-feature-item">
                <Check size={16} className="pm-check-icon" />
                <span>Up to 3 squad members</span>
              </li>
              <li className="pm-feature-item">
                <Check size={16} className="pm-check-icon" />
                <span><strong>2 Agile Workflows</strong> (Ad-hoc, Kanban)</span>
              </li>
              <li className="pm-feature-item">
                <Check size={16} className="pm-check-icon" />
                <span>Google Calendar Sync &amp; Meeting Notes</span>
              </li>
              <li className="pm-feature-item">
                <Check size={16} className="pm-check-icon" />
                <span>Personal focus dashboard &amp; Sprint tracking</span>
              </li>
              <li className="pm-feature-item">
                <Check size={16} className="pm-check-icon" />
                <span>Community developer support</span>
              </li>
            </ul>
          </div>

          {/* Team Tier */}
          <div className="pm-card recommended">
            <div className="pm-card-header">
              <div className="pm-tier-title">Team</div>
              <p className="pm-tier-desc">For growing product squads that need clear ownership, risk radar, and sync.</p>
            </div>

            <div className="pm-price-box">
              <div className="pm-strikethrough">
                <span className="struck">{isAnnual ? '₹160' : '₹200'}</span>
                <span>{isAnnual ? '/ month billed annually' : '/ month after launch'}</span>
              </div>
              <div className="pm-price-main">
                <span className="pm-price-currency">₹</span>
                <span className="pm-price-amount">0</span>
                <span className="pm-price-period">during launch</span>
              </div>
            </div>
            
            {(() => {
              const btn = getButtonProps('team')
              return (
                <button 
                  className={btn.className}
                  onClick={() => handleSelect('team')}
                  disabled={btn.disabled || loadingPlan === 'team'}
                >
                  {loadingPlan === 'team' ? 'Updating...' : btn.label}
                </button>
              )
            })()}

            <ul className="pm-features">
              <li className="pm-feature-item pm-feature-lead">
                <Check size={16} className="pm-check-icon" />
                <span>Everything in Starter, plus:</span>
              </li>
              <li className="pm-feature-item">
                <Check size={16} className="pm-check-icon" />
                <span>Up to 5 workspaces and 7 squad members</span>
              </li>
              <li className="pm-feature-item">
                <Check size={16} className="pm-check-icon" />
                <span><strong>6 Agile Workflows</strong> (Kanban, Scrum, XP, Lean, Scrumban)</span>
              </li>
              <li className="pm-feature-item">
                <Check size={16} className="pm-check-icon" />
                <span>Google Calendar &amp; GitHub PR Sync</span>
              </li>
              <li className="pm-feature-item">
                <Check size={16} className="pm-check-icon" />
                <span>Locked sprint boundary control &amp; peer verification</span>
              </li>
              <li className="pm-feature-item">
                <Check size={16} className="pm-check-icon" />
                <span>Connected meeting decisions &amp; sync digests</span>
              </li>
            </ul>
          </div>

          {/* Pro Tier */}
          <div className="pm-card">
            <div className="pm-card-header">
              <div className="pm-tier-title">Pro</div>
              <p className="pm-tier-desc">For multi-squad teams requiring custom methodologies, audit reporting, and API access.</p>
            </div>

            <div className="pm-price-box">
              <div className="pm-strikethrough">
                <span className="struck">{isAnnual ? '₹400' : '₹500'}</span>
                <span>{isAnnual ? '/ month billed annually' : '/ month after launch'}</span>
              </div>
              <div className="pm-price-main">
                <span className="pm-price-currency">₹</span>
                <span className="pm-price-amount">0</span>
                <span className="pm-price-period">during launch</span>
              </div>
            </div>
            
            {(() => {
              const btn = getButtonProps('pro')
              return (
                <button 
                  className={btn.className}
                  onClick={() => handleSelect('pro')}
                  disabled={btn.disabled || loadingPlan === 'pro'}
                >
                  {loadingPlan === 'pro' ? 'Updating...' : btn.label}
                </button>
              )
            })()}

            <ul className="pm-features">
              <li className="pm-feature-item pm-feature-lead">
                <Check size={16} className="pm-check-icon" />
                <span>Everything in Team, plus:</span>
              </li>
              <li className="pm-feature-item">
                <Check size={16} className="pm-check-icon" />
                <span>Up to 10 workspaces &amp; unlimited squad members</span>
              </li>
              <li className="pm-feature-item">
                <Check size={16} className="pm-check-icon" />
                <span><strong>All 8 Agile Workflows</strong> (Spotify Squads, SAFe Enterprise)</span>
              </li>
              <li className="pm-feature-item">
                <Check size={16} className="pm-check-icon" />
                <span>All Integrations (Google Calendar, GitHub, Slack, Discord, Vercel)</span>
              </li>
              <li className="pm-feature-item">
                <Check size={16} className="pm-check-icon" />
                <span>1-Click API Webhooks &amp; REST Sync Studio</span>
              </li>
              <li className="pm-feature-item">
                <Check size={16} className="pm-check-icon" />
                <span>Compliance audit logs &amp; CSV export</span>
              </li>
              <li className="pm-feature-item">
                <Check size={16} className="pm-check-icon" />
                <span>Priority developer support</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
