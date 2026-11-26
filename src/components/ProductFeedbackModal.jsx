import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../lib/AuthContext'
import { useWorkspace } from '../lib/WorkspaceContext'

const CATEGORY_OPTIONS = [
  'Bug or glitch',
  'Feature request',
  'UI or usability',
  'Performance issue',
  'Other'
]

const SEVERITY_OPTIONS = [
  { value: 'Low', label: 'Low — minor issue' },
  { value: 'Medium', label: 'Medium — affects workflow' },
  { value: 'High', label: 'High — blocking work' }
]

/**
 * Strict file validation (magic byte check + bitmap decode)
 */
async function validateAndReadImage(file) {
  const MAX_SIZE = 5 * 1024 * 1024 // 5MB
  if (file.size > MAX_SIZE) {
    throw new Error('Image exceeds the 5MB file size limit.')
  }

  const allowedExts = ['png', 'jpg', 'jpeg', 'webp']
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '')
  const ext = cleanName.split('.').pop()?.toLowerCase() || ''
  if (!allowedExts.includes(ext)) {
    throw new Error('Invalid file type. Only PNG, JPG, and WebP images are supported.')
  }

  const allowedMimes = ['image/png', 'image/jpeg', 'image/webp', 'image/jpg']
  if (!allowedMimes.includes(file.type)) {
    throw new Error('Invalid file type. Only PNG, JPG, and WebP images are supported.')
  }

  const headerSlice = await file.slice(0, 16).arrayBuffer()
  const bytes = new Uint8Array(headerSlice)

  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
                bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A
  const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF
  const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
  const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50

  if (!isPng && !isJpeg && !(isRiff && isWebp)) {
    throw new Error('Invalid file format. The file contents do not match genuine image headers.')
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        const reader = new FileReader()
        reader.onload = () => {
          resolve({
            name: cleanName,
            type: file.type,
            size: file.size,
            base64: reader.result
          })
        }
        reader.onerror = () => reject(new Error('Failed to read file data.'))
        reader.readAsDataURL(file)
      } else {
        reject(new Error('Corrupted image file.'))
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Unable to read image file.'))
    }
    img.src = objectUrl
  })
}

