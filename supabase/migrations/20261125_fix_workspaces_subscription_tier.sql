-- Fix missing columns referenced by provision_new_workspace_atomic & enforce_workspace_member_limit
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT,
  ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.workspaces
SET subscription_tier = COALESCE(subscription_tier, billing_plan_id, 'starter')
WHERE subscription_tier IS NULL;
