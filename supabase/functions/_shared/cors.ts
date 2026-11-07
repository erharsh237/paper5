const ALLOWED_ORIGINS = [
  'https://paper5.co',
  'https://app.paper5.co',
  'https://paper5.com',
  'https://app.paper5.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
]

export function getCorsHeaders(req?: Request) {
  const envOrigin = (typeof Deno !== 'undefined' ? Deno?.env?.get('ALLOWED_ORIGIN') : process?.env?.ALLOWED_ORIGIN) || 'https://paper5.co'
  const reqOrigin = req?.headers.get('origin')
  
  const isAllowed = Boolean(reqOrigin && (
    reqOrigin === envOrigin ||
    ALLOWED_ORIGINS.includes(reqOrigin) ||
    reqOrigin.endsWith('.paper5.co') ||
    reqOrigin.includes('localhost')
  ))

  const origin = isAllowed ? reqOrigin : envOrigin

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region, x-supabase-client-platform',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  }
}
