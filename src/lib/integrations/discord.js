// Real Discord integration via an incoming webhook — no OAuth needed.
// Create one in the target channel's Settings > Integrations > Webhooks,
// paste the URL in Integrations settings. Discord's webhook execute
// endpoint supports cross-origin POST from a browser.

export const discord = {
  id: 'discord',
  name: 'Discord',
  description: 'Mirror in-app notifications (blockers, review requests) into a team channel.',
  configFields: [
    { key: 'discordWebhookUrl', label: 'Webhook URL', placeholder: 'https://discord.com/api/webhooks/...', type: 'password' },
  ],
  credentialFields: [],

  isConfigured(config) {
    return Boolean(config?.discordWebhookUrl)
  },

  actions: {
    async postMessage(config, _credentials, { text }) {
      if (!config?.discordWebhookUrl) throw new Error('Discord webhook not configured.')
      const res = await fetch(config.discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      if (!res.ok) throw new Error(`Discord webhook failed (${res.status}). Check the URL is still valid.`)
    },
  },
}
