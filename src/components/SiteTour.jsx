import { useState } from 'react'
import { markTourSeen } from '../lib/onboarding'
import { useWorkspace } from '../lib/WorkspaceContext'
import './SiteTour.css'

const STEPS = [
  {
    title: 'Welcome to SprintOS by Paper5 🚀',
    body: "SprintOS keeps your team aligned and shipping on time. Let's take a quick 4-step walkthrough of your workspace features.",
  },
  {
    title: 'My Tasks & Personal Focus 📌',
    body: "This is your personal workspace hub. Track your active deadlines, overdue items, and sprint goals. Use the top navigation tabs to view the team board, meeting notes, and analytics.",
  },
  {
    title: 'Locked Sprints & Proof of Work ⚡',
    body: "Keep scope creep out of your delivery cycle. Sprints lock task definitions, while completing tasks allows submitting proof of work (PR links or commit hashes) for team verification.",
  },
  {
    title: 'Real-time Notifications & Integrations 🔔',
    body: "Stay updated with workspace bell alerts, meeting note broadcasts, and GitHub repo connections in Workspace Settings → Integrations.",
  },
]

export default function SiteTour({ currentUser, onFinish }) {
  const { workspaceId } = useWorkspace();
  const [step, setStep] = useState(0)
  const [dismissing, setDismissing] = useState(false)
  const isLast = step === STEPS.length - 1

  async function handleClose() {
    setDismissing(true)
    try {
      const uid = currentUser?.id || currentUser?.uid
      await markTourSeen(uid)
    } finally {
      onFinish()
    }
  }

  const current = STEPS[step]

  return (
    <div className="tour-overlay">
      <div className="tour-panel" role="dialog" aria-modal="true" aria-label="Site tour">
        <div className="tour-dots">
          {STEPS.map((_, i) => (
            <span key={i} className={`tour-dot${i === step ? ' tour-dot--active' : ''}`} />
          ))}
        </div>

        <h2 className="tour-title">{current.title}</h2>
        <p className="tour-body">{current.body}</p>

        <div className="tour-actions">
          <button className="btn-ghost btn-sm" onClick={handleClose} disabled={dismissing}>
            Skip tour
          </button>
          <div className="tour-actions-nav">
            {step > 0 && (
              <button className="btn-ghost btn-sm" onClick={() => setStep(s => s - 1)} disabled={dismissing}>
                Back
              </button>
            )}
            {isLast ? (
              <button className="btn-primary btn-sm" onClick={handleClose} disabled={dismissing}>
                {dismissing ? 'Finishing…' : "Got it, let's go"}
              </button>
            ) : (
              <button className="btn-primary btn-sm" onClick={() => setStep(s => s + 1)}>
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
