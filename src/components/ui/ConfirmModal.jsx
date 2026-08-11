import React from 'react'

/**
 * ConfirmModal — replaces all window.confirm / window.prompt native dialogs
 * Props:
 *   isOpen      — boolean
 *   title       — string
 *   message     — string
 *   confirmText — string (default: 'Confirm')
 *   cancelText  — string (default: 'Cancel')
 *   variant     — 'danger' | 'warning' | 'default'
 *   onConfirm   — () => void
 *   onCancel    — () => void
 *   // For typed confirmation (like workspace delete)
 *   requiresTyping — string | null  (user must type this exact string)
 */
import { Trash2, AlertTriangle, Info } from 'lucide-react'

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
  requiresTyping = null,
}) {
  const [typedValue, setTypedValue] = React.useState('')

  React.useEffect(() => {
    if (!isOpen) setTypedValue('')
  }, [isOpen])

  if (!isOpen) return null

  const accentColor = variant === 'danger'
    ? 'var(--accent-critical, #ef4444)'
    : variant === 'warning'
    ? 'var(--accent-signal, #f59e0b)'
    : 'var(--accent-primary, #6366f1)'

  const IconComp = variant === 'danger' ? Trash2 : variant === 'warning' ? AlertTriangle : Info
  const canConfirm = !requiresTyping || typedValue === requiresTyping

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onCancel?.()
    if (e.key === 'Enter' && canConfirm) onConfirm?.()
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel?.() }}
      onKeyDown={handleKeyDown}
    >
      <div style={{
        background: 'var(--bg-layer-2)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '28px',
        maxWidth: '440px',
        width: '90%',
        boxShadow: 'var(--shadow-panel)',
        animation: 'modalSlideUp 0.25s ease-out forwards',
      }}>
        <h3 style={{
          margin: '0 0 12px 0',
          fontSize: '17px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--text-primary)',
        }}>
          <IconComp size={20} color={accentColor} /> {title}
        </h3>

        <p style={{
          color: 'var(--text-secondary)',
          margin: '0 0 20px 0',
          fontSize: '14px',
          lineHeight: '1.6',
        }}>
          {message}
        </p>

        {requiresTyping && (
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Type <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{requiresTyping}</strong> to confirm:
            </p>
            <input
              autoFocus
              type="text"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={requiresTyping}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                background: 'var(--bg-layer-1)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontFamily: 'monospace',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-ghost"
            onClick={onCancel}
            style={{ padding: '8px 20px' }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            style={{
              padding: '8px 20px',
              background: canConfirm ? accentColor : 'var(--bg-layer-3, #e5e7eb)',
              color: canConfirm ? '#fff' : 'var(--text-tertiary)',
              border: 'none',
              borderRadius: '6px',
              cursor: canConfirm ? 'pointer' : 'not-allowed',
              fontWeight: 600,
              fontSize: '14px',
              transition: 'opacity 0.15s',
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </div>
  )
}
