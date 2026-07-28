import { useEffect, useMemo, useState, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { subscribeSprints, lockSprint } from '../lib/sprints'
import { subscribeMembers } from '../lib/deadlines'
import { subscribeMeetings, createMeeting, updateMeetingNote, AGENDA_STEPS } from '../lib/meetings'
import NotificationBell from '../components/NotificationBell'
import NavTabs from '../components/NavTabs'
import ReflectionPanel from '../components/ReflectionPanel'
import Breadcrumbs from '../components/Breadcrumbs'
import './Dashboard.css'
import './Meeting.css'

const TEAM_ID = 'default-team'

export default function Meeting() {
  const { user, logout } = useAuth()
  const [sprints, setSprints] = useState([])
  const [meetings, setMeetings] = useState([])
  const [members, setMembers] = useState([])
  const [activeStep, setActiveStep] = useState(0)
  const [creating, setCreating] = useState(false)
  const debounceRefs = useRef({})

  useEffect(() => {
    const unsub1 = subscribeSprints(TEAM_ID, setSprints)
    const unsub2 = subscribeMeetings(TEAM_ID, setMeetings)
    const unsub3 = subscribeMembers(TEAM_ID, setMembers)
    return () => { unsub1(); unsub2(); unsub3() }
  }, [])

  const activeSprint = useMemo(() => sprints.find(s => s.status === 'active'), [sprints])
  const todayMeeting = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return meetings.find(m => m.date === today && m.sprintId === (activeSprint?.id || null))
  }, [meetings, activeSprint])

  async function handleStartMeeting() {
    setCreating(true)
    try {
      await createMeeting(TEAM_ID, {
        sprintId: activeSprint?.id || null,
        date: new Date().toISOString().slice(0, 10),
        createdBy: user?.email,
      })
    } finally {
      setCreating(false)
    }
  }

  function handleNoteChange(stepKey, value) {
    setMeetings(prev => prev.map(m => m.id === todayMeeting.id
      ? { ...m, notes: { ...m.notes, [stepKey]: value } }
      : m))
    clearTimeout(debounceRefs.current[stepKey])
    debounceRefs.current[stepKey] = setTimeout(() => {
      updateMeetingNote(todayMeeting.id, stepKey, value)
    }, 500)
  }

  async function handleLockAndFinish() {
    if (!activeSprint) return
    if (!confirm(`Lock Sprint ${activeSprint.number}? New tasks and deadline/owner/estimate changes will be frozen.`)) return
    await lockSprint(activeSprint.id)
  }

  const step = AGENDA_STEPS[activeStep]

  return (
    <div className="dash">
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-brand">
            <span className="dash-brand-dot" />
            <span className="mono">SECURIQ <span className="dash-brand-sub">| Meeting</span></span>
          </div>
          <div className="dash-header-actions">
            <NavTabs />
            <NotificationBell teamId={TEAM_ID} currentUser={user} />
            <span className="dash-user">{user?.displayName || user?.email}</span>
            <button className="btn-ghost btn-sm" onClick={logout}>Sign out</button>
          </div>
        </div>
      </header>

      <main className="dash-body">
        <Breadcrumbs trail={[{ label: 'Meeting' }]} />

        {!todayMeeting ? (
          <div className="empty-state">
            <p>No meeting started for today{activeSprint ? ` (Sprint ${activeSprint.number})` : ''} yet.</p>
            <button className="btn-primary btn-sm" style={{ marginTop: 12 }} disabled={creating} onClick={handleStartMeeting}>
              {creating ? 'Starting…' : 'Start today\'s meeting'}
            </button>
          </div>
        ) : (
          <>
            <div className="meeting-steps">
              {AGENDA_STEPS.map((s, i) => (
                <button
                  key={s.key}
                  className={`meeting-step-tab${i === activeStep ? ' meeting-step-tab--active' : ''}${todayMeeting.notes?.[s.key] ? ' meeting-step-tab--filled' : ''}`}
                  onClick={() => setActiveStep(i)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <section className="sprint-overview meeting-panel">
              <h2 className="mono">{step.label}</h2>
              <textarea
                className="meeting-notes-input"
                rows={10}
                value={todayMeeting.notes?.[step.key] || ''}
                onChange={(e) => handleNoteChange(step.key, e.target.value)}
                placeholder="Notes auto-save as you type…"
                autoFocus
              />
              <div className="meeting-panel-actions">
                <button
                  className="btn-ghost btn-sm"
                  disabled={activeStep === 0}
                  onClick={() => setActiveStep(s => Math.max(0, s - 1))}
                >
                  ← Previous
                </button>
                {activeStep < AGENDA_STEPS.length - 1 ? (
                  <button className="btn-primary btn-sm" onClick={() => setActiveStep(s => Math.min(AGENDA_STEPS.length - 1, s + 1))}>
                    Next →
                  </button>
                ) : (
                  <button className="btn-primary btn-sm" onClick={handleLockAndFinish} disabled={!activeSprint || activeSprint.locked}>
                    {activeSprint?.locked ? 'Sprint already locked' : 'Lock sprint & finish'}
                  </button>
                )}
              </div>
            </section>
          </>
        )}

        {activeSprint && (
          <ReflectionPanel teamId={TEAM_ID} sprint={activeSprint} currentUser={user} members={members} />
        )}

        {meetings.length > 0 && (
          <>
            <h2 className="mydash-section-title mono" style={{ marginTop: 8 }}>PAST MEETINGS</h2>
            <div className="meeting-history">
              {meetings.filter(m => m.id !== todayMeeting?.id).slice(0, 10).map(m => (
                <div key={m.id} className="meeting-history-row">
                  <span className="mono">{m.date}</span>
                  <span>{Object.values(m.notes || {}).filter(Boolean).length} / {AGENDA_STEPS.length} steps filled</span>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
