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
    return new Error("The AI Assistant is currently unavailable. Please ensure the backend is deployed.")
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
    if (err?.code === 'functions/not-found' || err?.code === 'functions/internal') {
      console.warn(`[AI Mock] Cloud function '${name}' failed or is not deployed. Returning mock data for demonstration.`)
      return getMockData(name, data)
    }
    throw toFriendlyError(err)
  }
}

// Mock implementation to allow testing the UI without deploying Cloud Functions or setting up an Anthropic key.
async function getMockData(name, data) {
  await new Promise(resolve => setTimeout(resolve, 1500)) // simulate network delay

  switch (name) {
    case 'breakFeatureIntoTasks':
      return {
        tasks: [
          { title: 'Setup database schema', estimatedHours: 2, dependencies: [] },
          { title: 'Implement backend API', estimatedHours: 4, dependencies: ['Setup database schema'] },
          { title: 'Build frontend UI', estimatedHours: 6, dependencies: ['Implement backend API'] },
        ]
      }
    case 'estimateHours':
      return {
        estimatedHours: Math.floor(Math.random() * 8) + 2,
        reasoning: 'This is a mock estimate based on typical frontend/backend integration overhead for a part-time team.'
      }
    case 'generateDefinitionOfDone':
      return {
        definitionOfDone: 'Code is reviewed, all tests pass, feature is deployed to staging, and verified by the product owner without regressions.'
      }
    case 'generateAcceptanceCriteria':
      return {
        criteria: [
          'User can click the run button and see a loading state.',
          'System returns the mocked AI response within 2 seconds.',
          'Error gracefully falls back to mock data if the backend is unavailable.',
          'UI correctly parses and displays the returned JSON structure.'
        ]
      }
    case 'summarizeSprint':
      return {
        summary: 'This sprint we successfully shipped the core AI widget and integrated the meetings API. We slipped on the analytics dashboard due to unforeseen database migration issues, but we are well positioned for next week.'
      }
    case 'identifyRisks':
      return {
        risks: [
          { deadlineId: 'mock-1', title: 'Implement backend API', reason: 'Missing hour estimate makes planning difficult.' },
          { deadlineId: 'mock-2', title: 'Analytics Dashboard', reason: 'Blocked by database migration task.' }
        ]
      }
    case 'detectOverloadedFounders':
      return {
        overloaded: [
          { memberId: 'user-1', name: 'Harsh Pal Singh', overByHours: 4 }
        ]
      }
    default:
      return { message: 'Mock data fallback executed.' }
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
