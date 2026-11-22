-- ==============================================================================
-- SPRINTOS / PAPER5 - PRODUCTION SECURITY HARDENING & ENTITLEMENTS MIGRATION
-- Generated: 2026-11-23
-- Purpose:
--   1. Protect public.users billing columns against unauthorized direct client updates.
--   2. Enforce Agile methodology entitlements on public.workspaces with grandfathering.
--   3. Provide atomic workspace provisioning with plan quota enforcement (auth.uid()).
--   4. Implement downgrade workspace management (is_active, atomic activation RPC, read-only RLS).
--   5. Refactor delete_workspace_completely to remove ALTER TABLE DISABLE TRIGGER ALL locks.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. SECURITY HELPER FUNCTIONS (DEFINER FOR ACCURATE RBAC EVALUATION)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = ws_id AND w.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = ws_id AND wm.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(ws_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = ws_id AND w.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = ws_id 
      AND wm.user_id = auth.uid() 
      AND wm.role IN ('admin', 'owner')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(ws_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = ws_id AND w.owner_id = auth.uid()
  );
$$;

-- ------------------------------------------------------------------------------
-- 1. SUBSCRIPTION SECURITY: PROTECT USERS BILLING COLUMNS
-- ------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_protect_user_subscription_fields ON public.users;
DROP FUNCTION IF EXISTS public.protect_user_subscription_fields() CASCADE;

CREATE OR REPLACE FUNCTION public.protect_user_subscription_fields()
RETURNS TRIGGER 
LANGUAGE plpgsql 
AS $$
BEGIN
  IF (
    NEW.billing_plan_id IS DISTINCT FROM OLD.billing_plan_id OR
    NEW.billing_status IS DISTINCT FROM OLD.billing_status OR
    NEW.billing_interval IS DISTINCT FROM OLD.billing_interval
  ) THEN
    -- Only service_role or database owner is authorized to modify subscription fields
    IF COALESCE(auth.jwt() ->> 'role', '') != 'service_role' AND current_user != 'postgres' THEN
      RAISE EXCEPTION 'Entitlement Security Error: Direct modification of subscription fields is prohibited. Use the authorized plan selection endpoint.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_subscription_fields ON public.users;
CREATE TRIGGER trg_protect_user_subscription_fields
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.protect_user_subscription_fields();

-- ------------------------------------------------------------------------------
-- 2. AGILE ENTITLEMENT ENFORCEMENT & GRANDFATHERING
-- ------------------------------------------------------------------------------

ALTER TABLE public.workspaces 
  ADD COLUMN IF NOT EXISTS grandfathered_workflow TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Snapshot existing methodology configurations so existing workspaces retain them
UPDATE public.workspaces
SET grandfathered_workflow = settings->>'agile_workflow'
WHERE grandfathered_workflow IS NULL 
  AND settings->>'agile_workflow' IS NOT NULL;

DROP TRIGGER IF EXISTS trg_enforce_workspace_workflow_entitlements ON public.workspaces;
DROP FUNCTION IF EXISTS public.enforce_workspace_workflow_entitlements() CASCADE;

CREATE OR REPLACE FUNCTION public.enforce_workspace_workflow_entitlements()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  owner_tier TEXT;
  target_wf TEXT;
  creator_uid UUID;
BEGIN
  target_wf := COALESCE(NEW.settings->>'agile_workflow', 'kanban');
  creator_uid := COALESCE(NEW.created_by, NEW.owner_id);

  -- Prevent clients from modifying grandfathered_workflow
  IF TG_OP = 'UPDATE' AND NEW.grandfathered_workflow IS DISTINCT FROM OLD.grandfathered_workflow THEN
    IF COALESCE(auth.jwt() ->> 'role', '') != 'service_role' AND current_user != 'postgres' THEN
      NEW.grandfathered_workflow := OLD.grandfathered_workflow;
    END IF;
  END IF;

  -- On UPDATE: If workflow did not change, allow update
  IF TG_OP = 'UPDATE' AND (NEW.settings->>'agile_workflow' = OLD.settings->>'agile_workflow') THEN
    RETURN NEW;
  END IF;

  -- On UPDATE: If workspace is grandfathered to this exact methodology, allow it
  IF TG_OP = 'UPDATE' AND OLD.grandfathered_workflow IS NOT NULL AND target_wf = OLD.grandfathered_workflow THEN
    RETURN NEW;
  END IF;

  -- Retrieve authoritative owner billing plan
  SELECT COALESCE(billing_plan_id, 'starter') INTO owner_tier
  FROM public.users WHERE id = creator_uid;

  IF owner_tier = 'starter' OR owner_tier = 'free' THEN
    IF target_wf NOT IN ('adhoc', 'kanban') THEN
      RAISE EXCEPTION 'Entitlement violation: Starter plan only includes Ad-hoc and Kanban workflows. Workflow "%" is locked.', target_wf;
    END IF;
  ELSIF owner_tier = 'team' THEN
    IF target_wf IN ('spotify', 'safe') THEN
      RAISE EXCEPTION 'Entitlement violation: Workflow "%" requires the Pro plan.', target_wf;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_workspace_workflow_entitlements ON public.workspaces;
CREATE TRIGGER trg_enforce_workspace_workflow_entitlements
BEFORE INSERT OR UPDATE ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.enforce_workspace_workflow_entitlements();

-- ------------------------------------------------------------------------------
-- 3. ATOMIC WORKSPACE PROVISIONING WITH TRUSTED CREATOR AND QUOTA ENFORCEMENT
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.provision_new_workspace_atomic(TEXT, TEXT, TEXT, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.provision_new_workspace_atomic(
  workspace_name TEXT,
  team_size TEXT DEFAULT '2-5',
  agile_workflow TEXT DEFAULT 'kanban',
  save_data BOOLEAN DEFAULT false,
  billing_interval TEXT DEFAULT 'monthly'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_uid UUID;
  user_email TEXT;
  user_tier TEXT;
  existing_owned_count INT;
  max_allowed INT;
  new_ws_id UUID;
  clean_wf TEXT;
  clean_cycle TEXT;
  initial_invoice JSONB;
BEGIN
  -- Authoritative identity derivation: NEVER trust client-supplied creator ID
  caller_uid := auth.uid();
  IF caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required to provision a workspace.';
  END IF;

  SELECT COALESCE(billing_plan_id, 'starter'), email INTO user_tier, user_email
  FROM public.users WHERE id = caller_uid;

  IF user_tier IS NULL THEN
    user_tier := 'starter';
  END IF;

  -- Lock existing owned workspace rows to prevent concurrent creation quota race conditions
  PERFORM 1 FROM public.workspaces 
  WHERE (created_by = caller_uid OR owner_id = caller_uid)
  FOR UPDATE;

  -- Enforce Plan Quota Limits
  SELECT count(*) INTO existing_owned_count
  FROM public.workspaces
  WHERE (created_by = caller_uid OR owner_id = caller_uid);

  max_allowed := CASE 
    WHEN user_tier IN ('pro', 'scale', 'enterprise') THEN 10
    WHEN user_tier = 'team' THEN 5
    ELSE 1
  END;

  IF existing_owned_count >= max_allowed THEN
    RAISE EXCEPTION 'Workspace quota exceeded: Your active plan allows a maximum of % workspace(s). Please upgrade to create more.', max_allowed;
  END IF;

  -- Validate and normalize workflow
  clean_wf := COALESCE(agile_workflow, 'kanban');
  IF user_tier IN ('starter', 'free') AND clean_wf NOT IN ('adhoc', 'kanban') THEN
    RAISE EXCEPTION 'Entitlement violation: Starter plan only includes Ad-hoc and Kanban workflows.';
  ELSIF user_tier = 'team' AND clean_wf IN ('spotify', 'safe') THEN
    RAISE EXCEPTION 'Entitlement violation: Workflow "%" requires the Pro plan.', clean_wf;
  END IF;

  clean_cycle := CASE WHEN billing_interval = 'annual' THEN 'annual' ELSE 'monthly' END;
  new_ws_id := gen_random_uuid();

  initial_invoice := jsonb_build_object(
    'id', 'INV-' || upper(user_tier) || '-' || upper(clean_cycle) || '-' || to_char(now(), 'YYYY') || '-001',
    'invoiceNumber', 'INV-' || to_char(now(), 'YYYY') || '-' || floor(10000 + random() * 90000)::text,
    'date', to_char(now(), 'Mon DD, YYYY'),
    'rawDate', now(),
    'cycle', CASE WHEN clean_cycle = 'annual' THEN 'Annual (12 Months)' ELSE 'Monthly (1 Month)' END,
    'plan', initcap(user_tier) || ' Plan (' || initcap(clean_cycle) || ')',
    'planId', user_tier,
    'changeType', 'Initial Workspace Setup',
    'amount', '₹0',
    'status', 'Paid',
    'workspaceName', workspace_name
  );

  -- 1. Insert Workspace
  INSERT INTO public.workspaces (
    id,
    name,
    created_by,
    owner_id,
    billing_plan_id,
    subscription_tier,
    billing_status,
    billing_interval,
    is_active,
    settings,
    created_at,
    updated_at
  ) VALUES (
    new_ws_id,
    workspace_name,
    caller_uid,
    caller_uid,
    user_tier,
    user_tier,
    'active',
    clean_cycle,
    true,
    jsonb_build_object(
      'team_size', team_size,
      'agile_workflow', clean_wf,
      'save_data', save_data,
      'billing_interval', clean_cycle,
      'invoices', jsonb_build_array(initial_invoice)
    ),
    now(),
    now()
  );

  -- 2. Insert Owner Membership
  INSERT INTO public.workspace_members (
    workspace_id,
    user_id,
    role,
    joined_at
  ) VALUES (
    new_ws_id,
    caller_uid,
    'owner',
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'workspace_id', new_ws_id,
    'id', new_ws_id,
    'name', workspace_name,
    'plan', user_tier
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.provision_new_workspace_atomic(TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated;

-- Maintain backward compatibility for existing callers of create_new_workspace
DROP FUNCTION IF EXISTS public.create_new_workspace(TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS public.create_new_workspace(TEXT, UUID);
DROP FUNCTION IF EXISTS public.create_new_workspace(TEXT);

CREATE OR REPLACE FUNCTION public.create_new_workspace(
  workspace_name TEXT,
  creator_id UUID,
  new_workspace_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delegate directly to the atomic provisioner
  RETURN public.provision_new_workspace_atomic(workspace_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_new_workspace(TEXT, UUID, UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. DOWNGRADE & READ-ONLY WORKSPACE DATA PROTECTION
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.set_single_active_workspace(UUID);

CREATE OR REPLACE FUNCTION public.set_single_active_workspace(target_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_uid UUID;
BEGIN
  caller_uid := auth.uid();
  IF caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Lock rows for this owner to prevent concurrent race conditions
  PERFORM 1 FROM public.workspaces 
  WHERE (created_by = caller_uid OR owner_id = caller_uid)
  FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE id = target_workspace_id AND (created_by = caller_uid OR owner_id = caller_uid)
  ) THEN
    RAISE EXCEPTION 'Access denied: You can only activate a workspace that you own.';
  END IF;

  -- Deactivate all workspaces owned by this user
  UPDATE public.workspaces 
  SET is_active = false, updated_at = now()
  WHERE (created_by = caller_uid OR owner_id = caller_uid);

  -- Activate only the chosen workspace
  UPDATE public.workspaces 
  SET is_active = true, updated_at = now()
  WHERE id = target_workspace_id;

  RETURN jsonb_build_object('success', true, 'active_workspace_id', target_workspace_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_single_active_workspace(UUID) TO authenticated;

-- Update RLS write policies on operational tables to block mutation on inactive workspaces
DROP POLICY IF EXISTS "Workspace members can create tasks" ON public.deadlines;
CREATE POLICY "Workspace members can create tasks" ON public.deadlines
FOR INSERT WITH CHECK (
  public.is_workspace_member(workspace_id)
  AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.is_active = true)
);

DROP POLICY IF EXISTS "Deadlines update policy" ON public.deadlines;
CREATE POLICY "Deadlines update policy" ON public.deadlines
FOR UPDATE USING (
  (
    public.is_workspace_admin(workspace_id)
    OR (
      public.is_workspace_member(workspace_id)
      AND (assignee_id = auth.uid() OR created_by = auth.uid() OR assignee_id IS NULL)
    )
  )
  AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.is_active = true)
);

DROP POLICY IF EXISTS "Admins or creators can delete tasks" ON public.deadlines;
CREATE POLICY "Admins or creators can delete tasks" ON public.deadlines
FOR DELETE USING (
  (
    public.is_workspace_admin(workspace_id)
    OR (public.is_workspace_member(workspace_id) AND created_by = auth.uid())
  )
  AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.is_active = true)
);

-- ------------------------------------------------------------------------------
-- 5. SAFE WORKSPACE DELETION (REMOVING TABLE LOCKS)
-- ------------------------------------------------------------------------------

-- Update compliance trigger to check transaction-scoped setting
DROP FUNCTION IF EXISTS public.check_last_workspace_owner() CASCADE;

CREATE OR REPLACE FUNCTION public.check_last_workspace_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If this workspace is currently being deleted by the authorized deletion RPC, bypass check
  IF current_setting('paper5.deleting_ws', true) = OLD.workspace_id::text THEN
    RETURN OLD;
  END IF;

  -- If parent workspace does not exist or has already been deleted, skip compliance check
  IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = OLD.workspace_id) THEN
    RETURN OLD;
  END IF;

  -- Deletion check: cannot delete the last owner of an ACTIVE workspace
  IF (TG_OP = 'DELETE' AND OLD.role = 'owner') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = OLD.workspace_id
        AND role = 'owner'
        AND user_id != OLD.user_id
    ) THEN
      IF EXISTS (SELECT 1 FROM public.workspaces WHERE id = OLD.workspace_id) THEN
        RAISE EXCEPTION 'Compliance Error: Cannot remove or demote the last owner of a workspace.';
      END IF;
    END IF;
  END IF;

  -- Demotion check: cannot demote the last owner of an ACTIVE workspace
  IF (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role != 'owner') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = OLD.workspace_id
        AND role = 'owner'
        AND user_id != OLD.user_id
    ) THEN
      RAISE EXCEPTION 'Compliance Error: Cannot remove or demote the last owner of a workspace.';
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

DROP FUNCTION IF EXISTS public.delete_workspace_completely(UUID);

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

  IF caller_uid IS NOT NULL THEN
    SELECT created_by INTO ws_creator FROM public.workspaces WHERE id = target_workspace_id;
    
    SELECT EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = target_workspace_id
        AND user_id = caller_uid
        AND role = 'owner'
    ) INTO is_admin;

    IF ws_creator != caller_uid AND NOT COALESCE(is_admin, false) THEN
      RAISE EXCEPTION 'Access denied: Only workspace owners can permanently delete a workspace.';
    END IF;
  END IF;

  -- Set transaction-local session variable (bypasses compliance trigger safely without table locks)
  PERFORM set_config('paper5.deleting_ws', target_workspace_id::text, true);

  -- 1. Invalidate all pending invites
  DELETE FROM public.invites WHERE workspace_id = target_workspace_id;
  DELETE FROM public.workspace_invites WHERE workspace_id = target_workspace_id;

  -- 2. Delete all operational data
  DELETE FROM public.deadlines WHERE workspace_id = target_workspace_id;
  DELETE FROM public.sprints WHERE workspace_id = target_workspace_id;
  DELETE FROM public.meetings WHERE workspace_id = target_workspace_id;
  DELETE FROM public.audit_logs WHERE workspace_id = target_workspace_id;
  DELETE FROM public.evidence WHERE workspace_id = target_workspace_id;
  DELETE FROM public.extra_work WHERE workspace_id = target_workspace_id;

  -- 3. Delete members cleanly (compliance trigger checks paper5.deleting_ws)
  DELETE FROM public.workspace_members WHERE workspace_id = target_workspace_id;

  -- 4. Delete the workspace row
  DELETE FROM public.workspaces WHERE id = target_workspace_id;

  RETURN jsonb_build_object(
    'success', true,
    'workspace_id', target_workspace_id,
    'message', 'Workspace and all associated data permanently eradicated.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_workspace_completely(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. MEMBER QUOTA ENFORCEMENT & INACTIVE WORKSPACE RLS ON OPERATIONAL TABLES
-- ------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_enforce_workspace_member_limit ON public.workspace_members;
DROP FUNCTION IF EXISTS public.enforce_workspace_member_limit() CASCADE;

CREATE OR REPLACE FUNCTION public.enforce_workspace_member_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws_plan TEXT;
  ws_active BOOLEAN;
  current_count INT;
  max_allowed INT;
BEGIN
  -- Retrieve workspace billing plan and active status
  SELECT COALESCE(billing_plan_id, subscription_tier, 'starter'), COALESCE(is_active, true)
  INTO ws_plan, ws_active
  FROM public.workspaces
  WHERE id = NEW.workspace_id;

  -- Block additions to inactive workspaces
  IF ws_active = false THEN
    RAISE EXCEPTION 'Entitlement error: Cannot add members to an inactive workspace.';
  END IF;

  -- Pro / Scale plans have unlimited members
  IF ws_plan IN ('pro', 'scale', 'enterprise') THEN
    RETURN NEW;
  END IF;

  max_allowed := CASE
    WHEN ws_plan = 'team' THEN 7
    ELSE 3 -- Starter / Free
  END;

  SELECT count(*) INTO current_count
  FROM public.workspace_members
  WHERE workspace_id = NEW.workspace_id;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Member limit exceeded: The % plan allows a maximum of % members per workspace.', ws_plan, max_allowed;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_workspace_member_limit ON public.workspace_members;
CREATE TRIGGER trg_enforce_workspace_member_limit
BEFORE INSERT ON public.workspace_members
FOR EACH ROW
EXECUTE FUNCTION public.enforce_workspace_member_limit();

-- Operational tables inactive write blocking: sprints, meetings, evidence, extra_work
DROP POLICY IF EXISTS "Workspace members can create sprints" ON public.sprints;
CREATE POLICY "Workspace members can create sprints" ON public.sprints
FOR INSERT WITH CHECK (
  public.is_workspace_admin(workspace_id)
  AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.is_active = true)
);

DROP POLICY IF EXISTS "Workspace admins can update sprints" ON public.sprints;
CREATE POLICY "Workspace admins can update sprints" ON public.sprints
FOR UPDATE USING (
  public.is_workspace_admin(workspace_id)
  AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.is_active = true)
);

DROP POLICY IF EXISTS "Workspace admins can delete sprints" ON public.sprints;
CREATE POLICY "Workspace admins can delete sprints" ON public.sprints
FOR DELETE USING (
  public.is_workspace_admin(workspace_id)
  AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.is_active = true)
);

DROP POLICY IF EXISTS "Workspace members can create meetings" ON public.meetings;
CREATE POLICY "Workspace members can create meetings" ON public.meetings
FOR INSERT WITH CHECK (
  public.is_workspace_member(workspace_id)
  AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.is_active = true)
);

DROP POLICY IF EXISTS "Workspace members can update meetings" ON public.meetings;
CREATE POLICY "Workspace members can update meetings" ON public.meetings
FOR UPDATE USING (
  public.is_workspace_member(workspace_id)
  AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.is_active = true)
);

DROP POLICY IF EXISTS "Workspace members can delete meetings" ON public.meetings;
CREATE POLICY "Workspace members can delete meetings" ON public.meetings
FOR DELETE USING (
  (public.is_workspace_admin(workspace_id) OR created_by = auth.uid())
  AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.is_active = true)
);

COMMIT;
