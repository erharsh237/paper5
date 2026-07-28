# Securiq Deadline Tracker — Documentation

A tool for a 4-person founder team building an AI cybersecurity product
part-time. Built around one goal: **every Sunday, the product should be
visibly better than last Sunday** — without overestimating, missing
deadlines, over-planning, losing momentum, or repeating the same
conversation every week.

---

## 1. Core concepts

### Sprint
A fixed block of time — normally one week — with a goal attached. Only one
sprint is "active" at a time. Every task you create attaches to whichever
sprint is currently active.

A sprint has: a number, a goal, a start/end date, a status
(`planning` / `active` / `completed`), and a lock state.

**Locking** a sprint (usually done during Sunday planning, from the
Meeting page) freezes:
- Adding new tasks
- Changing a task's deadline, owner, priority, or estimated hours

While locked, people can still:
- Update a task's status
- Mark a task blocked
- Submit a task for review
- Approve/reject a task in review

This is what stops a week's scope from quietly growing mid-sprint.

### Task (deadline)
The basic unit of work. Fields: title, description, priority, status, due
date, assignee, creator, estimated/actual hours, dependencies, labels,
Definition of Done, and which sprint it belongs to.

**Status flow:**
```
not_started → in_progress → blocked → review → done
```
A task cannot go straight to `done`. See "Evidence-based completion" below.

### Evidence-based completion
When a task is ready, the assignee clicks **Submit for review** and
provides evidence: a PR link, commit link, screenshot description, video
description, or notes. This moves the task to `review`.

**Any team member other than the assignee** can then:
- **Approve** → task becomes `done`
- **Reject**, with a note → task goes back to `in_progress`, assignee sees
  why

This is enforced server-side (Firestore rules) — the assignee (even if
they're also the task's creator/owner) cannot approve their own
submission.

### Blocker
When someone's stuck, they click **Mark blocked** and fill in:
- Reason
- Who they need help from
- Description

This notifies the whole team immediately (bell icon, top of every page).
Clearing a blocker returns the task to `in_progress`.

### Reflection
A short, per-founder, per-sprint check-in (bottom of the Meeting page):
did you finish your tasks, why not if you didn't, what was your biggest
blocker, what will you improve next sprint. One submission per person per
sprint — resubmitting updates it rather than creating a duplicate.

### Accountability level
Computed automatically from consecutive **completed** sprints where a
founder had at least one task that never reached `done`:

| Streak | Level | Shown recommendation |
|---|---|---|
| 1 missed sprint | Level 1 | Reduce workload next sprint |
| 2 in a row | Level 2 | Task assignment requires team approval |
| 3+ in a row | Level 3 | Assign one extra maintenance task next sprint |

These are visible status indicators only — nothing is automated or
punitive.

---

## 2. Pages, one by one

### My tasks (`/`) — default landing page
Your own tasks and stats only. Shows: active/overdue/due-soon/completed
counts, your completion rate, anything blocked that's yours, anything
waiting on your review from someone else's task, and your full task list
as cards.

### Team (`/team`)
The shared board. Everyone's tasks, filterable/searchable. This is where
you:
- Create a new deadline (**+ New Deadline** button)
- See the **Sprint Overview** widget (goal, progress bar, days remaining,
  lock toggle, activate/create sprint)
- See the **Members** panel and **Workload** panel
- Download a monthly CSV report

### Meeting (`/meeting`)
Your Sunday sync screen. Six fixed agenda steps (previous sprint review,
demo, blockers, plan next sprint, assign tasks, lock sprint). Notes
auto-save per step as you type. Last step gives you a **Lock sprint &
finish** button. Weekly Reflection sits at the bottom of this page.

### Analytics (`/analytics`)
Velocity per sprint, completion rate, estimated vs. actual hours, overdue
tasks by priority, average delay on completed tasks, most productive
sprint, and the Accountability status list.

### Integrations (`/integrations`)
Real, working connectors — not just placeholders:
- **Discord / Slack** — paste a webhook URL, click Test, get a real
  message in your channel. No account/OAuth needed.
- **GitHub** — works immediately for public repos (fetches PR/commit/CI
  status). Add a personal token for private repos or higher rate limits.
- **Vercel** — needs a personal API token + project ID; shows latest
  deployment status.
- **Google Calendar** — needs a one-time Google Cloud Console setup (an
  OAuth Client ID); pushes sprint dates/meeting slots onto the calendar.

