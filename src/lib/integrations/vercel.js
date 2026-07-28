// Real Vercel integration via a personal API token (Vercel Account
// Settings > Tokens) — stored per-user, never team-readable, since it's
// tied to one person's Vercel account.

export const vercel = {
  id: 'vercel',
  name: 'Vercel',
  description: 'Show latest deployment status on the dashboard — ties "done" tasks to what\'s actually live.',
  configFields: [
    { key: 'vercelProjectId', label: 'Project ID', placeholder: 'prj_...' },
  ],
  credentialFields: [
    { key: 'vercelToken', label: 'Personal API token', type: 'password' },
  ],

  isConfigured(config, credentials) {
    return Boolean(config?.vercelProjectId && credentials?.vercelToken)
  },

  actions: {
    async fetchLatestDeployment(config, credentials) {
      if (!this.isConfigured(config, credentials)) throw new Error('Vercel project ID and token both required.')
      const res = await fetch(
        `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(config.vercelProjectId)}&limit=1`,
        { headers: { Authorization: `Bearer ${credentials.vercelToken}` } }
      )
      if (!res.ok) throw new Error(`Vercel API error (${res.status}). Check the token and project ID.`)
      const data = await res.json()
      const d = data.deployments?.[0]
      if (!d) return { state: 'none', url: null, createdAt: null }
      return { state: d.state || d.readyState, url: d.url ? `https://${d.url}` : null, createdAt: d.createdAt }
    },
  },
}
