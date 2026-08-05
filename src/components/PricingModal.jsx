import { useState } from 'react'
import './PricingModal.css'

const PLAN_LEVELS = {
  free: 1,
  starter: 1,
  team: 2,
  scale: 3
}

export default function PricingModal({ isOpen, onClose, currentPlan, onSelectPlan }) {
  const [isAnnual, setIsAnnual] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState(null)

  if (!isOpen) return null

  const handleSelect = async (planId) => {
    setLoadingPlan(planId)
    await onSelectPlan(planId)
    setLoadingPlan(null)
  }

  const currentLevel = PLAN_LEVELS[currentPlan || 'free'] || 0

  const getButtonProps = (targetPlanId) => {
    const targetLevel = PLAN_LEVELS[targetPlanId]
    const planName = targetPlanId.charAt(0).toUpperCase() + targetPlanId.slice(1)
    
    if (targetLevel === currentLevel) {
      return { label: 'Active Plan', disabled: true, className: 'btn-ghost' }
    }
    if (targetLevel < currentLevel) {
      return { label: `Downgrade to ${planName}`, disabled: false, className: 'btn-ghost' }
    }
    return { label: `Select ${planName}`, disabled: false, className: 'btn-primary' }
  }

  return (
    <div className="pricing-modal-overlay" onClick={onClose}>
      <div className="pricing-modal-content" onClick={e => e.stopPropagation()}>
        <button className="pricing-modal-close" onClick={onClose}>&times;</button>
        
        <div className="pricing-modal-header">
          <h2>Launch Special: 100% Free Access</h2>
          <p>All features, integrations, and workspaces are completely unlocked during our early access period.</p>
        </div>

        <div className="pricing-modal-grid">
          {/* Starter Tier */}
          <div className="pricing-card">
            <div className="tier-name">Starter</div>
            <div className="tier-price">
              <span className="amount">Free</span>
            </div>
            <p className="tier-desc">Perfect for solo founders and tiny indie teams testing the waters.</p>
            
            {(() => {
              const btn = getButtonProps('starter')
              return (
                <button 
                  className={`${btn.className} w-full`}
                  onClick={() => handleSelect('starter')}
                  disabled={btn.disabled || loadingPlan === 'starter'}
                  style={{ width: '100%' }}
                >
                  {loadingPlan === 'starter' ? 'Updating...' : btn.label}
                </button>
              )
            })()}

            <ul className="tier-features">
              <li>1 Workspace</li>
              <li>Up to 3 Members</li>
              <li>GitHub Repository Sync</li>
              <li>Personal Focus Dashboard</li>
              <li>Basic Sprint Tracking</li>
            </ul>
          </div>

          {/* Team Tier */}
          <div className="pricing-card recommended">
            <div className="recommended-badge">Most Popular</div>
            <div className="tier-name">Team</div>
            <div className="tier-price">
              <span className="currency">₹</span>
              <span className="amount">0</span>
              <span className="period">/mo</span>
            </div>
            <p className="tier-desc">For growing startups that need to collaborate and integrate their stack.</p>
            
            {(() => {
              const btn = getButtonProps('team')
              return (
                <button 
                  className={`${btn.className} w-full`}
                  onClick={() => handleSelect('team')}
                  disabled={btn.disabled || loadingPlan === 'team'}
                  style={{ width: '100%' }}
                >
                  {loadingPlan === 'team' ? 'Updating...' : btn.label}
                </button>
              )
            })()}

            <ul className="tier-features">
              <li>Up to 5 Workspaces</li>
              <li>Unlimited Team Members</li>
              <li>GitHub & Discord Integration</li>
              <li>Locked Sprint Scope Control</li>
              <li>Proof of Work Peer Verification</li>
              <li>Sunday Sync Meeting Broadcasts</li>
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
            
            {(() => {
              const btn = getButtonProps('scale')
              return (
                <button 
                  className={`${btn.className} w-full`}
                  onClick={() => handleSelect('scale')}
                  disabled={btn.disabled || loadingPlan === 'scale'}
                  style={{ width: '100%' }}
                >
                  {loadingPlan === 'scale' ? 'Updating...' : btn.label}
                </button>
              )
            })()}

            <ul className="tier-features">
              <li>Up to 10 Workspaces</li>
              <li>Unlimited Team Members</li>
              <li>GitHub, Discord, Google Calendar & Webhooks</li>
              <li>Advanced Velocity & Risk Analytics</li>
              <li>Strict Auditing Mode & CSV Export</li>
              <li>Developer API Key Access</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
