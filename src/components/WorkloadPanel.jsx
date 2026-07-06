import { useMemo } from 'react'
import './WorkloadPanel.css'

const STATUS_ORDER = ['in_progress', 'not_started', 'blocked', 'done']
const STATUS_SHORT = {
  in_progress: 'In progress',
  not_started: 'Not started',
  blocked: 'Blocked',
  done: 'Done',
}

export default function WorkloadPanel({ members, deadlines }) {
  const workload = useMemo(() => {
    return members.map(m => {
      const assigned = deadlines.filter(d => d.assigneeId === m.id)
      const counts = STATUS_ORDER.reduce((acc, key) => {
        acc[key] = assigned.filter(d => d.status === key).length
        return acc
      }, {})
      return { member: m, total: assigned.length, counts }
    })
  }, [members, deadlines])

  return (
    <section className="workload-panel">
      <div className="workload-panel-header">
        <h2>Workload</h2>
        <span className="workload-count mono">{deadlines.length}</span>
      </div>

      {workload.length === 0 ? (
        <div className="workload-empty">No members yet.</div>
      ) : (
        <div className="workload-list">
          {workload.map(({ member, total, counts }) => (
            <div className="workload-row" key={member.id}>
              <div className="workload-row-top">
                <span className="workload-avatar mono">{member.name?.[0]?.toUpperCase() || '?'}</span>
                <span className="workload-name">{member.name}</span>
                <span className="workload-total mono">{total}</span>
              </div>
              {total === 0 ? (
                <div className="workload-none">No tasks assigned</div>
              ) : (
                <div className="workload-tags">
                  {STATUS_ORDER.filter(key => counts[key] > 0).map(key => (
                    <span key={key} className={`workload-tag workload-tag--${key}`}>
                      {STATUS_SHORT[key]} {counts[key]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
