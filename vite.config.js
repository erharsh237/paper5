import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
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
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react'
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase'
            }
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-charts'
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion'
            }
            if (id.includes('lucide-react') || id.includes('@fortawesome')) {
              return 'vendor-icons'
            }
            if (id.includes('date-fns')) {
              return 'vendor-date'
            }
            if (id.includes('@sentry')) {
              return 'vendor-sentry'
            }
          }
        }
      }
    }
  },
})
