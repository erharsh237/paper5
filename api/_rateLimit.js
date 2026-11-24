/**
 * Server-side in-memory sliding-window rate limiter for Vercel Serverless Functions
 */
const rateLimitMap = new Map()
const bannedIpsSet = new Set()

export function registerBannedIp(ip) {
  if (ip && typeof ip === 'string') bannedIpsSet.add(ip.trim())
}

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitMap.entries()) {
    if (now - record.resetTime > 60000) {
      rateLimitMap.delete(key)
    }
  }
}, 300000).unref?.()

/**
 * Check if the incoming request exceeds rate limit.
 * @param {object} req - Incoming HTTP request
 * @param {object} res - Outgoing HTTP response
 * @param {object} options - Rate limit config
 * @param {number} options.max - Max allowed requests within window (default 60)
 * @param {number} options.windowMs - Time window in milliseconds (default 60000 = 1 minute)
 * @returns {boolean} true if request was rate-limited (429 returned), false if allowed to proceed
 */
export function checkRateLimit(req, res, { max = 60, windowMs = 60000 } = {}) {
  // Allow authorized load testing / security audits with secret header
  const loadTestSecret = process.env.LOAD_TEST_SECRET
  if (loadTestSecret && req.headers?.['x-load-test-secret'] === loadTestSecret) {
    res.setHeader('X-RateLimit-Bypass', 'authorized-load-test')
    return false
  }

  // Authoritative proxy header priority: prefer x-real-ip or x-vercel-ip over client-supplied x-forwarded-for
  const realIp = (typeof req.headers['x-real-ip'] === 'string' && req.headers['x-real-ip'].trim()) ||
                 (typeof req.headers['x-vercel-ip'] === 'string' && req.headers['x-vercel-ip'].trim())

  let ip = realIp
  if (!ip) {
    const forwarded = req.headers['x-forwarded-for']
    ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
         req.socket?.remoteAddress ||
         'unknown'
  }

  const endpoint = req.url?.split('?')[0] || ''
  const key = `${ip}:${endpoint}`

  if (ip && bannedIpsSet.has(ip)) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Your IP address has been permanently suspended from the platform.'
    })
    return true
  }

  const now = Date.now()

  let record = rateLimitMap.get(key)
  if (!record || now > record.resetTime) {
    record = {
      count: 1,
      resetTime: now + windowMs
    }
    rateLimitMap.set(key, record)
  } else {
    record.count++
  }

  const remaining = Math.max(0, max - record.count)
  const resetSeconds = Math.ceil((record.resetTime - now) / 1000)

  res.setHeader('X-RateLimit-Limit', max)
  res.setHeader('X-RateLimit-Remaining', remaining)
  res.setHeader('X-RateLimit-Reset', resetSeconds)

  if (record.count > max) {
    res.setHeader('Retry-After', resetSeconds)
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please wait before retrying.',
      retryAfter: resetSeconds
    })
    return true
  }

  return false
}
