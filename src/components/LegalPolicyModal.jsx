import { useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { X, ShieldCheck, FileText } from 'lucide-react'
import termsMd from '../content/legal/terms.md?raw'
import privacyMd from '../content/legal/privacy.md?raw'
import dpaMd from '../content/legal/dpa.md?raw'
import subprocessorsMd from '../content/legal/subprocessors.md?raw'
import '../pages/Legal.css'

const DOCS = {
  'terms': { 
    title: 'Terms of Service', 
    badge: 'Legal Terms', 
    content: termsMd 
  },
  'privacy': { 
    title: 'Privacy Policy', 
    badge: 'Privacy & Security', 
    content: privacyMd 
  },
  'dpa': { 
    title: 'Data Processing Agreement (DPA)', 
    badge: 'Compliance & GDPR', 
    content: dpaMd 
  },
  'subprocessors': { 
    title: 'Authorized Subprocessors', 
    badge: 'Vendor Directory', 
    content: subprocessorsMd 
  },
}

export default function LegalPolicyModal({ isOpen, docId, onClose }) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const doc = DOCS[docId] || DOCS['terms']

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000000,
        background: 'rgba(9, 9, 11, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'var(--bg-layer, #ffffff)',
          color: 'var(--text-primary, #09090b)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '760px',
          maxHeight: '86vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          border: '1px solid var(--border, #e4e4e7)',
          overflow: 'hidden',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-subtle, #f0f0f2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-layer-2, #fafafa)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <ShieldCheck size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #09090b)' }}>
                  {doc.title}
                </h3>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.14)',
                  color: '#059669'
                }}>
                  {doc.badge}
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary, #71717a)' }}>
                Official Paper5 Policy & Compliance Document
              </p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: '8px',
              padding: '6px',
              cursor: 'pointer',
              color: 'var(--text-tertiary, #71717a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.06)'
              e.currentTarget.style.color = '#09090b'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-tertiary, #71717a)'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Markdown Content */}
        <div 
          style={{
            padding: '28px 32px',
            overflowY: 'auto',
            flex: 1,
            fontSize: '14.5px',
            lineHeight: 1.65,
            color: 'var(--text-secondary, #3f3f46)',
            textAlign: 'left'
          }}
        >
          <div className="legal-content">
            <ReactMarkdown>{doc.content}</ReactMarkdown>
          </div>
        </div>

        {/* Sticky Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border-subtle, #f0f0f2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-layer-2, #fafafa)',
          flexShrink: 0
        }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary, #71717a)' }}>
            Press <kbd style={{ padding: '2px 5px', background: '#e4e4e7', borderRadius: '4px', fontSize: '11px', color: '#09090b' }}>Esc</kbd> or click outside to dismiss
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 22px',
              borderRadius: '8px',
              background: '#09090b',
              color: '#ffffff',
              border: 'none',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            I Understand & Close
          </button>
        </div>
      </div>
    </div>
  )
}
