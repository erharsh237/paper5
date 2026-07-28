// AI Assistant — real implementation via Cloud Functions.
//
// This calls httpsCallable Cloud Functions (see functions/index.js), never
// the Anthropic API directly from the browser — a direct client-side call
// would mean shipping the API key inside the bundle, readable by anyone
// with dev tools open. The functions hold the key server-side and
// independently re-check the caller against the same allowedUsers
// collection the rest of the app uses.
//
// Requires functions/index.js to be deployed (see the setup comment at the
// top of that file) — until then every call below fails with a clear
// "functions/not-found"-style error surfaced through toFriendlyError.

import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'

export const AI_CAPABILITIES = [
  {
    id: 'breakFeatureIntoTasks',
    label: 'Break feature into tasks',
    description: 'Takes a feature description and sprint goal, returns a proposed task list (title, estimated hours, dependencies) ready to review before creating.',
    fields: [
      { key: 'description', label: 'Feature description', type: 'textarea', required: true },
      { key: 'sprintGoal', label: 'Current sprint goal (optional)', type: 'text' },
    ],
  },
  {
    id: 'estimateHours',
    label: 'Estimate hours',
    description: 'Takes a task title + description, returns a suggested estimatedHours value with reasoning, informed by realistic effort for a part-time team.',
    fields: [
      { key: 'title', label: 'Task title', type: 'text', required: true },
      { key: 'description', label: 'Description (optional)', type: 'textarea' },
    ],
  },
  {
    id: 'generateDefinitionOfDone',
    label: 'Generate Definition of Done',
    description: 'Takes a task title + description, returns a draft definitionOfDone string for the assignee to edit before the task starts.',
    fields: [
      { key: 'title', label: 'Task title', type: 'text', required: true },
      { key: 'description', label: 'Description (optional)', type: 'textarea' },
    ],
  },
  {
    id: 'generateAcceptanceCriteria',
    label: 'Generate acceptance criteria',
    description: 'Takes a task title + description, returns a checklist of testable acceptance criteria.',
    fields: [
      { key: 'title', label: 'Task title', type: 'text', required: true },
      { key: 'description', label: 'Description (optional)', type: 'textarea' },
    ],
  },
  {
    id: 'summarizeSprint',
    label: 'Summarize sprint',
    description: 'Takes a sprintId, returns a short narrative summary of what shipped, what slipped, and why — a first draft for Meeting Mode\'s "previous sprint review" step.',
    fields: [
      { key: 'sprintId', label: 'Sprint', type: 'sprint-select', required: true },
    ],
  },
  {
    id: 'identifyRisks',
    label: 'Identify risks',
    description: 'Takes a sprintId, returns a list of at-risk tasks (overdue, blocked, no estimate, dependency chains) with a one-line reason each.',
    fields: [
      { key: 'sprintId', label: 'Sprint', type: 'sprint-select', required: true },
    ],
  },
  {
    id: 'detectOverloadedFounders',
    label: 'Detect overloaded founders',
    description: 'Takes each founder\'s available hours this week, returns who is over capacity and by how much, based on their current assigned estimated hours.',
    fields: [
      { key: 'availableHoursByMember', label: 'Available hours per founder', type: 'hours-by-member', required: true },
    ],
  },
]

function toFriendlyError(err) {
  if (err?.code === 'functions/not-found' || err?.code === 'functions/internal') {
    return new Error("Can't reach the AI backend — it may not be deployed yet (see functions/index.js setup steps).")
  }
  if (err?.code === 'functions/unauthenticated') {
    return new Error('Sign in required.')
  }
  if (err?.code === 'functions/permission-denied') {
    return new Error("This account isn't authorized.")
  }
  if (err?.code === 'functions/invalid-argument') {
    return new Error(err.message || 'Missing required input.')
  }
  return new Error(err?.message || 'Something went wrong calling the AI backend.')
}

async function call(name, data) {
  try {
    const fn = httpsCallable(functions, name)
    const result = await fn(data)
    return result.data
  } catch (err) {
    throw toFriendlyError(err)
  }
}

export const aiAssistant = {
  async breakFeatureIntoTasks(description, sprintGoal) {
    return call('breakFeatureIntoTasks', { description, sprintGoal })
  },
  async estimateHours(title, description) {
    return call('estimateHours', { title, description })
  },
  async generateDefinitionOfDone(title, description) {
    return call('generateDefinitionOfDone', { title, description })
  },
  async generateAcceptanceCriteria(title, description) {
    return call('generateAcceptanceCriteria', { title, description })
  },
  async summarizeSprint(sprintId) {
    return call('summarizeSprint', { sprintId })
  },
  async identifyRisks(sprintId) {
    return call('identifyRisks', { sprintId })
  },
  async detectOverloadedFounders(availableHoursByMember) {
    return call('detectOverloadedFounders', { availableHoursByMember })
  },
}
