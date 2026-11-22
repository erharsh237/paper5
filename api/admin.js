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
  const action = req.query?.action || body.action || (req.url && req.url.includes('audit-logs') ? 'audit-logs' : 'overview')

  if (!workspaceId) {
    return res.status(400).json({ error: 'Missing required workspaceId parameter' })
  }

  // Verify administrative privileges strictly on backend
  const authRes = await verifyWorkspaceAccess(req, supabaseAdmin, workspaceId, { requireAdmin: true })
  if (authRes.error) {
    return res.status(authRes.status || 403).json({ error: authRes.error })
  }

  // ─────────────────────────────────────────────────────────────
  // 1. AUDIT LOGS ENDPOINT
  // ─────────────────────────────────────────────────────────────
  if (action === 'audit-logs' || action === 'audit_logs') {
    res.setHeader('Content-Type', 'application/json')
    const limit = Math.min(parseInt(req.query?.limit || body.limit || '50', 10), 100)
    const offset = parseInt(req.query?.offset || body.offset || '0', 10)
    const resource = req.query?.resource || body.resource

    try {
      let query = supabaseAdmin
        .from('audit_logs')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (resource && resource !== 'all') {
        query = query.eq('resource', resource)
      }

      const { data: logs, error } = await query
      if (error) throw error

      const actorIds = [...new Set((logs || []).map((l) => l.actor_id).filter(Boolean))]
      const actorsMap = {}

      if (actorIds.length > 0) {
        try {
          const { data: users } = await supabaseAdmin
            .from('users')
            .select('id, email, raw_user_meta_data')
            .in('id', actorIds)

          ;(users || []).forEach((u) => {
            const meta = u.raw_user_meta_data || {}
            actorsMap[u.id] = {
              id: u.id,
              email: u.email,
              name: meta.full_name || meta.name || u.email?.split('@')[0] || 'Admin',
              avatarUrl: meta.avatar_url || null
            }
          })
        } catch (_) {}
      }

      const enrichedLogs = (logs || []).map((l) => ({
        id: l.id,
        action: l.action,
        resource: l.resource,
        metadata: l.metadata || {},
        createdAt: l.created_at,
        actor: actorsMap[l.actor_id] || { id: l.actor_id, name: 'System', email: '' }
      }))

      return res.status(200).json({
        success: true,
        logs: enrichedLogs,
        limit,
        offset
      })
    } catch (err) {
      console.error('API audit-logs error:', err)
      return res.status(500).json({ error: sanitizeError(err, 'Failed to fetch audit logs') })
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. CSV EXPORT ENDPOINT
  // ─────────────────────────────────────────────────────────────
  if (action === 'export') {
    const type = req.query?.type || body.type || 'tasks'
    try {
      if (type === 'tasks') {
        const { data: tasks } = await supabaseAdmin
          .from('deadlines')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('due_date', { ascending: true })

        const header = 'ID,Title,Status,Priority,Due Date,Assignee Name,Assignee Email,Created At\n'
        const rows = (tasks || []).map((t) => {
          const clean = (s) => `"${String(s || '').replace(/"/g, '""')}"`
          return [
            clean(t.id),
            clean(t.title),
            clean(t.status || 'todo'),
            clean(t.priority || 'medium'),
            clean(t.due_date || t.dueDate || ''),
            clean(t.assignee_name || t.assigneeName || ''),
            clean(t.assignee_email || t.assigneeEmail || ''),
            clean(t.created_at || '')
          ].join(',')
        }).join('\n')

        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="paper5-workspace-tasks-${Date.now()}.csv"`)
        return res.status(200).send(header + rows)
      }
    } catch (e) {
      return res.status(500).json({ error: 'Failed to generate export' })
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. OVERVIEW: REAL WORKSPACE EXECUTIVE AGGREGATE
  // ─────────────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'private, no-cache, stale-while-revalidate=10')
  try {
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [membersRes, invitesRes, sprintsRes, deadlinesRes, workspaceRes, recentLogsRes] = await Promise.all([
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
        .select('id, workspace_id, name, status, start_date, end_date, goal, created_at, archived')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('deadlines')
        .select('id, workspace_id, title, status, priority, due_date, assignee_id, sprint_id, created_at, description, tags, custom_fields')
        .eq('workspace_id', workspaceId)
        .order('due_date', { ascending: true }),
      supabaseAdmin
        .from('workspaces')
        .select('id, name, created_at, settings, billing_plan_id')
        .eq('id', workspaceId)
        .maybeSingle(),
      supabaseAdmin
        .from('audit_logs')
        .select('id, workspace_id, action, resource, actor_id, created_at, metadata')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(10)
    ])

    const members = membersRes.data || []
    const invites = invitesRes.data || []
    const sprints = sprintsRes.data || []
    const rawTasks = deadlinesRes.data || []
    const workspace = workspaceRes.data || {}
    const recentLogs = recentLogsRes.data || []

    const isDone = (t) => ['done', 'completed', 'shipped'].includes((t.status || '').toLowerCase())
    const completedTasks = rawTasks.filter(isDone)
    const activeTasks = rawTasks.filter((t) => !isDone(t))
    const inProgressTasks = rawTasks.filter((t) => ['in_progress', 'doing'].includes((t.status || '').toLowerCase()))
    const reviewTasks = rawTasks.filter((t) => ['review', 'in_review'].includes((t.status || '').toLowerCase()))
    const todoTasks = rawTasks.filter((t) => ['todo', 'backlog', 'planned'].includes((t.status || '').toLowerCase()))

    const overdueTasks = activeTasks.filter((t) => {
      if (!t.due_date && !t.dueDate) return false
      return new Date(t.due_date || t.dueDate) < now
    })

    const unassignedTasks = activeTasks.filter((t) => !t.assignee_id && !t.assigneeId && !t.assignee_email && !t.assigneeEmail)

    const stalledTasks = activeTasks.filter((t) => {
      const lastActive = t.last_activity_at || t.created_at || t.createdAt
      return lastActive && new Date(lastActive) < new Date(sevenDaysAgo)
    })

    // Project summaries
    const projectSummaries = sprints.map((s) => {
      const sTasks = rawTasks.filter((t) => (t.sprint_id || t.sprintId) === s.id)
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

    // Member workload
    const memberWorkload = members.map((m) => {
      const u = m.users || {}
      const meta = u.raw_user_meta_data || {}
      const mEmail = (u.email || '').toLowerCase()
      const mId = m.user_id

      const userTasks = rawTasks.filter((t) => {
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

    const overallProductivity = rawTasks.length > 0 
      ? Math.round((completedTasks.length / rawTasks.length) * 100) 
      : 100

    // Full task list mapped for Cross-Project Master Task Grid
    const mappedTasks = rawTasks.map((t) => {
      const tDue = t.due_date || t.dueDate
      const isOverdue = !isDone(t) && tDue && new Date(tDue) < now
      const lastActive = t.last_activity_at || t.created_at || t.createdAt
      const isStalled = !isDone(t) && lastActive && new Date(lastActive) < new Date(sevenDaysAgo)
      const sprint = sprints.find((s) => s.id === (t.sprint_id || t.sprintId))

      return {
        id: t.id,
        title: t.title,
        description: t.description || '',
        status: t.status || 'todo',
        priority: t.priority || 'medium',
        dueDate: tDue,
        assigneeId: t.assignee_id || t.assigneeId,
        assigneeName: t.assignee_name || t.assigneeName || 'Unassigned',
        assigneeEmail: t.assignee_email || t.assigneeEmail,
        sprintId: t.sprint_id || t.sprintId,
        sprintName: sprint?.name || (sprint?.number ? `Sprint #${sprint.number}` : 'No Sprint'),
        createdAt: t.created_at || t.createdAt,
        lastActivityAt: lastActive,
        isOverdue,
        isStalled
      }
    })

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
        totalTasks: rawTasks.length,
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
      tasks: mappedTasks,
      teamWorkload: memberWorkload,
      invites: invites.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        createdAt: inv.created_at
      })),
      recentActivity: recentLogs.map((l) => ({
        id: l.id,
        action: l.action,
        resource: l.resource,
        createdAt: l.created_at,
        metadata: l.metadata || {}
      }))
    })
  } catch (err) {
    console.error('API admin error:', err)
    return res.status(500).json({ error: sanitizeError(err, 'Failed to generate admin data') })
  }
}
