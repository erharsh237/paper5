/**
 * URL Parameter Encryption / Obfuscation Module for SprintOS
 * Encrypts sensitive or visible URL parameters like ?p=enc_... instead of raw text.
 */

// Mapping of plan IDs to encrypted tokens
const PLAN_TOKENS = {
  starter: 'enc_s7a91b',
  free: 'enc_s7a91b',
  team: 'enc_t3c84f',
  scale: 'enc_x9d20e'
}

const TOKEN_TO_PLAN = {
  'enc_s7a91b': 'starter',
  'enc_t3c84f': 'team',
  'enc_x9d20e': 'scale',

  // Also support base64url encoded tokens
  'c3RhcnRlcg': 'starter',
  'dGVhbQ': 'team',
  'c2NhbGU': 'scale'
}

/**
 * Encrypts a plan name to an encrypted URL parameter token.
 * Example: 'team' -> 'enc_t3c84f'
 */
export function encryptPlanParam(planId) {
  if (!planId) return ''
  const clean = String(planId).toLowerCase().trim()
  return PLAN_TOKENS[clean] || btoa(clean).replace(/=/g, '')
}

/**
 * Decrypts an encrypted URL parameter token back to normalized plan string.
 * Returns null if token is invalid or tampered.
 */
export function decryptPlanParam(tokenOrPlan) {
  if (!tokenOrPlan) return null
  const clean = String(tokenOrPlan).trim()

  // Check known encrypted token mapping
  if (TOKEN_TO_PLAN[clean]) {
    return TOKEN_TO_PLAN[clean]
  }

  // Try base64 decoding
  try {
    const decoded = atob(clean).toLowerCase()
    if (['starter', 'free', 'team', 'scale'].includes(decoded)) {
      return decoded === 'free' ? 'starter' : decoded
    }
  } catch (err) {
    // Silent catch
  }

  // Support legacy plain text parameter if valid
  const lower = clean.toLowerCase()
  if (['starter', 'free', 'team', 'scale'].includes(lower)) {
    return lower === 'free' ? 'starter' : lower
  }

  return null
}
