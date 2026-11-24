import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

export default defineConfig(({ mode }) => {
  // Load parent .env variables so api/owner.js has access to Supabase keys in local dev
  const env = loadEnv(mode, rootDir, '')
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

            if (url.pathname === '/product-film' || url.pathname === '/product-film.htm') {
              res.writeHead(302, { Location: '/product-film.html' })
              res.end()
              return
            }

            if (url.pathname === '/api/owner') {
              try {
                // Ensure query object exists
                req.query = Object.fromEntries(url.searchParams.entries())

                // Polyfill Express / Vercel response helpers for Vite's raw Node server
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

                // Parse request body for state-mutating methods
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

                // Import and execute local api/owner.js
                const ownerFilePath = path.resolve(rootDir, 'api/owner.js')
                const ownerModule = await import(pathToFileURL(ownerFilePath).href + '?t=' + Date.now())
                await ownerModule.default(req, res)
                return
              } catch (err) {
                console.error('[Local Vite API Error]', err)
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: err.message }))
                return
              }
            }
            next()
          })
        }
      }
    ],
    publicDir: path.resolve(rootDir, 'public'),
    envDir: rootDir,
    css: {
      postcss: path.resolve(__dirname, 'postcss.config.js')
    },
    server: {
      port: 5173,
      strictPort: true
    }
  }
})
