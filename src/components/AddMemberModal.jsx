import { useState } from 'react'
import { addMember } from '../lib/deadlines'
import { useWorkspace } from '../lib/WorkspaceContext'

export default function AddMemberModal({ teamId, currentUser, onClose }) {
  const { workspaceId } = useWorkspace();
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return setError('Name and email are both required.')
    setSubmitting(true)
    try {
      await addMember(workspaceId, teamId, { name: name.trim(), email: email.trim(), addedBy: currentUser?.email })
      onClose()
    } catch (err) {
      console.error(err)
      setError('Could not add member. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label="Add team member" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2>Add team member</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="mname">Name</label>
            <input id="mname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus />
          </div>
          <div className="field">
            <label htmlFor="memail">Email</label>
            <input id="memail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
