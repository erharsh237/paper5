import { useMemo, useState } from 'react'
import { daysLeft, getUrgency } from '../lib/utils'
import { setActiveSprint, lockSprint, unlockSprint } from '../lib/sprints'
import NewSprintModal from './NewSprintModal'
import './SprintOverview.css'

export default function SprintOverview({ teamId, sprints, deadlines, currentUser, members = [] }) {
  const [showNewSprint, setShowNewSprint] = useState(false)
  const active = useMemo(() => sprints.find(s => s.status === 'active'), [sprints])

  const sprintTasks = useMemo(() => {
    if (!active) return []
    return deadlines.filter(d => d.sprintId === active.id)
  }, [active, deadlines])

  const stats = useMemo(() => {
    const total = sprintTasks.length
    const done = sprintTasks.filter(t => t.status === 'done').length
    const blocked = sprintTasks.filter(t => t.status === 'blocked').length
    const overdue = sprintTasks.filter(t => getUrgency(t.dueDate, t.status) === 'overdue').length
    const remaining = total - done
    const progressPct = total === 0 ? 0 : Math.round((done / total) * 100)
    return { total, done, blocked, overdue, remaining, progressPct }
  }, [sprintTasks])

  const remainingDays = active ? daysLeft(active.endDate) : null

  const [lockError, setLockError] = useState(null)

  async function handleToggleLock() {
    if (!active) return
    setLockError(null)
    try {
      if (active.locked) {
        if (!confirm('Unlock this sprint? This allows adding tasks, changing deadlines/owners/estimates again.')) return
        await unlockSprint(active.id)
      } else {
        if (!confirm('Lock this sprint? New tasks, deadline/owner/estimate changes will be blocked until unlocked.')) return
        await lockSprint(active.id)
      }
    } catch (err) {
      setLockError(
        err?.code === 'permission-denied'
          ? 'Only an admin can unlock a locked sprint.'
          : 'Could not update the sprint. Try again.'
      )
    }
  }

  async function handleActivate(sprintId) {
    await setActiveSprint(teamId, sprintId)
  }

  return (
    <section className="sprint-overview">
      <div className="sprint-overview-header">
        <h2 className="mono">SPRINT OVERVIEW</h2>
        <div className="sprint-overview-actions">
          {sprints.length > 0 && !active && (
            <select
              className="filter-select"
              defaultValue=""
              onChange={(e) => e.target.value && handleActivate(e.target.value)}
            >
              <option value="" disabled>Activate a sprint…</option>
              {sprints.filter(s => s.status !== 'active').map(s => (
                <option key={s.id} value={s.id}>Sprint {s.number} — {s.goal || 'no goal set'}</option>
              ))}
            </select>
          )}
          <button className="btn-ghost btn-sm" onClick={() => setShowNewSprint(true)}>+ New sprint</button>
        </div>
      </div>

      {!active ? (
        <div className="empty-state sprint-overview-empty">
          <p>No active sprint. Create one or activate an existing sprint to plan this week's execution.</p>
        </div>
      ) : (
        <>
          <div className="sprint-overview-title-row">
            <div>
              <div className="sprint-number mono">SPRINT {active.number}{active.locked && <span className="sprint-lock-badge">🔒 LOCKED</span>}</div>
              <div className="sprint-goal">{active.goal || 'No sprint goal set.'}</div>
              {active.assigneeName && (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Owner: <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{active.assigneeName}</span>
                </div>
              )}
            </div>
            <button className="btn-ghost btn-sm" onClick={handleToggleLock}>
              {active.locked ? 'Unlock sprint' : 'Lock sprint'}
            </button>
          </div>

          {lockError && <div className="form-error">{lockError}</div>}

          <div className="sprint-progress-row">
            <div className="sprint-progress-bar-track">
              <div className="sprint-progress-bar-fill" style={{ width: `${stats.progressPct}%` }} />
            </div>
            <span className="mono sprint-progress-pct">{stats.progressPct}%</span>
          </div>

          <div className="sprint-stat-grid">
            <SprintStat label="Days remaining" value={remainingDays != null ? Math.max(remainingDays, 0) : '—'} />
            <SprintStat label="Tasks completed" value={stats.done} />
            <SprintStat label="Tasks remaining" value={stats.remaining} />
            <SprintStat label="Blocked" value={stats.blocked} tone={stats.blocked > 0 ? 'critical' : undefined} />
            <SprintStat label="Overdue" value={stats.overdue} tone={stats.overdue > 0 ? 'critical' : undefined} />
          </div>
        </>
      )}

      {showNewSprint && (
        <NewSprintModal
          teamId={teamId}
          currentUser={currentUser}
          existingCount={sprints.length}
          members={members}
          onClose={() => setShowNewSprint(false)}
        />
      )}
    </section>
  )
}

function SprintStat({ label, value, tone }) {
  return (
    <div className={`sprint-stat${tone ? ` sprint-stat--${tone}` : ''}`}>
      <div className="sprint-stat-value mono">{value}</div>
      <div className="sprint-stat-label">{label}</div>
    </div>
  )
}
