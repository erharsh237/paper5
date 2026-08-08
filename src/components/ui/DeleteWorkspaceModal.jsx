import { useState, useRef, useEffect } from 'react'
import { Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react'

export default function DeleteWorkspaceModal({
  isOpen,
  onClose,
  workspaceName = 'workspace',
  memberCount = 1,
  onConfirm
}) {
  const [holding, setHolding] = useState(false)
  const [progress, setProgress] = useState(0)
  const [completed, setCompleted] = useState(false)
  const animRef = useRef(null)
  const startTimeRef = useRef(null)

  const HOLD_DURATION = 2200 // 2.2 seconds hold requirement

  useEffect(() => {
    if (!isOpen) {
      setHolding(false)
      setProgress(0)
      setCompleted(false)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [isOpen])

  if (!isOpen) return null

  const getInitials = (name) => {
    if (!name) return 'WS'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const startHolding = () => {
    if (completed) return
    setHolding(true)
    startTimeRef.current = performance.now()

    const step = (now) => {
      const elapsed = now - startTimeRef.current
      const pct = Math.min(100, (elapsed / HOLD_DURATION) * 100)
      setProgress(pct)

      if (pct < 100) {
        animRef.current = requestAnimationFrame(step)
      } else {
        setCompleted(true)
        setHolding(false)
        if (navigator.vibrate) navigator.vibrate([40, 30, 80])
        setTimeout(() => {
          onConfirm()
        }, 400)
      }
    }

    animRef.current = requestAnimationFrame(step)
  }

  const stopHolding = () => {
    if (completed) return
    setHolding(false)
    if (animRef.current) cancelAnimationFrame(animRef.current)

    // Smooth release back to 0
    let currentPct = progress
    const drain = () => {
      currentPct = Math.max(0, currentPct - 6)
      setProgress(currentPct)
      if (currentPct > 0) {
        requestAnimationFrame(drain)
      }
    }
    requestAnimationFrame(drain)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !holding && !completed) {
          onClose()
        }
      }}
    >
      <div
        style={{
          background: '#111113',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '460px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          color: '#ffffff',
          fontFamily: 'var(--sans, system-ui, -apple-system, sans-serif)',
          animation: 'modalFadeUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          position: 'relative',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={holding || completed}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'transparent',
            border: 'none',
            color: '#6b7280',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '6px',
            lineHeight: 1,
            transition: 'color 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = '#ffffff')}
          onMouseOut={(e) => (e.currentTarget.style.color = '#6b7280')}
        >
          &times;
        </button>

        {/* Title */}
        <h2
          style={{
            margin: '0 0 12px 0',
            fontSize: '24px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#ffffff',
          }}
        >
          Delete this project
        </h2>

        {/* Description */}
        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '14px',
            color: '#9ca3af',
            lineHeight: 1.5,
          }}
        >
          Deleting <span style={{ color: '#ffffff', fontWeight: 600 }}>{workspaceName}</span> permanently removes its sprints, deadlines, proof of work logs, and API keys for everyone on the team. This cannot be undone.
        </p>

        {/* Workspace Badge Inset Box */}
        <div
          style={{
            background: '#18181b',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '28px',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '8px',
              background: '#09090b',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--mono, monospace)',
              fontWeight: 700,
              fontSize: '14px',
              color: '#ffffff',
              letterSpacing: '-0.05em',
              flexShrink: 0,
            }}
          >
            {getInitials(workspaceName)}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: '#ffffff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {workspaceName}
            </div>
            <div
              style={{
                fontSize: '13px',
                color: '#9ca3af',
                fontFamily: 'var(--mono, monospace)',
                marginTop: '2px',
              }}
            >
              Production &middot; {memberCount} collaborator{memberCount !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Hold To Delete Button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onMouseDown={startHolding}
            onMouseUp={stopHolding}
            onMouseLeave={stopHolding}
            onTouchStart={startHolding}
            onTouchEnd={stopHolding}
            style={{
              width: '100%',
              height: '52px',
              background: '#18181b',
              border: completed
                ? '1px solid #10b981'
                : holding
                ? '1px solid #ef4444'
                : '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '8px',
              position: 'relative',
              overflow: 'hidden',
              cursor: completed ? 'wait' : 'pointer',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              outline: 'none',
              boxShadow: holding ? '0 0 20px rgba(239, 68, 68, 0.35)' : 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
          >
            {/* Red Filling Progress Bar */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: `${progress}%`,
                background: completed
                  ? 'linear-gradient(90deg, #059669 0%, #10b981 100%)'
                  : 'linear-gradient(90deg, #dc2626 0%, #ef4444 100%)',
                transition: holding ? 'none' : 'width 0.3s ease-out',
                zIndex: 1,
              }}
            />

            {/* Label Content Overlay */}
            <div
              style={{
                position: 'relative',
                zIndex: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                height: '100%',
                fontWeight: 600,
                fontSize: '15px',
                color: '#ffffff',
              }}
            >
              {completed ? (
                <>
                  <CheckCircle2 size={18} color="#ffffff" />
                  <span>Deleting Workspace...</span>
                </>
              ) : holding ? (
                <>
                  <Trash2 size={18} className="pulse-icon" />
                  <span>Hold to confirm ({Math.round(progress)}%)</span>
                </>
              ) : (
                <>
                  <Trash2 size={18} />
                  <span>Hold to delete</span>
                </>
              )}
            </div>
          </button>

          <span
            style={{
              fontSize: '12px',
              color: holding ? '#ef4444' : '#6b7280',
              transition: 'color 0.2s',
              fontWeight: 500,
            }}
          >
            {holding ? 'Keep holding to delete forever' : 'Press and hold to confirm.'}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes modalFadeUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pulseIcon {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        .pulse-icon {
          animation: pulseIcon 0.4s infinite ease-in-out;
        }
      `}</style>
    </div>
  )
}
