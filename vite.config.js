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

          if (url.pathname === '/api/owner') {
            try {
              req.query = Object.fromEntries(url.searchParams.entries())

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

              const ownerFilePath = path.resolve(__dirname, 'api/owner.js')
              const ownerModule = await import(pathToFileURL(ownerFilePath).href + '?t=' + Date.now())
              await ownerModule.default(req, res)
              return
            } catch (err) {
              console.error('[Local Owner API Error]', err)
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
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  oxc: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  build: {
    sourcemap: false,
    target: 'es2020',
    cssTarget: 'es2020',
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
