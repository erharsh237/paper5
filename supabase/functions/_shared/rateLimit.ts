/**
 * Supabase Edge Function — Shared Rate Limiting Module
 * ─────────────────────────────────────────────────────
 * File: supabase/functions/_shared/rateLimit.ts
 *
 * How it works:
 *   1. Uses a Postgres table `rate_limit_log` (see schema below) as the
 *      sliding-window counter. Each record is one attempt keyed by
 *      (identifier, action).
 *   2. On every call, expired records (older than the window) are pruned,
 *      then remaining count is checked against the limit.
 *   3. If under limit, a new record is inserted and the call proceeds.
 *   4. If over limit, a 429 Too Many Requests response is returned.
 *
 * This runs INSIDE Supabase Edge Functions (Deno runtime), so it cannot
 * be bypassed by a client — unlike the client-side cooldown hook.
 *
 * ─── Required Postgres Schema ──────────────────────────────────────────
 *
 *   CREATE TABLE rate_limit_log (
 *     id         BIGSERIAL PRIMARY KEY,
 *     identifier TEXT        NOT NULL,   -- IP address or user ID
 *     action     TEXT        NOT NULL,   -- e.g. 'contact_form', 'invite_create'
 *     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 *
 *   -- Composite index for fast sliding window queries
 *   CREATE INDEX idx_rate_limit_log_ident_action_time
 *     ON rate_limit_log (identifier, action, created_at);
 *
 *   -- RLS: Only the service role key can read/write this table.
 *   ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;
 *   -- No policies needed — the Edge Function uses the service role key,
 *   -- which bypasses RLS. The table is not accessible to anon users.
 *
 * ─── Usage in an Edge Function ─────────────────────────────────────────
 *
 *   import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts'
 *
 *   const identifier = req.headers.get('x-forwarded-for') ?? 'unknown'
 *   const limited = await checkRateLimit(adminClient, identifier, 'invite_create', {
 *     maxRequests: 5,
 *     windowSeconds: 60,
 *   })
 *   if (limited) return rateLimitResponse()
 *
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

export interface RateLimitOptions {
  /** Maximum number of requests allowed within the window. */
  maxRequests: number
  /** Rolling window size in seconds. */
  windowSeconds: number
}

/**
 * Checks and records a rate-limited action against the Postgres sliding window.
 *
 * @param adminClient  Supabase client initialized with the SERVICE ROLE key.
 * @param identifier   Unique key for the caller — use IP address for public
 *                     endpoints, or `user.id` for authenticated endpoints.
 * @param action       A string label for the action being limited,
 *                     e.g. 'contact_form', 'invite_create', 'feedback_submit'.
 * @param options      maxRequests and windowSeconds for the sliding window.
 * @returns            true if the caller has exceeded the limit (block them),
 *                     false if the request is within limits (allow them).
 */
export async function checkRateLimit(
  adminClient: SupabaseClient,
  identifier: string,
  action: string,
  options: RateLimitOptions,
): Promise<boolean> {
  const { maxRequests, windowSeconds } = options
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString()

  // 1. Delete expired records for this identifier+action (keep table lean)
  await adminClient
    .from('rate_limit_log')
    .delete()
    .eq('identifier', identifier)
    .eq('action', action)
    .lt('created_at', windowStart)

  // 2. Count remaining attempts within the current window
  const { count, error: countError } = await adminClient
    .from('rate_limit_log')
    .select('*', { count: 'exact', head: true })
    .eq('identifier', identifier)
    .eq('action', action)
    .gte('created_at', windowStart)

  if (countError) {
    // If we can't read the count, fail open (allow the request) rather than
    // blocking all users on a DB error. Log it for monitoring.
    console.error('[RateLimit] Count query failed:', countError.message)
    return false
  }

  // 3. Block if limit exceeded
  if ((count ?? 0) >= maxRequests) {
    return true // caller is rate-limited
  }

  // 4. Record this attempt
  const { error: insertError } = await adminClient
    .from('rate_limit_log')
    .insert({ identifier, action })

  if (insertError) {
    console.error('[RateLimit] Insert failed:', insertError.message)
    // Non-fatal: still allow the request
  }

  return false // within limits
}

/**
 * Returns a standard 429 Too Many Requests response with Retry-After header.
 *
 * @param retryAfterSeconds  How long the client should wait before retrying.
 *                           Defaults to 60 seconds.
 */
export function rateLimitResponse(retryAfterSeconds = 60): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests. Please wait before trying again.',
      retryAfter: retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
        'Access-Control-Allow-Origin': '*',
      },
    },
  )
}
