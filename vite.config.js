import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  Object.assign(process.env, env)

  return {
  plugins: [
    react(),
    {
      name: 'local-owner-api-handler',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const host = req.headers.host || 'localhost:5173'
          const url = new URL(req.url, `http://${host}`)

          const localApiRoutes = {
            '/api/owner': { file: 'api/owner.js' },
            '/api/auth/session': { file: 'api/auth/session.js' },
            '/api/public': { file: 'api/public.js' },
            '/api/contact': { file: 'api/public.js', query: { action: 'contact' } },
            '/api/feedback': { file: 'api/public.js', query: { action: 'feedback' } },
            '/api/product-feedback': { file: 'api/public.js', query: { action: 'product-feedback' } },
            '/api/forgot-password': { file: 'api/public.js', query: { action: 'forgot-password' } },
            '/api/admin': { file: 'api/admin.js' },
            '/api/admin-overview': { file: 'api/admin.js', query: { action: 'overview' } },
            '/api/audit-logs': { file: 'api/admin.js', query: { action: 'audit-logs' } },
            '/api/workspace-members': { file: 'api/workspace-members.js' },
            '/api/ensure-user': { file: 'api/workspace-members.js', query: { action: 'ensure_user' } },
            '/api/delete-workspace': { file: 'api/workspace-members.js', query: { action: 'delete_workspace' } },
            '/api/delete-user': { file: 'api/workspace-members.js', query: { action: 'delete_user' } },
            '/api/request-account-deletion': { file: 'api/workspace-members.js', query: { action: 'request_account_deletion' } },
            '/api/invites': { file: 'api/invites.js' },
            '/api/accept-invite': { file: 'api/invites.js', query: { action: 'accept' } },
            '/api/send-invite': { file: 'api/invites.js', query: { action: 'send' } },
            '/api/select-plan': { file: 'api/select-plan.js' },
            '/api/sprints': { file: 'api/sprints.js' },
            '/api/deadlines': { file: 'api/deadlines.js' },
            '/api/meetings': { file: 'api/meetings.js' },
          }

          if (localApiRoutes[url.pathname]) {
            try {
              const routeCfg = localApiRoutes[url.pathname]
              req.query = {
                ...Object.fromEntries(url.searchParams.entries()),
                ...(routeCfg.query || {})
              }

              if (!res.status) {
                res.status = function(code) {
                  this.statusCode = code
                  return this
                }
              }
              if (!res.json) {
                res.json = function(data) {
                  this.setHeader('Content-Type', 'application/json')
                  this.end(JSON.stringify(data))
                  return this
                }
              }

              if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
                let rawBody = ''
                for await (const chunk of req) {
                  rawBody += chunk
                }
                try {
                  req.body = JSON.parse(rawBody)
                } catch (_) {
                  req.body = rawBody
                }
              }

              const apiFilePath = path.resolve(__dirname, routeCfg.file)
              const apiModule = await import(pathToFileURL(apiFilePath).href + '?t=' + Date.now())
              await apiModule.default(req, res)
              return
            } catch (err) {
              console.error('[Local API Error]', err)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: err.message }))
              return
            }
          }
          next()
        })
      }
    },
    {
      name: 'block-cloudflare-config',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url ? req.url.split('?')[0].toLowerCase() : ''
          const blocked = ['/.dev.vars', '/wrangler.toml', '/wrangler.json', '/wrangler.jsonc', '/vercel.json']
          if (blocked.includes(url) || url.startsWith('/.dev.vars') || url.startsWith('/.vercel')) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'text/plain')
            res.end('404 Not Found')
            return
          }
          next()
        })
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url ? req.url.split('?')[0].toLowerCase() : ''
          const blocked = ['/.dev.vars', '/wrangler.toml', '/wrangler.json', '/wrangler.jsonc', '/vercel.json']
          if (blocked.includes(url) || url.startsWith('/.dev.vars') || url.startsWith('/.vercel')) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'text/plain')
            res.end('404 Not Found')
            return
          }
          next()
        })
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
  oxc: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  build: {
    sourcemap: false,
    target: 'es2020',
    cssTarget: 'es2020',
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            const normalized = id.replace(/\\/g, '/')
            if (
              normalized.includes('/react/') ||
              normalized.includes('/react-dom/') ||
              normalized.includes('/react-router/') ||
              normalized.includes('/react-router-dom/')
            ) {
              return 'vendor-react'
            }
            if (normalized.includes('/@supabase/')) {
              return 'vendor-supabase'
            }
            if (normalized.includes('/framer-motion/')) {
              return 'vendor-motion'
            }
            if (normalized.includes('/lucide-react/') || normalized.includes('/@fortawesome/')) {
              return 'vendor-icons'
            }
            if (normalized.includes('/recharts/') || normalized.includes('/d3-')) {
              return 'vendor-charts'
            }
            if (normalized.includes('/date-fns/')) {
              return 'vendor-date'
            }
            if (normalized.includes('/@sentry/')) {
              return 'vendor-sentry'
            }
          }
        }
      }
    }
  }
}
})
