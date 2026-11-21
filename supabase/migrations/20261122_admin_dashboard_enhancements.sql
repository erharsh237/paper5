-- ==============================================================================
-- SPRINTOS / PAPER5 - ADMIN DASHBOARD & RBAC ENHANCEMENTS
-- Generated: 2026-11-22
-- Purpose:
--   1. Upgrade sprints to support full project management (name, owner, priority, member_ids, archived).
--   2. Add task activity tracking and parent task dependencies to deadlines.
--   3. Create high-performance indexing for workspace-level admin overview queries.
--   4. Enable optimized audit log index for live workspace activity streams.
-- ==============================================================================

-- 1. Upgrade Sprints table to support full Project Management
ALTER TABLE public.sprints 
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS member_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Index for high-performance project filtering
CREATE INDEX IF NOT EXISTS idx_sprints_ws_status ON public.sprints(workspace_id, status, archived);

-- 2. Upgrade Deadlines (Tasks) for Inactivity Tracking & Dependencies
ALTER TABLE public.deadlines
  ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.deadlines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_deadlines_ws_assignee ON public.deadlines(workspace_id, assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_deadlines_due_date ON public.deadlines(workspace_id, due_date, status);

-- 3. Inactivity Trigger: Auto-update last_activity_at on task mutations
CREATE OR REPLACE FUNCTION update_task_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_activity ON public.deadlines;
CREATE TRIGGER trg_task_activity
BEFORE UPDATE ON public.deadlines
FOR EACH ROW EXECUTE FUNCTION update_task_last_activity();

-- 4. Enable Audit Log Queries for Workspace Admins
CREATE INDEX IF NOT EXISTS idx_audit_logs_ws_created ON public.audit_logs(workspace_id, created_at DESC);
