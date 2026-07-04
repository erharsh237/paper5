import { removeMember } from '../lib/deadlines'
import './MembersPanel.css'

export default function MembersPanel({ members }) {
  function handleRemove(id, name) {
    if (confirm(`Remove ${name} from the team? Existing deadlines assigned to them stay untouched.`)) {
      removeMember(id)
    }
  }

  return (
    <section className="members-panel">
      <div className="members-panel-header">
        <h2>Team members</h2>
        <span className="members-count mono">{members.length}</span>
      </div>

      {members.length === 0 ? (
        <div className="members-empty">No members added yet.</div>
      ) : (
        <div className="members-list">
          {members.map(m => (
            <div className="member-chip" key={m.id}>
              <span className="member-avatar mono">{m.name?.[0]?.toUpperCase() || '?'}</span>
              <div className="member-info">
                <div className="member-name">{m.name}</div>
                <div className="member-email mono">{m.email}</div>
              </div>
              <button
                className="member-remove"
                onClick={() => handleRemove(m.id, m.name)}
                aria-label={`Remove ${m.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
