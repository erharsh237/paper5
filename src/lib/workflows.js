// Agile Workflows Configuration & Plan Access Control for SprintOS

export const WORKFLOWS = [
  {
    id: 'adhoc',
    num: 1,
    name: 'Ad-hoc / No formal process',
    teamSizeLabel: '1 (Solo)',
    minTeamSize: 1,
    maxTeamSize: 1,
    sweetSpot: '1 (solo founder)',
    plans: ['free', 'starter', 'team', 'scale'],
    badge: 'Solo Founder Queue',
    description: 'Minimal lightweight task queue without rigid sprint cycles. Perfect for solo builders working on MVP proof of concepts.',
    columns: [
      { id: 'backlog', title: 'To Do' },
      { id: 'in_progress', title: 'In Progress' },
      { id: 'done', title: 'Done' }
    ],
    practices: [
      'Simple To-Do / In-Progress / Done task list',
      'No fixed sprint deadlines or velocity math required',
      'Instant task creation and fast iteration'
    ]
  },
  {
    id: 'kanban',
    num: 2,
    name: 'Kanban',
    teamSizeLabel: '1–10 (sweet spot 2–6)',
    minTeamSize: 1,
    maxTeamSize: 10,
    sweetSpot: '2–6 members',
    plans: ['free', 'starter', 'team', 'scale'],
    badge: 'Continuous Flow',
    description: 'Continuous flow management with Work-In-Progress (WIP) limits to prevent bottlenecks and maximize throughput.',
    columns: [
      { id: 'backlog', title: 'Backlog' },
      { id: 'ready', title: 'Ready for Dev' },
      { id: 'in_progress', title: 'In Progress (WIP: 3)' },
      { id: 'code_review', title: 'Review / QA (WIP: 2)' },
      { id: 'done', title: 'Done' }
    ],
    practices: [
      'Visual Board with Strict WIP Limits',
      'Continuous Delivery (no artificial sprint end dates)',
      'Cycle time tracking and bottleneck identification'
    ]
  },
  {
    id: 'xp',
    num: 3,
    name: 'Extreme Programming (XP)',
    teamSizeLabel: '2–12',
    minTeamSize: 2,
    maxTeamSize: 12,
    sweetSpot: '2–8 members',
    plans: ['team', 'scale'],
    badge: 'High Quality Engineering',
    description: 'Engineering-centric workflow focusing on pair programming, test-driven development (TDD), and rapid feedback loops.',
    columns: [
      { id: 'user_stories', title: 'User Stories' },
      { id: 'pair_programming', title: 'Pair Dev / TDD' },
      { id: 'ci_testing', title: 'CI Build & Integration' },
      { id: 'customer_accept', title: 'Customer Acceptance' },
      { id: 'shipped', title: 'Shipped' }
    ],
    practices: [
      'Pair Programming (2 devs per task)',
      'Test-Driven Development (TDD) required before merge',
      'Frequent 1-week micro-releases'
    ]
  },
  {
    id: 'lean',
    num: 4,
    name: 'Lean Software Development',
    teamSizeLabel: '2–15+ (flexible)',
    minTeamSize: 2,
    maxTeamSize: 15,
    sweetSpot: '3–10 members',
    plans: ['team', 'scale'],
    badge: 'Waste Elimination',
    description: 'Eliminate waste, amplify learning, decide as late as possible, and deliver as fast as possible.',
    columns: [
      { id: 'validated_learnings', title: 'Validated Hypotheses' },
      { id: 'build_mvp', title: 'MVP Build' },
      { id: 'measure_metrics', title: 'Measure & Test' },
      { id: 'pivot_persevere', title: 'Validated / Learned' }
    ],
    practices: [
      'Eliminate waste & non-essential features',
      'Fast feedback loop (Build -> Measure -> Learn)',
      'Defer commitment until last responsible moment'
    ]
  },
  {
    id: 'scrumban',
    num: 5,
    name: 'Scrumban',
    teamSizeLabel: '3–8',
    minTeamSize: 3,
    maxTeamSize: 8,
    sweetSpot: '4–6 members',
    plans: ['team', 'scale'],
    badge: 'Hybrid Agility',
    description: 'Combines the structure of Scrum (standups, retrospectives) with the continuous pull-based flexibility of Kanban.',
    columns: [
      { id: 'sprint_backlog', title: 'Sprint Backlog' },
      { id: 'in_progress', title: 'In Progress (WIP: 4)' },
      { id: 'testing_buffer', title: 'Pull Buffer / Testing' },
      { id: 'ready_deploy', title: 'Ready to Deploy' },
      { id: 'done', title: 'Done' }
    ],
    practices: [
      'On-demand planning when backlog hits trigger limit',
      'WIP limits combined with sprint cadence',
      'Flexible sprint goal adjustments'
    ]
  },
  {
    id: 'scrum',
    num: 6,
    name: 'Scrum',
    teamSizeLabel: '5–9 (flexes 3–11)',
    minTeamSize: 3,
    maxTeamSize: 11,
    sweetSpot: '5–9 members',
    plans: ['team', 'scale'],
    badge: 'Structured Time-Boxes',
    description: 'Classic Scrum sprints (1-2 weeks) with sprint planning, daily standups, sprint reviews, and burndown charts.',
    columns: [
      { id: 'product_backlog', title: 'Product Backlog' },
      { id: 'sprint_backlog', title: 'Sprint Backlog (Scope Locked)' },
      { id: 'in_progress', title: 'In Progress' },
      { id: 'review_pow', title: 'Proof of Work Review' },
      { id: 'completed', title: 'Completed' }
    ],
    practices: [
      'Strict 2-week Sprint Time-Boxes & Scope Lock',
      'Daily 15-min Standups & Sunday Sync',
      'Burndown Charts & Velocity Calculation'
    ]
  },
  {
    id: 'spotify',
    num: 7,
    name: 'Spotify Model',
    teamSizeLabel: '50–500+',
    minTeamSize: 50,
    maxTeamSize: 500,
    sweetSpot: '50+ enterprise',
    plans: ['scale'],
    badge: 'Scale Enterprise (Squads & Guilds)',
    description: 'Autonomous multi-team organization divided into Squads, Tribes, Chapters, and Guilds for massive enterprise scaling.',
    columns: [
      { id: 'tribe_backlog', title: 'Tribe Strategy' },
      { id: 'squad_backlog', title: 'Squad Backlog' },
      { id: 'chapter_review', title: 'Chapter QA & Peer Review' },
      { id: 'guild_alignment', title: 'Guild Architecture Sync' },
      { id: 'shipped', title: 'Shipped to Prod' }
    ],
    practices: [
      'Autonomous Squads aligned by product feature area',
      'Tribes for cross-squad domain governance',
      'Guilds & Chapters for engineering skill sharing'
    ]
  },
  {
    id: 'safe',
    num: 8,
    name: 'SAFe (Scaled Agile Framework)',
    teamSizeLabel: '50–100s',
    minTeamSize: 50,
    maxTeamSize: 1000,
    sweetSpot: '100+ enterprise',
    plans: ['scale'],
    badge: 'Enterprise Program Increment (PI)',
    description: 'Structured enterprise framework organizing multiple agile release trains (ARTs) into 8-12 week Program Increments (PI).',
    columns: [
      { id: 'portfolio_backlog', title: 'Portfolio Epics' },
      { id: 'pi_planning', title: 'PI Planning (ART)' },
      { id: 'sprint_execution', title: 'Sprint Iteration' },
      { id: 'system_demo', title: 'System Demo & Inspect' },
      { id: 'value_stream', title: 'Value Stream Delivered' }
    ],
    practices: [
      'Program Increment (PI) 8-12 week planning',
      'Agile Release Trains (ART) alignment',
      'Portfolio Epics & Value Stream Mapping'
    ]
  }
]

