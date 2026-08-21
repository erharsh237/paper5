import React from 'react'

export default function CapacityBanner({ planName, type = 'members', count, limit, onUpgrade }) {
  if (count <= limit) return null

  const excess = count - limit

  return (
    <div style={{
      background: 'rgba(239, 68, 68, 0.08)',
      border: '1.5px solid rgba(239, 68, 68, 0.35)',
      borderRadius: '10px',
      padding: '18px 20px',
      marginBottom: '24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      flexWrap: 'wrap',
      boxShadow: '0 4px 14px rgba(239, 68, 68, 0.06)'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: '1 1 300px' }}>
        <span style={{ fontSize: '24px', lineHeight: 1 }}>🚨</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: '15px', color: '#DC2626', marginBottom: '4px', letterSpacing: '-0.01em' }}>
            WORKSPACE ACCESS FROZEN — Capacity Exceeded ({count} / {limit} {type})
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary, #4B5563)', lineHeight: 1.5 }}>
            Your workspace has <strong>{excess} excess {type}</strong> over the <strong>{planName} Plan</strong> capacity ({limit} max). 
            <br />
            To unfreeze workspace operations, the Workspace Admin must <strong>delete/remove {excess} member(s)</strong> below or upgrade to a higher plan.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        {onUpgrade && (
          <button
            onClick={onUpgrade}
            className="btn-primary btn-sm"
            style={{ whiteSpace: 'nowrap', padding: '8px 16px', fontSize: '13px', fontWeight: 700, background: '#DC2626', borderColor: '#DC2626' }}
          >
            ⚡ Upgrade Plan to Unfreeze
          </button>
        )}
      </div>
    </div>
  )
}
