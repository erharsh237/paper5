-- ==============================================================================
-- SPRINTOS / PAPER5 - PRODUCTION OWNER CONSOLE & CONTROL PLANE MIGRATION
-- Migration: 20261124_owner_console_schema.sql
-- Purpose:
--   1. Create platform administrative roles and permissions table (public.platform_admins).
--   2. Establish an immutable, append-only administrative audit log (public.platform_audit_logs).
--   3. Implement feature flags with rollout percentage and tier gating (public.feature_flags).
--   4. Implement platform-wide targeted announcements & banners (public.platform_announcements).
--   5. Create unified support tickets & feedback triage table (public.support_tickets).
--   6. Create manual entitlement overrides table to separate billing from payments (public.user_entitlement_overrides).
--   7. Implement secure security-definer helper functions and Row-Level Security (RLS).
--   8. Implement a secure, controlled, one-time owner bootstrap function.
--   9. Add administrative tables to the Supabase Realtime publication.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. PLATFORM ADMINS TABLE (Role-Based Access Control)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'super_admin' CHECK (role IN ('owner', 'super_admin')),
  permissions JSONB NOT NULL DEFAULT '["*"]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  bootstrap_initial BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_platform_admins_user_id UNIQUE (user_id),
  CONSTRAINT uq_platform_admins_email UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_platform_admins_user_id ON public.platform_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_admins_email ON public.platform_admins(lower(email));
CREATE INDEX IF NOT EXISTS idx_platform_admins_active_role ON public.platform_admins(is_active, role);

-- ------------------------------------------------------------------------------
-- 2. IMMUTABLE PLATFORM AUDIT LOGS TABLE
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.platform_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  admin_email TEXT NOT NULL,
  admin_role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_admin ON public.platform_audit_logs(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_action ON public.platform_audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_target ON public.platform_audit_logs(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_created_at ON public.platform_audit_logs(created_at DESC);

-- Ensure platform_audit_logs is strictly append-only (No UPDATE, No DELETE, No TRUNCATE)
CREATE OR REPLACE FUNCTION public.prevent_platform_audit_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Security Policy Violation: platform_audit_logs is an immutable ledger. Updates, deletions, and table truncations are strictly forbidden.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_platform_audit_tampering_row ON public.platform_audit_logs;
CREATE TRIGGER trg_prevent_platform_audit_tampering_row
BEFORE UPDATE OR DELETE ON public.platform_audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_platform_audit_tampering();

DROP TRIGGER IF EXISTS trg_prevent_platform_audit_tampering_stmt ON public.platform_audit_logs;
CREATE TRIGGER trg_prevent_platform_audit_tampering_stmt
BEFORE TRUNCATE ON public.platform_audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_platform_audit_tampering();

-- ------------------------------------------------------------------------------
-- 3. FEATURE FLAGS TABLE
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  tier_restrictions TEXT[] NOT NULL DEFAULT '{}',
  rollout_percentage INT NOT NULL DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed baseline platform feature flags if not existing
INSERT INTO public.feature_flags (key, name, description, enabled, tier_restrictions, rollout_percentage)
VALUES
  ('maintenance_mode', 'Platform Maintenance Mode', 'Temporarily sets platform into read-only maintenance window for non-admins', false, '{}', 100),
  ('advanced_sprints', 'Agile & Advanced Sprints', 'Enables multi-sprint management, burndown charts and agile reports', true, '{"team", "pro"}', 100),
  ('realtime_collaboration', 'Real-time Presence & Sync', 'Live user presence indicators and instant task updates', true, '{}', 100),
  ('ai_copilot', 'Paper5 AI Sprint Assistant', 'Generative AI sprint planning and task breakdown suggestions', false, '{"pro"}', 50)
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. PLATFORM ANNOUNCEMENTS TABLE
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.platform_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'maintenance', 'critical', 'changelog')),
  target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'starter', 'team', 'pro', 'admins')),
  dismissible BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_announcements_active 
ON public.platform_announcements(is_active, starts_at, expires_at);

-- ------------------------------------------------------------------------------
-- 5. SUPPORT TICKETS & FEEDBACK TRIAGE TABLE
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General Inquiry',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_notes TEXT,
  source TEXT NOT NULL DEFAULT 'feedback_modal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_email ON public.support_tickets(lower(email));
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);

