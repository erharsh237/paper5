import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // Split heavy, infrequently-changing libraries into their own
        // chunks. Route-based lazy loading in App.jsx means recharts only
        // loads on the Analytics page instead of every page, and this
        // chunk changes far less often than app code, so browsers keep it
        // cached across deploys instead of re-downloading everything on
        // every release.
        manualChunks(id) {
          if (id.includes('recharts')) return 'charts'
          if (id.includes('firebase') || id.includes('@firebase')) return 'firebase'
        },
      },
    },
  },
})
