/**
 * Centralized API Error Sanitizer
 * Strips database internals, stack traces, and sensitive schema details
 * from responses sent to users and clients.
 */

export function sanitizeError(err, fallback = 'An unexpected error occurred. Please try again.') {
  if (!err) return fallback

  const raw = typeof err === 'string' ? err : err.message || ''

  // Suppress sensitive PostgreSQL / Supabase internal messages
  const isInternal = [
    'relation',
    'column',
    'syntax error',
    'violates foreign key',
    'violates unique constraint',
    'duplicate key',
    'pg_',
    'PostgresError',
    'permission denied',
    'JWT',
    'token',
    'database',
    'connection'
  ].some(k => raw.toLowerCase().includes(k.toLowerCase()))

  if (isInternal) {
    return 'The requested operation could not be completed. Please verify your input and try again.'
  }

  // Keep message brief and clean
  return raw.length > 200 ? fallback : (raw || fallback)
}
