import { createClient } from '@supabase/supabase-js'
import { setCorsHeaders } from './_cors.js'
import { checkRateLimit } from './_rateLimit.js'
import { verifyWorkspaceAccess } from './_auth.js'
import { sanitizeError } from './_errors.js'

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (req.body && typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch (_) { return {} }
  }
  return req.body || {}
}

export default async function handler(req, res) {
  setCorsHeaders(req, res)
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (checkRateLimit(req, res, { max: 120, windowMs: 60000 })) return

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const activeKey = serviceKey || anonKey

  if (!rawUrl || !activeKey) {
    return res.status(500).json({ error: 'Supabase configuration missing' })
  }

  const supabaseUrl = rawUrl.replace(/["']/g, '').trim()
  const supabaseAdmin = createClient(supabaseUrl, activeKey.replace(/["']/g, '').trim())

  const body = parseBody(req)
  const workspaceId = req.query?.workspaceId || body.workspaceId || body.workspace_id

  if (!workspaceId) {
    return res.status(400).json({ error: 'Missing required workspaceId parameter' })
  }

  // Verify caller identity and workspace administrative access
  const authRes = await verifyWorkspaceAccess(req, supabaseAdmin, workspaceId, { requireAdmin: true })
  if (authRes.error) {
    return res.status(authRes.status || 403).json({ error: authRes.error })
  }

  try {
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Query core collections in parallel
    const [membersRes, invitesRes, sprintsRes, deadlinesRes, workspaceRes] = await Promise.all([
      supabaseAdmin
        .from('workspace_members')
        .select('user_id, role, created_at, users:user_id(id, email, raw_user_meta_data)')
        .eq('workspace_id', workspaceId),
      supabaseAdmin
        .from('invites')
        .select('id, email, role, created_at, status')
        .eq('workspace_id', workspaceId),
      supabaseAdmin
        .from('sprints')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('deadlines')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('due_date', { ascending: true }),
      supabaseAdmin
        .from('workspaces')
        .select('id, name, created_at, settings, billing_plan_id')
        .eq('id', workspaceId)
        .maybeSingle()
    ])

    const members = membersRes.data || []
    const invites = invitesRes.data || []
    const sprints = sprintsRes.data || []
    const tasks = deadlinesRes.data || []
    const workspace = workspaceRes.data || {}

    // 1. Task Metrics
    const isDone = (t) => ['done', 'completed', 'shipped'].includes((t.status || '').toLowerCase())
    const completedTasks = tasks.filter(isDone)
    const activeTasks = tasks.filter((t) => !isDone(t))
    const inProgressTasks = tasks.filter((t) => ['in_progress', 'doing'].includes((t.status || '').toLowerCase()))
    const reviewTasks = tasks.filter((t) => ['review', 'in_review'].includes((t.status || '').toLowerCase()))
    const todoTasks = tasks.filter((t) => ['todo', 'backlog', 'planned'].includes((t.status || '').toLowerCase()))

    const overdueTasks = activeTasks.filter((t) => {
      if (!t.due_date && !t.dueDate) return false
      return new Date(t.due_date || t.dueDate) < now
    })

    const unassignedTasks = activeTasks.filter((t) => !t.assignee_id && !t.assigneeId && !t.assignee_email && !t.assigneeEmail)

    const stalledTasks = activeTasks.filter((t) => {
      const lastActive = t.last_activity_at || t.created_at || t.createdAt
      return lastActive && new Date(lastActive) < new Date(sevenDaysAgo)
    })

    // 2. Project / Sprint Metrics with health calculation
    const projectSummaries = sprints.map((s) => {
      const sTasks = tasks.filter((t) => (t.sprint_id || t.sprintId) === s.id)
      const sDone = sTasks.filter(isDone)
      const sOverdue = sTasks.filter((t) => {
        if (isDone(t)) return false
        const d = t.due_date || t.dueDate
        return d && new Date(d) < now
      })
      const progress = sTasks.length > 0 ? Math.round((sDone.length / sTasks.length) * 100) : 0
      const isDelayed = sOverdue.length > 0 || (s.end_date && new Date(s.end_date) < now && s.status !== 'completed')
      
      let health = 'on_track'
      if (s.status === 'completed') health = 'completed'
      else if (sOverdue.length >= 3 || (s.end_date && new Date(s.end_date) < now)) health = 'critical'
      else if (sOverdue.length > 0) health = 'at_risk'

      return {
        id: s.id,
        name: s.name || (s.goal ? s.goal.slice(0, 40) : `Sprint #${s.number || 1}`),
        goal: s.goal || '',
        number: s.number,
        status: s.status || 'active',
        priority: s.priority || 'medium',
        startDate: s.start_date || s.startDate,
        endDate: s.end_date || s.endDate,
        archived: Boolean(s.archived),
        ownerId: s.owner_id || s.ownerId,
        totalTasks: sTasks.length,
        completedTasks: sDone.length,
        overdueTasks: sOverdue.length,
        progress,
        health,
        isDelayed
      }
    })

    const activeProjects = projectSummaries.filter((p) => p.status === 'active' && !p.archived)
    const completedProjects = projectSummaries.filter((p) => p.status === 'completed' || p.progress === 100)
    const archivedProjects = projectSummaries.filter((p) => p.archived)
    const projectsRequiringAttention = activeProjects.filter((p) => p.health === 'critical' || p.health === 'at_risk')

    // 3. Team Workload Distribution
    const memberWorkload = members.map((m) => {
      const u = m.users || {}
      const meta = u.raw_user_meta_data || {}
      const mEmail = (u.email || '').toLowerCase()
      const mId = m.user_id

      const userTasks = tasks.filter((t) => {
        const tEmail = (t.assignee_email || t.assigneeEmail || '').toLowerCase()
        const tId = t.assignee_id || t.assigneeId
        return (tEmail && mEmail && tEmail === mEmail) || (tId && mId && tId === mId)
      })

      const userActive = userTasks.filter((t) => !isDone(t))
      const userDone = userTasks.filter(isDone)
      const userOverdue = userActive.filter((t) => {
        const d = t.due_date || t.dueDate
        return d && new Date(d) < now
      })

      let workloadStatus = 'Balanced'
      if (userActive.length > 5) workloadStatus = 'Overloaded'
      else if (userActive.length === 0) workloadStatus = 'Available'

      return {
        userId: m.user_id,
        email: u.email || 'Member',
        name: meta.full_name || meta.name || u.email?.split('@')[0] || 'Member',
        avatarUrl: meta.avatar_url || null,
        role: m.role || 'member',
        joinedAt: m.created_at,
        activeTasksCount: userActive.length,
        completedTasksCount: userDone.length,
        overdueTasksCount: userOverdue.length,
        workloadStatus,
        recentActiveTasks: userActive.slice(0, 3).map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          dueDate: t.due_date || t.dueDate,
          status: t.status
        }))
      }
    })

    // 4. Productivity Calculation
    const overallProductivity = tasks.length > 0 
      ? Math.round((completedTasks.length / tasks.length) * 100) 
      : 100

    // 5. Next Critical Milestones (closest upcoming active tasks)
    const upcomingDeadlines = activeTasks
      .filter((t) => t.due_date || t.dueDate)
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.due_date || t.dueDate,
        priority: t.priority || 'medium',
        status: t.status,
        assigneeName: t.assignee_name || t.assigneeName || 'Unassigned',
        assigneeId: t.assignee_id || t.assigneeId,
        sprintId: t.sprint_id || t.sprintId
      }))

    return res.status(200).json({
      success: true,
      workspace: {
        id: workspace.id,
        name: workspace.name || 'Workspace',
        plan: workspace.billing_plan_id || 'free'
      },
      overview: {
        totalMembers: members.length,
        pendingInvites: invites.length,
        totalProjects: sprints.length,
        activeProjectsCount: activeProjects.length,
        completedProjectsCount: completedProjects.length,
        archivedProjectsCount: archivedProjects.length,
        attentionProjectsCount: projectsRequiringAttention.length,
        totalTasks: tasks.length,
        activeTasksCount: activeTasks.length,
        todoTasksCount: todoTasks.length,
        inProgressTasksCount: inProgressTasks.length,
        reviewTasksCount: reviewTasks.length,
        completedTasksCount: completedTasks.length,
        overdueTasksCount: overdueTasks.length,
        unassignedTasksCount: unassignedTasks.length,
        stalledTasksCount: stalledTasks.length,
        overallProductivity
      },
      projects: projectSummaries,
      attentionProjects: projectsRequiringAttention,
      upcomingDeadlines,
      teamWorkload: memberWorkload,
      invites: invites.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        createdAt: inv.created_at
      }))
    })
  } catch (err) {
    console.error('API admin-overview error:', err)
    return res.status(500).json({ error: sanitizeError(err, 'Failed to generate admin overview') })
  }
}