-- ------------------------------------------------------------------------------
-- 6. USER ENTITLEMENT OVERRIDES (Separating manual grants from Razorpay transactions)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_entitlement_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  override_plan TEXT NOT NULL CHECK (override_plan IN ('starter', 'team', 'pro')),
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  granted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_active_user_entitlement_override 
ON public.user_entitlement_overrides(user_id) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_entitlement_overrides_lookup 
ON public.user_entitlement_overrides(user_id, is_active);

-- ------------------------------------------------------------------------------
-- 7. SECURITY HELPER FUNCTIONS (DEFINER FOR ACCURATE RBAC EVALUATION)
-- ------------------------------------------------------------------------------

-- Check if current authenticated user is an active platform admin (owner or super_admin)
CREATE OR REPLACE FUNCTION public.is_platform_admin(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins pa
    WHERE pa.user_id = uid AND pa.is_active = true
  );
$$;

-- Check if current authenticated user is the platform OWNER
CREATE OR REPLACE FUNCTION public.is_platform_owner(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins pa
    WHERE pa.user_id = uid AND pa.role = 'owner' AND pa.is_active = true
  );
$$;

-- ------------------------------------------------------------------------------
-- 8. SECURE, ONE-TIME PLATFORM OWNER BOOTSTRAP MECHANISM
-- ------------------------------------------------------------------------------
-- Enforces:
--   1. Can ONLY be invoked if NO active platform owner currently exists.
--   2. Target email must correspond to a verified, confirmed user in auth.users.
--   3. Can ONLY be executed by database superuser (postgres) or service_role.
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bootstrap_platform_owner(target_email TEXT, initial_notes TEXT DEFAULT 'Initial Platform Owner Bootstrap')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role TEXT;
  v_existing_owner_count INT;
  v_target_user RECORD;
  v_new_admin RECORD;
