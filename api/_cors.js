const ALLOWED_ORIGINS = [
  'https://paper5.co',
  'https://app.paper5.co',
  'https://paper5.com',
  'https://app.paper5.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
]

export function setCorsHeaders(req, res) {
  const envOrigin = process.env.ALLOWED_ORIGIN || 'https://paper5.co'
  const reqOrigin = req.headers?.origin || ''
  
  const isAllowed = Boolean(reqOrigin && (
    reqOrigin === envOrigin ||
    ALLOWED_ORIGINS.includes(reqOrigin) ||
    reqOrigin.endsWith('.paper5.co') ||
    reqOrigin.includes('localhost')
  ))

  const originToSet = isAllowed ? reqOrigin : envOrigin

  res.setHeader('Access-Control-Allow-Origin', originToSet)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Vary', 'Origin')

  return originToSet
}
