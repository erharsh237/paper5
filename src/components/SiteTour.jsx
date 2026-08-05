import { useState } from 'react'
import { markTourSeen } from '../lib/onboarding'
import { useWorkspace } from '../lib/WorkspaceContext'
import './SiteTour.css'

const STEPS = [
  {
    title: 'Welcome to the tracker',
    body: "This is SprintOS - built to keep us shipping every Sunday instead of re-planning and missing deadlines. Quick tour, six steps, then you're in.",
  },
  {
    title: 'My tasks (this page)',
    body: "This is your personal home page — only your tasks, your stats, and anything waiting on your review. The Team tab still has everyone's board if you need the full picture.",
  },
  {
    title: 'Sprints get locked',
    body: "Every sprint has a goal and dates. Once it's locked (usually after Sunday planning) you can't add tasks or change owners/deadlines/estimates — but you can still update status, mark blocked, or submit work for review.",
  },
  {
    title: "Done isn't just a click",
    body: "To finish a task you submit evidence (a PR link, commit, screenshot, or notes) and someone else on the team approves it. Keeps 'done' meaning done.",
  },
  {
    title: 'Blockers notify everyone',
    body: "Stuck on something? Mark it blocked with a reason and who you need help from. Notifications go out to the whole team so nobody finds out at the next call.",
  },
  {
    title: 'Meeting, Analytics, and more',
    body: "Sunday sync has its own Meeting screen with the agenda built in. Analytics shows velocity and completion trends. That's the tour — you can always find these in the tabs up top.",
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
      await markTourSeen(workspaceId, currentUser?.uid)
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