export const TEAM_SIZE_OPTIONS = [
  { value: '1', label: '1 (Solo Founder)', defaultWorkflow: 'adhoc' },
  { value: '2-5', label: '2–5 Members', defaultWorkflow: 'kanban' },
  { value: '6-10', label: '6–10 Members', defaultWorkflow: 'scrum' },
  { value: '11-20', label: '11–20 Members', defaultWorkflow: 'scrumban' },
  { value: '21-50', label: '21–50 Members', defaultWorkflow: 'lean' },
  { value: '50-100', label: '50–100 Members (Enterprise)', defaultWorkflow: 'spotify' },
  { value: '100-500+', label: '100–500+ Members (Enterprise)', defaultWorkflow: 'safe' }
]

export function getRecommendedWorkflow(teamSizeValue) {
  const option = TEAM_SIZE_OPTIONS.find(o => o.value === teamSizeValue)
  const workflowId = option ? option.defaultWorkflow : 'scrum'
  return WORKFLOWS.find(w => w.id === workflowId) || WORKFLOWS[5]
}

export function getUnlockedWorkflowsForPlan(planId) {
  const normalizedPlan = (planId || 'free').toLowerCase()
  if (normalizedPlan === 'scale') {
    return WORKFLOWS
  }
  if (normalizedPlan === 'team') {
    return WORKFLOWS.filter(w => w.plans.includes('team') || w.plans.includes('free') || w.plans.includes('starter'))
  }
  // Free / Starter
  return WORKFLOWS.filter(w => w.plans.includes('free') || w.plans.includes('starter'))
}

export function isWorkflowUnlocked(workflowId, planId) {
  const unlocked = getUnlockedWorkflowsForPlan(planId)
  return unlocked.some(w => w.id === workflowId)
}

export function getWorkflowById(workflowId) {
  return WORKFLOWS.find(w => w.id === workflowId) || WORKFLOWS[5] // Default to Scrum
}
