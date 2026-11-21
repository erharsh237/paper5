import helmet from 'helmet'

/**
 * Helmet Security Middleware for Vercel Serverless Functions.
 * Configured with standard Helmet HTTP security protections (X-Content-Type-Options,
 * X-Frame-Options, HSTS, Referrer-Policy, DNS Prefetch Control, etc.).
 * Note: Full edge CSP and caching headers are also enforced at the Vercel CDN layer in vercel.json.
 */
const helmetMiddleware = helmet({
  contentSecurityPolicy: false, // Managed natively at edge in vercel.json
  crossOriginEmbedderPolicy: false,
})

/**
 * Applies Helmet security headers to standard Node.js (req, res) serverless handlers.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {Promise<void>}
 */
export function applyHelmet(req, res) {
  return new Promise((resolve) => {
    helmetMiddleware(req, res, () => {
      resolve()
    })
  })
}

export default applyHelmet
