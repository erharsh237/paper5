// Real GitHub integration. Public repos work with zero setup — GitHub's
// REST API allows unauthenticated GET requests up to 60/hour. Add a
// personal access token (fine-grained, read-only on the repo is enough)
// for private repos or a higher rate limit; it's stored per-user, never
// team-readable (see integrations/config.js).

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } : { Accept: 'application/vnd.github+json' }
}

// Accepts either a full PR URL (https://github.com/owner/repo/pull/12) or
// a bare number — evidence links get pasted as full URLs in practice.
function extractPrNumber(prUrlOrNumber) {
  if (typeof prUrlOrNumber === 'number') return prUrlOrNumber
  const match = String(prUrlOrNumber).match(/\/pull\/(\d+)/)
  if (match) return Number(match[1])
  const asNumber = Number(prUrlOrNumber)
  if (!Number.isNaN(asNumber)) return asNumber
  return null
}

export const github = {
  id: 'github',
  name: 'GitHub',
  description: 'Link PRs and commits as task evidence, and surface CI status on the sprint board.',
  configFields: [
    { key: 'githubOwner', label: 'Repo owner/org', placeholder: 'e.g. your-org' },
    { key: 'githubRepo', label: 'Repo name', placeholder: 'e.g. securiq' },
  ],
  credentialFields: [
    { key: 'githubToken', label: 'Personal access token (optional — needed for private repos)', type: 'password' },
  ],

  isConfigured(config) {
    return Boolean(config?.githubOwner && config?.githubRepo)
  },

  actions: {
    async fetchPullRequest(config, credentials, prUrlOrNumber) {
      const number = extractPrNumber(prUrlOrNumber)
      if (!number) throw new Error("Couldn't find a PR number in that link.")
      const res = await fetch(
        `https://api.github.com/repos/${config.githubOwner}/${config.githubRepo}/pulls/${number}`,
        { headers: authHeaders(credentials?.githubToken) }
      )
      if (!res.ok) throw new Error(res.status === 404 ? 'PR not found — check the repo owner/name.' : `GitHub API error (${res.status}).`)
      const data = await res.json()
      return {
        title: data.title,
        state: data.merged ? 'merged' : data.state,
        url: data.html_url,
        headSha: data.head?.sha,
      }
    },

    async fetchCommitsSince(config, credentials, isoDate) {
      const res = await fetch(
        `https://api.github.com/repos/${config.githubOwner}/${config.githubRepo}/commits?since=${encodeURIComponent(isoDate)}`,
        { headers: authHeaders(credentials?.githubToken) }
      )
      if (!res.ok) throw new Error(`GitHub API error (${res.status}).`)
      const data = await res.json()
      return data.map(c => ({ sha: c.sha, message: c.commit?.message, author: c.commit?.author?.name, url: c.html_url }))
    },

    async fetchChecksStatus(config, credentials, prUrlOrNumber) {
      const pr = await this.fetchPullRequest(config, credentials, prUrlOrNumber)
      if (!pr.headSha) throw new Error('No commit SHA available for this PR.')
      const res = await fetch(
        `https://api.github.com/repos/${config.githubOwner}/${config.githubRepo}/commits/${pr.headSha}/check-runs`,
        { headers: authHeaders(credentials?.githubToken) }
      )
      if (!res.ok) throw new Error(`GitHub API error (${res.status}).`)
      const data = await res.json()
      const runs = data.check_runs || []
      const allComplete = runs.every(r => r.status === 'completed')
      const anyFailed = runs.some(r => r.conclusion === 'failure')
      return {
        overall: runs.length === 0 ? 'no_checks' : !allComplete ? 'pending' : anyFailed ? 'failure' : 'success',
        runs: runs.map(r => ({ name: r.name, status: r.status, conclusion: r.conclusion })),
      }
    },
  },
}
