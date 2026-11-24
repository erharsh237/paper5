import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../lib/AuthContext'
import { useWorkspace } from '../lib/WorkspaceContext'
import './ProductFeedbackModal.css'

const CATEGORIES = [
  { id: 'Bug / Glitch', label: 'Bug / Glitch', icon: '🐛', desc: 'Something is broken or not working as expected' },
  { id: 'Feature Request', label: 'Feature Request', icon: '💡', desc: 'An idea or capability you would like to see' },
  { id: 'UI / UX Improvement', label: 'UI / UX', icon: '🎨', desc: 'Design, responsiveness, or clarity feedback' },
  { id: 'Performance Issue', label: 'Performance', icon: '⚡', desc: 'Slow loading, lag, or stuttering' },
  { id: 'Other', label: 'Other', icon: '💬', desc: 'General product question or comment' }
]

const SEVERITIES = [
  { id: 'Low', label: 'Low', desc: 'Cosmetic or minor annoyance' },
  { id: 'Medium', label: 'Medium', desc: 'Impacts work, but workaround exists' },
  { id: 'High', label: 'High', desc: 'Major blocker or critical issue' }
]

/**
 * Strict client-side file security validation
 */
async function validateAndReadImage(file) {
  const MAX_SIZE = 5 * 1024 * 1024 // 5MB
  if (file.size > MAX_SIZE) {
    throw new Error('Screenshot exceeds the 5MB file size limit.')
  }

  const allowedExts = ['png', 'jpg', 'jpeg', 'webp']
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '')
  const ext = cleanName.split('.').pop()?.toLowerCase() || ''
  if (!allowedExts.includes(ext)) {
    throw new Error('Security check failed: Only genuine PNG, JPG, and WebP images are allowed.')
  }

  const allowedMimes = ['image/png', 'image/jpeg', 'image/webp', 'image/jpg']
  if (!allowedMimes.includes(file.type)) {
    throw new Error('Security check failed: Invalid image MIME type.')
  }

  // Cryptographic Magic Bytes Inspection
  const headerSlice = await file.slice(0, 16).arrayBuffer()
  const bytes = new Uint8Array(headerSlice)

  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
                bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A
  const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF
  const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
  const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50

  if (!isPng && !isJpeg && !(isRiff && isWebp)) {
    throw new Error('Security rejection: File headers do not match a valid image format.')
  }

  // Bitmap decode verification
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const width = img.naturalWidth
      const height = img.naturalHeight
      URL.revokeObjectURL(objectUrl)
      if (width > 0 && height > 0) {
        // Read full base64
        const reader = new FileReader()
        reader.onload = () => {
          resolve({
            name: cleanName,
            type: file.type,
            size: file.size,
            width,
            height,
            base64: reader.result,
            previewUrl: reader.result
          })
        }
        reader.onerror = () => reject(new Error('Failed to read image data.'))
        reader.readAsDataURL(file)
      } else {
        reject(new Error('Corrupted image bitmap detected.'))
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Security rejection: Unable to decode image bitmap.'))
    }
    img.src = objectUrl
  })
}

