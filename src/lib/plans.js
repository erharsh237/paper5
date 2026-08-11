// Subscription Plans & Plan Capacity Management for SprintOS

export const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter (Free)',
    price: 0,
    maxWorkspaces: 1,
    maxMembers: 3,
    allowedIntegrations: ['github'],
    hasAdvancedAnalytics: false,
    hasPrioritySupport: false,
  },
  team: {
    id: 'team',
    name: 'Team',
    price: 0,
    maxWorkspaces: 5,
    maxMembers: 7,
    allowedIntegrations: ['github', 'google_calendar'],
    hasAdvancedAnalytics: false,
    hasPrioritySupport: false,
  },
  scale: {
    id: 'scale',
    name: 'Scale',
    price: 0,
    maxWorkspaces: 10,
    maxMembers: Infinity,
    allowedIntegrations: ['github', 'google_calendar', 'slack', 'vercel', 'discord'],
    hasOneClickApi: true,
    hasAdvancedAnalytics: true,
    hasPrioritySupport: true,
  }
}

export function getPlanLimits(planId) {
  return PLANS[planId?.toLowerCase()] || PLANS.starter
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
