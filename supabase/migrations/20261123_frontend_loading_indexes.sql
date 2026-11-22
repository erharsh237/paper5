-- ==============================================================================
-- PAPER5: FRONTEND LOADING PERFORMANCE & RLS QUERY INDEXES
-- ==============================================================================
-- Eliminates sequential table scans during RLS evaluation and dashboard aggregations.

-- 1. Workspace Memberships: Accelerates RLS is_workspace_member and membership queries
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_ws 
  ON public.workspace_members(user_id, workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_members_ws_role 
  ON public.workspace_members(workspace_id, role);

-- 2. Workspaces: Accelerates owner lookup and quota checks
CREATE INDEX IF NOT EXISTS idx_workspaces_created_by 
  ON public.workspaces(created_by);

-- 3. Invites: Accelerates pending invites count and auto-acceptance
CREATE INDEX IF NOT EXISTS idx_invites_ws_email 
  ON public.invites(workspace_id, email);

-- 4. Tasks/Deadlines: Accelerates executive overview task aggregation and sorting
CREATE INDEX IF NOT EXISTS idx_deadlines_ws_due 
  ON public.deadlines(workspace_id, due_date);

CREATE INDEX IF NOT EXISTS idx_deadlines_ws_status 
  ON public.deadlines(workspace_id, status);

-- 5. Sprints: Accelerates active sprint queries
CREATE INDEX IF NOT EXISTS idx_sprints_ws_created 
  ON public.sprints(workspace_id, created_at DESC);

-- 6. Audit Logs: Accelerates recent activity queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_ws_created 
  ON public.audit_logs(workspace_id, created_at DESC);

-- 7. Users: Accelerates user profile lookups by email
CREATE INDEX IF NOT EXISTS idx_users_email_lower 
  ON public.users(lower(email));
