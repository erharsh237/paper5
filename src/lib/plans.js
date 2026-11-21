// Subscription Plans & Plan Capacity Management for SprintOS / Paper5

export const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter (Free)',
    price: 0,
    maxWorkspaces: 1,
    maxMembers: 3,
    allowedIntegrations: ['google_calendar'],
    hasAdvancedAnalytics: false,
    hasAdvancedRiskRadar: false,
    hasPrioritySupport: false,
    hasOneClickApi: false,
    hasAuditCsvExport: false,
    hasSprintLock: false,
  },
  team: {
    id: 'team',
    name: 'Team',
    price: 0,
    maxWorkspaces: 5,
    maxMembers: 7,
    allowedIntegrations: ['google_calendar', 'github'],
    hasAdvancedAnalytics: true,
    hasAdvancedRiskRadar: false,
    hasPrioritySupport: false,
    hasOneClickApi: false,
    hasAuditCsvExport: false,
    hasSprintLock: true,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 0,
    maxWorkspaces: 10,
    maxMembers: Infinity,
    allowedIntegrations: ['google_calendar', 'github', 'slack', 'discord', 'vercel'],
    hasAdvancedAnalytics: true,
    hasAdvancedRiskRadar: true,
    hasPrioritySupport: true,
    hasOneClickApi: true,
    hasAuditCsvExport: true,
    hasSprintLock: true,
  },
  scale: {
    id: 'scale',
    name: 'Scale (Pro)',
    price: 0,
    maxWorkspaces: 10,
    maxMembers: Infinity,
    allowedIntegrations: ['google_calendar', 'github', 'slack', 'discord', 'vercel'],
    hasAdvancedAnalytics: true,
    hasAdvancedRiskRadar: true,
    hasPrioritySupport: true,
    hasOneClickApi: true,
    hasAuditCsvExport: true,
    hasSprintLock: true,
  }
}

export function getPlanLimits(planId) {
  if (!planId) return PLANS.pro
  const p = String(planId).toLowerCase().trim()
  if (p === 'starter' || p === 'free') {
    return PLANS.starter
  }
  if (p === 'team') {
    return PLANS.team
  }
  if (p === 'pro' || p === 'scale' || p === 'enterprise') {
    return PLANS.pro
  }
  return PLANS[p] || PLANS.pro
}

export function formatPlanBadge(planId) {
  if (!planId) return 'PRO'
  const p = String(planId).toLowerCase().trim()
  if (p === 'pro' || p === 'scale' || p === 'enterprise') return 'PRO'
  if (p === 'team') return 'TEAM'
  if (p === 'starter' || p === 'free' || p === 'member') return 'PRO'
  return p.toUpperCase()
}

export function checkMemberCapacity(planId, currentMemberCount) {
  const plan = getPlanLimits(planId)
  if (plan.maxMembers === Infinity) {
    return { overCapacity: false, limit: Infinity, count: currentMemberCount, excess: 0 }
  }
  const excess = currentMemberCount - plan.maxMembers
  return {
    overCapacity: excess > 0,
    limit: plan.maxMembers,
    count: currentMemberCount,
    excess: Math.max(0, excess)
  }
}

export function checkWorkspaceCapacity(planId, currentWorkspaceCount) {
  const plan = getPlanLimits(planId)
  if (plan.maxWorkspaces === Infinity) {
    return { overCapacity: false, limit: Infinity, count: currentWorkspaceCount, excess: 0 }
  }
  const excess = currentWorkspaceCount - plan.maxWorkspaces
  return {
    overCapacity: excess > 0,
    limit: plan.maxWorkspaces,
    count: currentWorkspaceCount,
    excess: Math.max(0, excess)
  }
}
