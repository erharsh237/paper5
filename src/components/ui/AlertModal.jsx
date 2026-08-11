import React, { useEffect, useState } from 'react'
import { Info, CheckCircle2, AlertCircle, Sparkles, X } from 'lucide-react'

export default function AlertModal({ message, onClose }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (message) {
      setVisible(true)
    } else {
      setVisible(false)
    }
  }, [message])

  if (!message || !visible) return null

  // Strip any accidental emojis from string so output is 100% emoji-free
  const cleanMessage = String(message)
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, '')
    .trim()

  const isSuccess = cleanMessage.toLowerCase().includes('success') || cleanMessage.toLowerCase().includes('updated') || cleanMessage.toLowerCase().includes('saved')

  const handleClose = () => {
    setVisible(false)
    if (onClose) onClose()
  }

  return (
    <div 
      className="alert-overlay"
      onClick={handleClose}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '20px',
        animation: 'alertFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}
    >
      <div 
        className="alert-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          border: isSuccess ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #e4e4e7',
          borderRadius: '16px',
          padding: '28px 24px 24px 24px',
          maxWidth: '420px',
          width: '100%',
          boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.18), 0 0 30px 0 rgba(16, 185, 129, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
          animation: 'alertPopIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          transformOrigin: 'center center'
        }}
      >
        {/* Top Close Button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: 'transparent',
            border: 'none',
            color: '#71717a',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s'
          }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Animated Glow Icon Ring */}
        <div 
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: isSuccess ? 'rgba(16, 185, 129, 0.12)' : 'rgba(99, 102, 241, 0.12)',
            border: isSuccess ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(99, 102, 241, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '18px',
            position: 'relative',
            animation: 'ringPulse 2s infinite ease-in-out'
          }}
        >
          {isSuccess ? (
            <CheckCircle2 size={32} color="#10b981" style={{ animation: 'iconBounce 0.5s ease-out' }} />
          ) : (
            <Info size={32} color="#6366f1" style={{ animation: 'iconBounce 0.5s ease-out' }} />
          )}
        </div>



        {/* Animated Message Text */}
        <p style={{
          color: '#52525b',
          margin: '0 0 24px 0',
          fontSize: '14px',
          lineHeight: '1.55',
          fontWeight: 500
        }}>
          {cleanMessage}
        </p>

        {/* Action Button */}
        <button
          className="btn-primary"
          onClick={handleClose}
          style={{
            width: '100%',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 700,
            borderRadius: '10px',
            background: isSuccess ? '#10b981' : '#09090b',
            color: '#ffffff',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
            transition: 'transform 0.15s ease, filter 0.2s'
          }}
        >
          Acknowledge
        </button>
      </div>

      <style>{`
        @keyframes alertFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes alertPopIn {
          0% { opacity: 0; transform: scale(0.85) translateY(15px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes ringPulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          70% { box-shadow: 0 0 0 12px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        @keyframes iconBounce {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
