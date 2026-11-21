-- ==============================================================================
-- SPRINTOS / PAPER5 - WORKSPACE DELETION & LAST-OWNER COMPLIANCE FIX
-- Generated: 2026-11-21
-- Purpose:
--   1. Allow complete workspace purge without tripping "Compliance Error: Cannot
--      remove or demote the last owner of a workspace".
--   2. Invalidate all pending invites and invite links immediately when workspace is deleted.
--   3. Completely eradicate all workspace data (members, tasks, sprints, meetings, logs).
-- ==============================================================================

-- 1. DYNAMICALLY PATCH ANY EXISTING TRIGGER FUNCTION RAISING THE COMPLIANCE ERROR
DO $$
DECLARE
  f RECORD;
BEGIN
  FOR f IN (
    SELECT proname, pronamespace::regnamespace::text as schema_name
    FROM pg_proc
    WHERE prosrc ILIKE '%Cannot remove or demote the last owner%'
  ) LOOP
    RAISE NOTICE 'Patching compliance trigger function: %.%', f.schema_name, f.proname;
    EXECUTE format('
      CREATE OR REPLACE FUNCTION %I.%I()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $func$
      BEGIN
        -- If parent workspace does not exist or has already been deleted, skip compliance check
        IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = OLD.workspace_id) THEN
          RETURN OLD;
        END IF;

        -- Deletion check: cannot delete the last owner of an ACTIVE workspace
        IF (TG_OP = ''DELETE'' AND OLD.role = ''owner'') THEN
          IF NOT EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_id = OLD.workspace_id
              AND role = ''owner''
              AND user_id != OLD.user_id
          ) THEN
            -- Only raise if parent workspace still exists and is not being deleted
            IF EXISTS (SELECT 1 FROM public.workspaces WHERE id = OLD.workspace_id) THEN
              RAISE EXCEPTION ''Compliance Error: Cannot remove or demote the last owner of a workspace.'';
            END IF;
          END IF;
        END IF;

        -- Demotion check: cannot demote the last owner of an ACTIVE workspace
        IF (TG_OP = ''UPDATE'' AND OLD.role = ''owner'' AND NEW.role != ''owner'') THEN
          IF NOT EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_id = OLD.workspace_id
              AND role = ''owner''
              AND user_id != OLD.user_id
          ) THEN
            RAISE EXCEPTION ''Compliance Error: Cannot remove or demote the last owner of a workspace.'';
          END IF;
        END IF;

        RETURN OLD;
      END;
      $func$;
    ', f.schema_name, f.proname);
  END LOOP;
END $$;

-- 2. DEDICATED ATOMIC WORKSPACE PURGE RPC (EXECUTED WITH ELEVATED PRIVILEGES)
CREATE OR REPLACE FUNCTION public.delete_workspace_completely(target_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_uid UUID;
  ws_creator UUID;
  is_admin BOOLEAN;
BEGIN
  caller_uid := auth.uid();

  -- Verify caller is authenticated (or called via service role where auth.uid() is null)
  IF caller_uid IS NOT NULL THEN
    SELECT created_by INTO ws_creator FROM public.workspaces WHERE id = target_workspace_id;
    
    SELECT EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = target_workspace_id
        AND user_id = caller_uid
        AND role IN ('owner', 'admin')
    ) INTO is_admin;

    IF ws_creator != caller_uid AND NOT COALESCE(is_admin, false) THEN
      RAISE EXCEPTION 'Access denied: Only workspace owners and admins can permanently delete a workspace.';
    END IF;
  END IF;

  -- Step 1: Invalidate all pending invites immediately (invite links become dead)
  DELETE FROM public.invites WHERE workspace_id = target_workspace_id;
  DELETE FROM public.workspace_invites WHERE workspace_id = target_workspace_id;

  -- Step 2: Delete all operational data
  DELETE FROM public.deadlines WHERE workspace_id = target_workspace_id;
  DELETE FROM public.sprints WHERE workspace_id = target_workspace_id;
  DELETE FROM public.meetings WHERE workspace_id = target_workspace_id;
  DELETE FROM public.audit_logs WHERE workspace_id = target_workspace_id;
  DELETE FROM public.evidence WHERE workspace_id = target_workspace_id;
  DELETE FROM public.extra_work WHERE workspace_id = target_workspace_id;

  -- Step 3: Delete members (temporarily bypass trigger)
  ALTER TABLE public.workspace_members DISABLE TRIGGER ALL;
  DELETE FROM public.workspace_members WHERE workspace_id = target_workspace_id;
  ALTER TABLE public.workspace_members ENABLE TRIGGER ALL;

  -- Step 4: Delete the workspace row
  DELETE FROM public.workspaces WHERE id = target_workspace_id;

  RETURN jsonb_build_object(
    'success', true,
    'workspace_id', target_workspace_id,
    'message', 'Workspace and all associated data permanently eradicated.'
  );
EXCEPTION WHEN OTHERS THEN
  ALTER TABLE public.workspace_members ENABLE TRIGGER ALL;
  RAISE;
END;
$$;

-- Grant execution to authenticated users and service_role
GRANT EXECUTE ON FUNCTION public.delete_workspace_completely(UUID) TO authenticated, service_role;
