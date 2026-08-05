import { useState } from 'react'
import { useWorkspace } from '../lib/WorkspaceContext'
import { useAuth } from '../lib/AuthContext'

export default function LockedOverlay() {
  const { workspace } = useWorkspace()
  const { user } = useAuth()
  
  const isCreator = user?.uid === workspace?.createdBy

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--bg-layer)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, flexDirection: 'column', gap: '24px', padding: '24px', textAlign: 'center'
    }}>
      <div style={{ maxWidth: '400px', background: 'var(--bg-layer-2)', padding: '32px', borderRadius: '12px', border: '1px solid var(--border-subtle)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
        <div style={{ width: '48px', height: '48px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-critical)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
        </div>
        <h2 style={{ margin: '0 0 12px 0', fontSize: '20px' }}>Free Trial Expired</h2>
        <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
          The 7-day free trial for the creator of <strong>{workspace?.name}</strong> has ended. 
          To continue using Paper5 and unlock access, the account must be upgraded.
        </p>
        
        {isCreator ? (
          <button className="btn-primary" onClick={() => window.open('/#pricing', '_blank')} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
            View Pricing Plans
          </button>
        ) : (
          <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Only the user who created this workspace can upgrade the billing plan. Please ask them to upgrade.
          </div>
        )}
      </div>
    </div>
  )
}
