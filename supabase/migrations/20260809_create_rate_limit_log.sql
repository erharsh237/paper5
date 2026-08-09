-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Create rate_limit_log table for server-side sliding-window rate
-- limiting across all Supabase Edge Functions.
--
-- Run this in your Supabase Dashboard → SQL Editor, or via Supabase CLI:
--   supabase db push
-- ─────────────────────────────────────────────────────────────────────────────

-- Main rate limiting log table
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id         BIGSERIAL    PRIMARY KEY,
  identifier TEXT         NOT NULL,   -- Caller key: user_id (auth'd) or IP (public)
  action     TEXT         NOT NULL,   -- Action label: 'invite_create', 'contact_form', etc.
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Composite index for fast sliding-window queries
-- (SELECT ... WHERE identifier = $1 AND action = $2 AND created_at >= $3)
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_ident_action_time
  ON rate_limit_log (identifier, action, created_at);

-- Enable Row Level Security on the table
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;

-- No RLS policies are created intentionally:
--   - The service role key (used inside Edge Functions) bypasses RLS.
--   - The anon key (used by the browser client) has no policies → zero access.
--   - Direct SQL access via the Dashboard uses postgres role → bypasses RLS.
-- Result: End users cannot read or write this table at all.

-- Optional: auto-clean rows older than 24h via pg_cron (if extension is enabled)
-- This keeps the table from growing indefinitely in production.
-- Run in SQL Editor ONLY if pg_cron is enabled on your Supabase project:
--
-- SELECT cron.schedule(
--   'rate-limit-cleanup',        -- job name
--   '0 * * * *',                 -- every hour
--   $$DELETE FROM rate_limit_log WHERE created_at < NOW() - INTERVAL '24 hours'$$
-- );
