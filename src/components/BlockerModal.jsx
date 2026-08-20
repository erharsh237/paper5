import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { setBlocked } from '../lib/deadlines'
import { createNotification, NOTIFICATION_TYPES } from '../lib/notifications'
import { sendBlockerEmail } from '../lib/email'
import { subscribeMembers } from '../lib/workspaces'
import { BLOCKER_CATEGORIES } from '../lib/utils'
import { useWorkspace } from '../lib/WorkspaceContext'

export default function BlockerModal({ deadline, currentUser, onClose }) {
  const { workspaceId, workspace } = useWorkspace();
  const [category, setCategory] = useState(BLOCKER_CATEGORIES[0].key)
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [members, setMembers] = useState([])
  const [selectedHelperEmails, setSelectedHelperEmails] = useState([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const dropdownRef = useRef(null)

  const myEmail = (currentUser?.email || '').trim().toLowerCase()
  const myUid = currentUser?.uid || currentUser?.id

  const availableMembers = useMemo(() => {
    return (members || []).filter(m => {
      const email = (m.email || '').trim().toLowerCase()
      const id = m.id || m.userId
      if (email && myEmail && email === myEmail) return false
      if (id && myUid && id === myUid) return false
      return true
    })
  }, [members, myEmail, myUid])

  useEffect(() => {
    if (!workspaceId) return
    return subscribeMembers(workspaceId, (list) => {
      setMembers(list || [])
    })
  }, [workspaceId])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleHelper = (email) => {
    const clean = (email || '').trim().toLowerCase()
    if (!clean) return
    setSelectedHelperEmails(prev => 
      prev.includes(clean) ? prev.filter(e => e !== clean) : [...prev, clean]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!reason.trim()) return setError('Reason is required.')
    setError('')
    setSubmitting(true)

    const helperSummary = selectedHelperEmails.join(', ')

    try {
      // 1. Mark task as blocked in DB
      await setBlocked(workspaceId, deadline.id, {
        category,
        reason: reason.trim(),
        needHelpFrom: helperSummary,
        needHelpFromEmails: selectedHelperEmails,
        description: description.trim(),
      })

      // 2. In-App Direct Notification to EACH selected helper
      for (const helperEmail of selectedHelperEmails) {
        await createNotification(workspaceId, undefined, {
          type: NOTIFICATION_TYPES.BLOCKER || 'blocker',
          message: `🚨 ${currentUser?.displayName || currentUser?.email} requested your help on blocked task: "${deadline.title}" — ${reason.trim()}`,
          deadlineId: deadline.id,
          forEmail: helperEmail,
          createdBy: currentUser?.email,
        }).catch(err => console.warn('Helper notification error:', err))
      }

      // 3. Broadcast notification to workspace feed
      await createNotification(workspaceId, undefined, {
        type: NOTIFICATION_TYPES.BLOCKER || 'blocker',
        message: `🚨 ${currentUser?.displayName || currentUser?.email} reported a blocker on "${deadline.title}" — ${reason.trim()}`,
        deadlineId: deadline.id,
        forEmail: null,
        createdBy: currentUser?.email,
      }).catch(err => console.warn('Broadcast notification error:', err))

      // 4. Dispatch Email notifications to selected helpers via Resend API
      if (selectedHelperEmails.length > 0) {
        sendBlockerEmail({
          workspaceId,
          workspaceName: workspace?.name,
          deadlineTitle: deadline.title,
          deadlineId: deadline.id,
          blockedBy: currentUser?.email,
          blockedByName: currentUser?.displayName || currentUser?.email,
          reason: reason.trim(),
          category,
          description: description.trim(),
          helperEmails: selectedHelperEmails,
        }).catch(err => console.warn('Blocker email error:', err))
      }

      onClose()
    } catch (err) {
      console.error(err)
      setError('Could not save the blocker. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label="Report blocker" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h2>Report blocker</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="blocker-category">Category</label>
            <select id="blocker-category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {BLOCKER_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>

          <div className="field">
            <label htmlFor="blocker-reason">Reason</label>
            <input
              id="blocker-reason" type="text" value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Waiting on API credentials / Review"
              autoFocus
            />
          </div>

          {/* Multi-Select "Need Help From" Dropdown */}
          <div className="field" ref={dropdownRef} style={{ position: 'relative' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Need help from (Select team members)</span>
              {selectedHelperEmails.length > 0 && (
                <span style={{ fontSize: '11px', color: '#4F46E5', fontWeight: 600 }}>
                  {selectedHelperEmails.length} selected
                </span>
              )}
            </label>

            {/* Selected Chips */}
            {selectedHelperEmails.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {selectedHelperEmails.map(email => {
                  const m = members.find(mem => (mem.email || '').toLowerCase() === email)
                  const label = m?.name && m?.email && m.name !== m.email ? `${m.name} (${email})` : email
                  return (
                    <span
                      key={email}
                      style={{
                        background: 'rgba(79, 70, 229, 0.1)',
                        color: '#4F46E5',
                        border: '1px solid rgba(79, 70, 229, 0.25)',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {label}
                      <button
                        type="button"
                        onClick={() => toggleHelper(email)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#4F46E5',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: '12px',
                          fontWeight: 800,
                          lineHeight: 1
                        }}
                      >
                        ✕
                      </button>
                    </span>
                  )
                })}
              </div>
            )}

            {/* Dropdown Toggle Button */}
            <div
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--bg-layer-2, #F8FAFC)',
                border: '1px solid var(--border-soft, #E2E8F0)',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '13px',
                color: selectedHelperEmails.length === 0 ? 'var(--text-tertiary, #94A3B8)' : 'var(--text-primary, #0F172A)'
              }}
            >
              <span>
                {selectedHelperEmails.length === 0 
                  ? 'Select team members who should receive blocker alerts…' 
                  : `${selectedHelperEmails.length} member(s) will receive in-app & email alerts`}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary, #64748B)' }}>
                {dropdownOpen ? '▲' : '▼'}
              </span>
            </div>

            {/* Dropdown Menu List */}
            {dropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  background: '#FFFFFF',
                  border: '1px solid var(--border-soft, #E2E8F0)',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  zIndex: 50,
                  maxHeight: '200px',
                  overflowY: 'auto',
                  padding: '6px'
                }}
              >
                {availableMembers.length === 0 ? (
                  <div style={{ padding: '10px', fontSize: '12px', color: 'var(--text-tertiary, #64748B)', textAlign: 'center' }}>
                    No other team members found in workspace
                  </div>
                ) : (
                  availableMembers.map(m => {
                    const email = (m.email || '').trim().toLowerCase()
                    if (!email) return null
                    const isSelected = selectedHelperEmails.includes(email)
                    const name = m.name || m.fullName || m.displayLabel || email.split('@')[0]
                    return (
                      <div
                        key={m.id || email}
                        onClick={() => toggleHelper(email)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // Handled by container onClick
                          style={{ cursor: 'pointer', accentColor: '#4F46E5' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontSize: '13px', fontWeight: isSelected ? 700 : 500, color: 'var(--text-primary, #0F172A)' }}>
                            {name}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-tertiary, #64748B)' }}>
                            {email}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="blocker-desc">Description</label>
            <textarea
              id="blocker-desc" rows={3} value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's blocking this and what's been tried…"
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Sending alerts…' : 'Mark blocked & notify team'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