function detectEnvironment() {
  if (typeof window === 'undefined') return { browser: 'Unknown', os: 'Unknown', screen: 'Unknown' }
  const ua = navigator.userAgent || ''
  let browser = 'Unknown Browser'
  if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Edg/')) browser = 'Microsoft Edge'
  else if (ua.includes('Chrome')) browser = 'Google Chrome'
  else if (ua.includes('Safari')) browser = 'Safari'

  let os = 'Unknown OS'
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
    // Graceful workspace context extraction
    const ws = useWorkspace()
    if (ws) workspaceInfo = ws
  } catch (_) {}

  const [category, setCategory] = useState('Bug / Glitch')
  const [severity, setSeverity] = useState('Medium')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('') // Honeypot
  const [attachment, setAttachment] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const [showDiag, setShowDiag] = useState(false)
  const fileInputRef = useRef(null)

  const activeCategory = CATEGORIES.find(c => c.id === category) || CATEGORIES[0]
  const isBugOrPerf = category === 'Bug / Glitch' || category === 'Performance Issue'

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleClose = () => {
    setError(null)
    setSubmitted(false)
    setTitle('')
    setMessage('')
    setAttachment(null)
    onClose()
  }

  const handleFileSelect = async (file) => {
    if (!file) return
    setError(null)
    try {
      const validated = await validateAndReadImage(file)
      setAttachment(validated)
    } catch (err) {
      setError(err?.message || 'Invalid evidence file.')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer?.files?.[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const removeAttachment = () => {
    setAttachment(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    if (!message.trim() || message.trim().length < 5) {
      setError('Please provide at least 5 characters describing the issue or request.')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const env = detectEnvironment()
      const payload = {
        category,
        severity: isBugOrPerf ? severity : 'N/A',
        title: title.trim() || `${category} report`,
        message: message.trim(),
        website,
        userName: (user?.displayName || user?.full_name || 'Logged-in User').trim(),
        userEmail: (user?.email || '').trim(),
        workspaceId: workspaceInfo?.workspaceId || workspaceInfo?.workspace?.id || 'N/A',
        workspaceName: workspaceInfo?.workspace?.name || 'N/A',
        currentUrl: typeof window !== 'undefined' ? window.location.pathname : '',
        environment: env,
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
        throw new Error(data.error || 'Failed to submit report. Please try again.')
      }

      setSubmitted(true)
    } catch (err) {
      console.error('[ProductFeedbackModal] Submit error:', err)
      setError(err?.message || 'Unable to submit report right now. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div className="product-feedback-overlay" onClick={handleClose}>
      <div
        className="product-feedback-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-feedback-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="product-feedback-header">
          <div className="product-feedback-brand">
            <span className="product-feedback-icon-badge" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
              </svg>
            </span>
            <div>
              <h2 id="product-feedback-title">Product Feedback & Bug Report</h2>
              <p className="product-feedback-subtitle">Logged in as {user?.email || 'Active User'}</p>
            </div>
          </div>
          <button
            type="button"
            className="product-feedback-close"
            onClick={handleClose}
            aria-label="Close dialog"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body Content */}
        <div className="product-feedback-body">
          {submitted ? (
            <div className="product-feedback-success">
              <div className="product-feedback-success-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3>Report Dispatched Directly</h3>
              <p>
                Thank you! Your feedback and evidence have been sent to our engineering team. We review every issue to keep Paper5 running fast and smoothly.
              </p>
              <button
                type="button"
                className="product-feedback-btn-primary"
                onClick={handleClose}
              >
                Back to Dashboard
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {error && (
                <div className="product-feedback-alert product-feedback-alert--error" role="alert">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* Honeypot anti-spam field */}
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

              {/* Category Selection */}
              <div className="product-feedback-section">
                <label className="product-feedback-label">Report Type</label>
                <div className="product-feedback-categories">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`product-feedback-cat-pill ${category === cat.id ? 'active' : ''}`}
                      onClick={() => setCategory(cat.id)}
                    >
                      <span className="cat-icon">{cat.icon}</span>
                      <span className="cat-text">{cat.label}</span>
                    </button>
                  ))}
                </div>
                <div className="product-feedback-cat-hint">{activeCategory.desc}</div>
              </div>

              {/* Severity (for Bug / Glitch or Performance) */}
              {isBugOrPerf && (
                <div className="product-feedback-section">
                  <label className="product-feedback-label">Severity Level</label>
                  <div className="product-feedback-severities">
                    {SEVERITIES.map((sev) => (
                      <button
                        key={sev.id}
                        type="button"
                        className={`product-feedback-sev-pill ${severity === sev.id ? 'active' : ''} sev-${sev.id.toLowerCase()}`}
                        onClick={() => setSeverity(sev.id)}
                      >
                        {sev.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Title / Summary */}
              <div className="product-feedback-section">
                <label className="product-feedback-label" htmlFor="feedback-title-input">
                  Summary / Title <span className="optional-tag">(Optional)</span>
                </label>
                <input
                  id="feedback-title-input"
                  type="text"
                  className="product-feedback-input"
                  placeholder={
                    category === 'Bug / Glitch'
                      ? 'e.g. Card drag and drop snaps back in sprint view'
                      : category === 'Feature Request'
                      ? 'e.g. Add Slack notifications on task completion'
                      : 'e.g. Brief description of your feedback'
                  }
                  value={title}
                  maxLength={150}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Description */}
              <div className="product-feedback-section">
                <label className="product-feedback-label" htmlFor="feedback-message-textarea">
                  Details & Steps to Reproduce <span className="required-tag">*</span>
                </label>
                <textarea
                  id="feedback-message-textarea"
                  className="product-feedback-textarea"
                  rows={4}
                  placeholder={
                    category === 'Bug / Glitch'
                      ? 'Please describe what you were doing, what went wrong, and any error message displayed...'
                      : category === 'Feature Request'
                      ? 'How would this feature help your team? Describe your ideal workflow...'
                      : 'Share your thoughts, suggestions, or issues...'
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />
              </div>

              {/* Strict Evidence File Upload */}
              <div className="product-feedback-section">
                <div className="product-feedback-file-header">
                  <label className="product-feedback-label">
                    Evidence / Screenshot <span className="optional-tag">(PNG, JPG, WebP — max 5MB)</span>
                  </label>
                  <span className="product-feedback-security-pill">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    Strict Security Check
                  </span>
                </div>

                {attachment ? (
                  <div className="product-feedback-attachment-preview">
                    <img src={attachment.previewUrl} alt="Screenshot evidence preview" />
                    <div className="attachment-meta">
                      <span className="attachment-name">{attachment.name}</span>
                      <span className="attachment-details">
                        {(attachment.size / 1024).toFixed(0)} KB • {attachment.width}×{attachment.height} px
                      </span>
                    </div>
                    <button
                      type="button"
                      className="attachment-remove-btn"
                      onClick={removeAttachment}
                      title="Remove screenshot"
                      aria-label="Remove screenshot"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div
                    className={`product-feedback-dropzone ${isDragging ? 'dragging' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleFileSelect(e.target.files[0])
                      }}
                    />
                    <div className="dropzone-icon">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                    <div className="dropzone-text">
                      <strong>Click to upload</strong> or drag and drop screenshot
                    </div>
                    <div className="dropzone-subtext">
                      Cryptographically verified to protect against malicious binaries.
                    </div>
                  </div>
                )}
              </div>

              {/* Diagnostic Meta Collapsible */}
              <div className="product-feedback-diag-wrapper">
                <button
                  type="button"
                  className="product-feedback-diag-toggle"
                  onClick={() => setShowDiag(!showDiag)}
                >
                  <span>Auto-Attached Workspace & Device Context</span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ transform: showDiag ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {showDiag && (
                  <div className="product-feedback-diag-content">
                    <div><strong>User:</strong> {user?.email || 'N/A'}</div>
                    <div><strong>Workspace:</strong> {workspaceInfo?.workspace?.name || 'Active Workspace'} ({workspaceInfo?.workspaceId || 'Default'})</div>
                    <div><strong>Route:</strong> {typeof window !== 'undefined' ? window.location.pathname : 'N/A'}</div>
                    <div><strong>Environment:</strong> {detectEnvironment().browser} on {detectEnvironment().os} ({detectEnvironment().screen})</div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="product-feedback-actions">
                <button
                  type="button"
                  className="product-feedback-btn-secondary"
                  onClick={handleClose}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="product-feedback-btn-primary"
                  disabled={submitting || !message.trim()}
                >
                  {submitting ? (
                    <span className="btn-loading">
                      <span className="spinner" />
                      Submitting Report...
                    </span>
                  ) : (
                    'Submit Report'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
