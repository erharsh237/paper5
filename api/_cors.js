const ALLOWED_EXACT_ORIGINS = new Set([
  'https://paper5.co',
  'https://app.paper5.co',
  'https://paper5.com',
  'https://app.paper5.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
])

function isAllowedOrigin(origin) {
  if (!origin || typeof origin !== 'string') return false
  if (ALLOWED_EXACT_ORIGINS.has(origin)) return true
  
  // Safe localhost/loopback check with port
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true
  
  // Trusted Paper5 and Vercel preview environments
  if (/^https:\/\/[a-z0-9-]+\.paper5\.(co|com)$/.test(origin)) return true
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return true
  
  return false
}

export function setCorsHeaders(req, res) {
  const reqOrigin = req.headers?.origin || ''
  const isAllowed = isAllowedOrigin(reqOrigin)

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', reqOrigin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  } else {
    // Restrict to primary production domain if origin not permitted
    res.setHeader('Access-Control-Allow-Origin', 'https://paper5.co')
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-CSRF-Token')
  res.setHeader('Vary', 'Origin')

  return isAllowed ? reqOrigin : 'https://paper5.co'
}
