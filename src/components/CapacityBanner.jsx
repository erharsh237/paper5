import React from 'react'

export default function CapacityBanner({ planName, type = 'members', count, limit, onUpgrade }) {
  if (count <= limit) return null

  const excess = count - limit

  return (
    <div style={{
      background: 'rgba(234, 179, 8, 0.1)',
      border: '1px solid rgba(234, 179, 8, 0.3)',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '20px' }}>⚠️</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary, #fff)', marginBottom: '2px' }}>
            Plan Quota Warning: Over {type} capacity ({count} / {limit} {type})
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary, #aaa)' }}>
            Your workspace has {excess} {type} over the <strong>{planName}</strong> plan limit. All existing data is safe, but new {type === 'members' ? 'invites' : 'workspaces'} are paused.
          </div>
        </div>
      </div>

      {onUpgrade && (
        <button
          onClick={onUpgrade}
          className="btn-primary btn-sm"
          style={{ whiteSpace: 'nowrap', padding: '8px 14px', fontSize: '13px' }}
        >
          Change / Upgrade Plan
        </button>
      )}
    </div>
  )
}