Fields split into two kinds:
- **Config fields** (repo name, webhook URL, project ID) — shared with the
  whole team once saved.
- **Credential fields** (personal tokens) — marked "private to you," never
  visible to teammates.

### AI Assistant (`/ai`)
Real AI, via a secure backend (see §5). Seven capabilities: break a
feature into tasks, estimate hours, generate a Definition of Done, generate
acceptance criteria, summarize a sprint, identify risks, detect overloaded
founders. Each has its own input form and shows real results — not a
"not implemented" placeholder.

### Profile (`/profile`)
Your name, phone, role (picked from a team-maintained dropdown — anyone
can add a new role, but you don't free-type it), bio, profile photo,
resume upload, and an **aim** field ("what do you want to achieve from
Securiq") that **locks for 45 days** once saved — enforced server-side, not
just in the UI. Also has a "Retake site tour" link.

---

## 3. A week, start to finish

1. **Sunday** — open Meeting. Walk the 6 steps together: review what
   happened last sprint, demo what got done, talk through blockers, plan
   the next sprint's goal, assign tasks (create deadlines on the Team
   page), then lock the sprint.
2. **Everyone fills in their Weekly Reflection** while you're there.
3. **Through the week** — each person works from **My tasks**. Update
   status as you go. Mark blocked the moment you're stuck (not at the next
   meeting). Submit evidence when a task's actually done.
4. **Reviews happen continuously** — whenever someone submits for review,
   anyone else can approve/reject it right away rather than waiting for
   Sunday.
5. **Notifications** (bell icon) tell you about blockers, review requests,
   approvals, and rejections as they happen.
6. **Next Sunday** — check Analytics first (did we actually finish more
   than last sprint?), then repeat step 1.

---

## 4. Data model reference (Firestore collections)

| Collection | What it holds | Who can read | Who can write |
|---|---|---|---|
| `allowedUsers` | Email allowlist gate | signed-in users | nobody (console only) |
| `members` | Team roster | team | any allowed user |
| `deadlines` | Tasks | team | assignee (status only) / owner (full) |
| `deadlines/{id}/evidence` | Evidence submissions | team | assignee only, append-only |
| `deadlines/{id}/extraWork` | Extra-work notes | team | assignee only, append-only |
| `sprints` | Sprints | team | any allowed user |
| `notifications` | In-app bell items | team + targeted | any allowed user |
| `meetings` | Meeting notes | team | any allowed user |
| `reflections` | Weekly reflections | team | own reflection only |
| `roles` | Role dropdown options | team | any allowed user (append-only) |
| `profiles` | Profile info | team (read) | own profile only |
| `onboarding` | Site-tour-seen flag | self only | self only |
| `integrationConfig` | Shared integration settings | team | any allowed user |
| `integrationCredentials` | Personal API tokens | self only | self only |

---

## 5. Setup & deployment (condensed — see prior chat messages for full detail)

1. `npm install`
2. Create `.env` with your Firebase web app config (`VITE_FIREBASE_*` keys)
3. Enable **Authentication** (Google sign-in), **Firestore**, and
   **Storage** in Firebase Console
4. Fill in `.firebaserc` with your real project ID
5. `firebase deploy --only firestore:rules,firestore:indexes,storage`
6. Manually seed `allowedUsers` and `members` docs in Firestore Console —
   there's no signup form by design
7. `npm run dev` to test locally
8. **Optional — AI Assistant:** `firebase functions:secrets:set
   ANTHROPIC_API_KEY`, then `firebase deploy --only functions` (needs the
   Blaze plan)
9. `npm run build && firebase deploy --only hosting` to go live

**Housekeeping commands:**
```bash
firebase firestore:delete deadlines --recursive   # wipe all tasks
firebase firestore:delete sprints --recursive      # wipe all sprints
firebase use                                       # confirm which project you're targeting
```

---

## 6. Design notes worth knowing

- **No admin role exists yet** — any allowed team member can unlock any
  sprint, delete any member, etc. Deliberate small-trusted-team tradeoff,
  not an oversight — flagged if you ever want it tightened.
- **Pagination** — the task list loads a bounded page (100 at a time) with
  a "Load more" button, not the whole history at once.
- **Evidence/extra-work** live in subcollections, not on the task doc
  itself, loaded only when you expand a card — keeps every page's data
  payload flat regardless of a task's history.
- **AI Assistant requires its own Cloud Functions deployment** — it won't
  work until you've done step 8 above and set your own Anthropic API key.
