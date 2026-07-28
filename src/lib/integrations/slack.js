// Real Slack integration via an incoming webhook — no OAuth needed. Create
// one at api.slack.com/apps for your workspace, paste the URL below. Some
// older/locked-down Slack workspaces restrict CORS on webhooks — if
// postMessage fails with a network error rather than a clean HTTP status,
// that's usually why.

export const slack = {
  id: 'slack',
  name: 'Slack',
  description: 'Mirror in-app notifications (blockers, review requests) into a team channel.',
  configFields: [
    { key: 'slackWebhookUrl', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/services/...' },
  ],
  credentialFields: [],

  isConfigured(config) {
    return Boolean(config?.slackWebhookUrl)
  },

  actions: {
    async postMessage(config, _credentials, { text }) {
      if (!config?.slackWebhookUrl) throw new Error('Slack webhook not configured.')
      let res
      try {
        res = await fetch(config.slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
      } catch {
        throw new Error("Couldn't reach Slack — this workspace's webhook may block browser CORS requests.")
      }
      if (!res.ok) throw new Error(`Slack webhook failed (${res.status}). Check the URL is still valid.`)
    },
  },
}