BEGIN
  -- Strict caller verification: only service_role or database superuser
  v_caller_role := COALESCE(auth.jwt() ->> 'role', current_user);
  IF v_caller_role != 'service_role' AND current_user != 'postgres' THEN
    RAISE EXCEPTION 'Access Denied: bootstrap_platform_owner can only be executed via authorized service role or database administrator.';
  END IF;

  -- Verify no active platform owner currently exists
  SELECT count(*) INTO v_existing_owner_count
  FROM public.platform_admins
  WHERE role = 'owner' AND is_active = true;

  IF v_existing_owner_count > 0 THEN
    RAISE EXCEPTION 'Platform Owner Bootstrap Aborted: An active platform owner already exists. Additional administrators must be appointed by the existing owner.';
  END IF;

  -- Locate target user in auth.users and ensure email is confirmed
  SELECT id, email, email_confirmed_at INTO v_target_user
  FROM auth.users
  WHERE lower(email) = lower(trim(target_email));

  IF v_target_user.id IS NULL THEN
    RAISE EXCEPTION 'Bootstrap Error: No user account found with email "%"', target_email;
  END IF;

  IF v_target_user.email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Bootstrap Security Error: Account with email "%" has not confirmed their email address.', target_email;
  END IF;

  -- Insert or promote to platform owner
  INSERT INTO public.platform_admins (
    user_id,
    email,
    role,
    permissions,
    is_active,
    bootstrap_initial,
    notes,
    created_at,
    updated_at
  ) VALUES (
    v_target_user.id,
    lower(trim(target_email)),
    'owner',
    '["*"]'::jsonb,
    true,
    true,
    initial_notes,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    role = 'owner',
    permissions = '["*"]'::jsonb,
    is_active = true,
    notes = EXCLUDED.notes,
    updated_at = now()
  RETURNING * INTO v_new_admin;

  -- Record this foundational security event in platform_audit_logs
  INSERT INTO public.platform_audit_logs (
    admin_id,
    admin_email,
    admin_role,
    action,
    target_type,
    target_id,
    details
  ) VALUES (
    v_target_user.id,
    v_target_user.email,
    'owner',
    'admin.bootstrap_owner',
    'platform_admin',
    v_new_admin.id::text,
    jsonb_build_object(
      'target_email', target_email,
      'bootstrap_initial', true,
      'timestamp', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Platform owner successfully bootstrapped',
    'admin_id', v_new_admin.id,
    'user_id', v_new_admin.user_id,
    'email', v_new_admin.email,
    'role', v_new_admin.role
  );
END;
$$;

-- Restrict execution: Revoke from public, grant to service_role and postgres only
REVOKE ALL ON FUNCTION public.bootstrap_platform_owner(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_platform_owner(TEXT, TEXT) TO service_role, postgres;

-- ------------------------------------------------------------------------------
-- 9. ROW-LEVEL SECURITY (RLS) POLICIES ON ADMINISTRATIVE OBJECTS
-- ------------------------------------------------------------------------------

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_entitlement_overrides ENABLE ROW LEVEL SECURITY;

-- 9.1. PLATFORM ADMINS POLICIES
DROP POLICY IF EXISTS "Active platform admins can view platform admin roster" ON public.platform_admins;
CREATE POLICY "Active platform admins can view platform admin roster"
ON public.platform_admins
FOR SELECT
USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Only platform owner can insert or update platform admins" ON public.platform_admins;
CREATE POLICY "Only platform owner can insert or update platform admins"
ON public.platform_admins
FOR ALL
USING (public.is_platform_owner(auth.uid()))
WITH CHECK (public.is_platform_owner(auth.uid()));

-- 9.2. PLATFORM AUDIT LOGS POLICIES
DROP POLICY IF EXISTS "Active platform admins can inspect audit logs" ON public.platform_audit_logs;
CREATE POLICY "Active platform admins can inspect audit logs"
ON public.platform_audit_logs
FOR SELECT
USING (public.is_platform_admin(auth.uid()));

-- 9.3. FEATURE FLAGS POLICIES
DROP POLICY IF EXISTS "Anyone can view enabled feature flags" ON public.feature_flags;
CREATE POLICY "Anyone can view enabled feature flags"
ON public.feature_flags
FOR SELECT
USING (enabled = true OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Only platform admins can modify feature flags" ON public.feature_flags;
CREATE POLICY "Only platform admins can modify feature flags"
ON public.feature_flags
FOR ALL
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- 9.4. PLATFORM ANNOUNCEMENTS POLICIES
DROP POLICY IF EXISTS "Anyone can view active announcements" ON public.platform_announcements;
CREATE POLICY "Anyone can view active announcements"
ON public.platform_announcements
FOR SELECT
USING (
  (is_active = true AND starts_at <= now() AND (expires_at IS NULL OR expires_at > now()))
  OR public.is_platform_admin(auth.uid())
);

DROP POLICY IF EXISTS "Only platform admins can manage announcements" ON public.platform_announcements;
CREATE POLICY "Only platform admins can manage announcements"
ON public.platform_announcements
FOR ALL
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- 9.5. SUPPORT TICKETS POLICIES
DROP POLICY IF EXISTS "Users can view their own support tickets" ON public.support_tickets;
CREATE POLICY "Users can view their own support tickets"
ON public.support_tickets
FOR SELECT
USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone can submit support tickets" ON public.support_tickets;
CREATE POLICY "Anyone can submit support tickets"
ON public.support_tickets
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Only platform admins can update support tickets" ON public.support_tickets;
CREATE POLICY "Only platform admins can update support tickets"
ON public.support_tickets
FOR UPDATE
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- 9.6. USER ENTITLEMENT OVERRIDES POLICIES
DROP POLICY IF EXISTS "Platform admins can view all entitlement overrides" ON public.user_entitlement_overrides;
CREATE POLICY "Platform admins can view all entitlement overrides"
ON public.user_entitlement_overrides
FOR SELECT
USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Only platform admins can manage entitlement overrides" ON public.user_entitlement_overrides;
CREATE POLICY "Only platform admins can manage entitlement overrides"
ON public.user_entitlement_overrides
FOR ALL
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- ------------------------------------------------------------------------------
-- 10. REALTIME REPLICATION CONFIGURATION
-- ------------------------------------------------------------------------------
-- Safe addition to supabase_realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_audit_logs;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.feature_flags;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_announcements;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Table already present in publication, ignore
    NULL;
END;
$$;

COMMIT;
