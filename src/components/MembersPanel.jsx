import { removeMember } from '../lib/deadlines'
import './MembersPanel.css'

export default function MembersPanel({ members }) {
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
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
