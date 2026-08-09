import { useState, useRef, useCallback } from 'react'

/**
 * useSubmitRateLimit — Client-side submission throttle hook.
 *
 * Provides a cooldown lockout after each form submission to prevent
 * accidental double-submits and slow down automated bot abuse.
 *
 * ⚠️ SECURITY NOTE: This is a UX-layer control only. It runs in the
 * browser and can be bypassed by a determined attacker with DevTools.
 * Real abuse prevention requires server-side rate limiting — e.g.
 * Cloudflare Rate Limiting Rules or Supabase Edge Function throttling.
 *
 * @param {number} cooldownSeconds - Lockout duration after each submit (default: 30s)
 * @param {number} maxAttempts - Max submissions per session before hard lock (default: 5)
 */
export function useSubmitRateLimit(cooldownSeconds = 30, maxAttempts = 5) {
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const [attemptCount, setAttemptCount] = useState(0)
  const timerRef = useRef(null)

  const isLockedOut = cooldownRemaining > 0
  const isHardLocked = attemptCount >= maxAttempts

  const startCooldown = useCallback(() => {
    setAttemptCount((prev) => prev + 1)

    let remaining = cooldownSeconds
    setCooldownRemaining(remaining)

    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      remaining -= 1
      setCooldownRemaining(remaining)
      if (remaining <= 0) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }, 1000)
  }, [cooldownSeconds])

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setCooldownRemaining(0)
    setAttemptCount(0)
  }, [])

  return {
    isLockedOut,
    isHardLocked,
    cooldownRemaining,
    attemptCount,
    startCooldown,
    reset,
  }
}
