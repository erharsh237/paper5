const ALLOWED_EXACT_ORIGINS = new Set([
  'https://paper5.co',
  'https://app.paper5.co',
  'https://paper5.com',
  'https://app.paper5.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
])

function isAllowedOrigin(origin?: string | null): boolean {
  if (!origin) return false
  if (ALLOWED_EXACT_ORIGINS.has(origin)) return true
  
  // Safe localhost/loopback check with port
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true
  
  // Trusted Paper5 and Vercel preview environments
  if (/^https:\/\/[a-z0-9-]+\.paper5\.(co|com)$/.test(origin)) return true
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return true
  
  return false
}

export function getCorsHeaders(req?: Request) {
  const reqOrigin = req?.headers.get('origin')
  const isAllowed = isAllowedOrigin(reqOrigin)
  const origin = isAllowed && reqOrigin ? reqOrigin : 'https://paper5.co'

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region, x-supabase-client-platform, x-csrf-token',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  }
}