function detectEnvironment() {
  if (typeof window === 'undefined') return { browser: 'Unknown', os: 'Unknown', screen: 'Unknown' }
  const ua = navigator.userAgent || ''
  let browser = 'Unknown'
  if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Edg/')) browser = 'Edge'
  else if (ua.includes('Chrome')) browser = 'Chrome'
  else if (ua.includes('Safari')) browser = 'Safari'

  let os = 'Unknown'
  if (ua.includes('Win')) os = 'Windows'
  else if (ua.includes('Mac')) os = 'macOS'
  else if (ua.includes('Linux')) os = 'Linux'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'

  return {
    browser,
    os,
    screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`
  }
}

export default function ProductFeedbackModal({ isOpen, onClose }) {
  const { user } = useAuth()
  let workspaceInfo = null
  try {
    const ws = useWorkspace()
    if (ws) workspaceInfo = ws
  } catch (_) {}

  const [category, setCategory] = useState('Bug or glitch')
  const [severity, setSeverity] = useState('Medium')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const isBugOrPerf = category === 'Bug or glitch' || category === 'Performance issue'

  useEffect(() => {
    if (!isOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleClose = () => {
    setError(null)
    setSubmitted(false)
    setTitle('')
    setMessage('')
    setAttachment(null)
    onClose()
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    try {
      const validated = await validateAndReadImage(file)
      setAttachment(validated)
    } catch (err) {
      setError(err?.message || 'Invalid image file.')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeAttachment = () => {
    setAttachment(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    if (!message.trim()) {
      setError('Please provide a description.')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const resolvedEmail = (user?.email || '').trim()
      const resolvedWorkspaceId = workspaceInfo?.workspaceId || workspaceInfo?.workspace?.id || 'N/A'
      const payload = {
        category,
        severity: isBugOrPerf ? severity : 'N/A',
        title: title.trim() || `${category} report`,
        message: message.trim(),
        website,
        userId: user?.id || null,
        userName: (user?.displayName || user?.full_name || user?.user_metadata?.full_name || 'Logged-in User').trim(),
        userEmail: resolvedEmail,
        workspaceId: resolvedWorkspaceId,
        workspaceName: workspaceInfo?.workspace?.name || 'N/A',
        currentUrl: typeof window !== 'undefined' ? window.location.pathname : '',
        environment: detectEnvironment(),
        imageAttachment: attachment ? {
          fileName: attachment.name,
          mimeType: attachment.type,
          base64Data: attachment.base64
        } : null
      }

      const res = await fetch('/api/product-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit feedback.')
      }

      setSubmitted(true)
    } catch (err) {
      console.error('[ProductFeedbackModal] Submit error:', err)
      setError(err?.message || 'Unable to submit feedback right now.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={handleClose}
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '20px',
        boxSizing: 'border-box',
        overflowY: 'auto'
      }}
    >
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Feedback"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '460px',
          maxHeight: '90vh',
          overflowY: 'auto',
          margin: 'auto'
        }}
      >
        <div className="modal-header">
          <h2>Feedback</h2>
          <button
            type="button"
            className="modal-close"
            onClick={handleClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {submitted ? (
          <div style={{ padding: '24px 22px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 600, color: 'var(--text, #0F172A)' }}>
              Feedback sent
            </p>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--muted, #64748B)', lineHeight: 1.5 }}>
              Thank you for helping us improve Paper5. Your submission has been sent to our team.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={handleClose}
              style={{ minWidth: '100px' }}
            >
              Done
            </button>
          </div>
        ) : (
          <form className="modal-form" onSubmit={handleSubmit}>
            {/* Honeypot field */}
            <div style={{ display: 'none' }} aria-hidden="true">
              <input
                type="text"
                name="website"
                tabIndex="-1"
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="field">
                <label htmlFor="feedback-user-email">Email</label>
                <input
                  id="feedback-user-email"
                  type="text"
                  value={user?.email || 'Not signed in'}
                  readOnly
                  style={{ background: 'var(--surface-2, #F8FAFC)', color: 'var(--muted, #475569)', fontSize: '12px' }}
                />
              </div>
              <div className="field">
                <label htmlFor="feedback-workspace-id">Workspace ID</label>
                <input
                  id="feedback-workspace-id"
                  type="text"
                  value={workspaceInfo?.workspaceId || workspaceInfo?.workspace?.id || 'N/A'}
                  readOnly
                  style={{ background: 'var(--surface-2, #F8FAFC)', color: 'var(--muted, #475569)', fontSize: '12px', fontFamily: 'monospace' }}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="feedback-category">Category</label>
              <select
                id="feedback-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {isBugOrPerf && (
              <div className="field">
                <label htmlFor="feedback-severity">Severity</label>
                <select
                  id="feedback-severity"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                >
                  {SEVERITY_OPTIONS.map((sev) => (
                    <option key={sev.value} value={sev.value}>
                      {sev.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="field">
              <label htmlFor="feedback-title">Title</label>
              <input
                id="feedback-title"
                type="text"
                placeholder="Short summary"
                value={title}
                maxLength={150}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="feedback-message">Description</label>
              <textarea
                id="feedback-message"
                rows={4}
                placeholder="Describe what happened or what you would like to see..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="feedback-screenshot">Screenshot</label>
              {attachment ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-soft, #E2E8F0)',
                    background: 'var(--surface-2, #F8FAFC)',
                    fontSize: '12.5px'
                  }}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '300px',
                      color: 'var(--text, #0F172A)'
                    }}
                  >
                    {attachment.name}
                  </span>
                  <button
                    type="button"
                    onClick={removeAttachment}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500,
                      padding: '2px 6px'
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <input
                    ref={fileInputRef}
                    id="feedback-screenshot"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileChange}
                    style={{
                      fontSize: '12.5px',
                      padding: '7px 8px'
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--muted, #64748B)' }}>
                    PNG, JPG, or WebP up to 5MB
                  </span>
                </>
              )}
            </div>

            {error && <div className="form-error">{error}</div>}

            <div className="modal-actions" style={{ marginTop: '8px' }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={handleClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={submitting || !message.trim()}
              >
                {submitting ? 'Sending…' : 'Submit feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  )
}
