/**
 * Serverless API Authentication & Role-Based Access Control (RBAC) Helper
 * Validates Supabase JWT session tokens and enforces workspace tenant boundaries.
 */

function parseCookies(cookieHeader = '') {
  if (!cookieHeader || typeof cookieHeader !== 'string') return {}
  return Object.fromEntries(
    cookieHeader.split(';').flatMap((pair) => {
      const eqIdx = pair.indexOf('=')
      if (eqIdx === -1) return []
      const key = pair.slice(0, eqIdx).trim()
      const val = pair.slice(eqIdx + 1).trim()
      return key ? [[key, val]] : []
    })
  )
}

/**
 * Extracts and verifies the caller's Supabase auth session.
 * Accepts Authorization Bearer header or sb_access_token httpOnly cookie.
 */
export async function authenticateUser(req, supabaseAdmin) {
  // CSRF Defense: Block cross-site state-mutating requests
  const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH']
  if (mutatingMethods.includes(req.method?.toUpperCase())) {
    const secFetchSite = req.headers?.['sec-fetch-site']
    if (secFetchSite === 'cross-site') {
      return { error: 'Cross-site request blocked by security policy.', status: 403 }
    }
  }

  let token = null

  const authHeader = req.headers?.authorization || req.headers?.Authorization || ''
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim()
  }

  if (!token) {
    const cookies = parseCookies(req.headers?.cookie)
    token = cookies['sb_access_token'] || null
  }

  if (!token) {
    return { error: 'Authentication required. Missing session token.', status: 401 }
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !data?.user) {
      return { error: 'Invalid or expired authentication session.', status: 401 }
    }
    return { user: data.user, token }
  } catch (err) {
    return { error: 'Authentication verification failed.', status: 401 }
  }
}

/**
 * Validates that the caller is an active member of the requested workspace,
 * and optionally verifies they have admin/owner privileges.
 * 
 * Enforces strict multi-tenant isolation: users cannot view or manipulate
 * data outside their assigned workspaces.
 */
export async function verifyWorkspaceAccess(req, supabaseAdmin, workspaceId, { requireAdmin = false } = {}) {
  const authRes = await authenticateUser(req, supabaseAdmin)
  if (authRes.error) return authRes

  const { user } = authRes

  if (!workspaceId) {
    return { error: 'Missing required workspaceId parameter.', status: 400 }
  }

  try {
    // 1. Check workspace existence and ownership
    const { data: wsRecord, error: wsErr } = await supabaseAdmin
      .from('workspaces')
      .select('id, created_by, settings')
      .eq('id', workspaceId)
      .maybeSingle()

    if (wsErr || !wsRecord) {
      return { error: 'Workspace not found.', status: 404 }
    }

    const isDirectOwner = (wsRecord.created_by || wsRecord.owner_id) === user.id

    // 2. Check membership record
    const { data: memberRecord } = await supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle()

    const isMember = isDirectOwner || Boolean(memberRecord)
    if (!isMember) {
      return { 
        error: 'Access denied: You are not a member of this workspace.', 
        status: 403 
      }
    }

    const role = isDirectOwner ? 'owner' : (memberRecord?.role || 'member')
    const isOwner = isDirectOwner || role === 'owner'
    const isAdmin = isOwner || role === 'admin'

    if (requireAdmin && !isAdmin) {
      return { 
        error: 'Access denied: Workspace administrator privileges are required for this action.', 
        status: 403 
      }
    }

    const memberPermissions = wsRecord.settings?.member_permissions?.[user.id] || []

    return {
      user,
      workspaceId,
      role,
      isAdmin,
      isOwner,
      permissions: memberPermissions
    }
  } catch (err) {
    return { error: 'Failed to verify workspace permissions.', status: 500 }
  }
}
