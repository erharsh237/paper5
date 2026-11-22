/**
 * In-flight request deduplication and high-performance caching for workspace overview data.
 * Eliminates duplicate concurrent requests from WorkspaceBentoLayout and AdminCommandCenter,
 * reducing serverless invocations and database load while enabling instant transitions.
 */

const overviewCache = new Map() // workspaceId -> { data, timestamp }
const inFlightRequests = new Map() // workspaceId -> Promise

const CACHE_TTL_MS = 10000 // 10 seconds stale threshold

/**
 * Fetches workspace overview data with automatic in-flight deduplication
 * and stale-while-revalidate caching.
 *
 * @param {string} workspaceId
 * @param {{ force?: boolean }} options
 * @returns {Promise<any>}
 */
export async function fetchWorkspaceOverview(workspaceId, { force = false } = {}) {
  if (!workspaceId) return null

  const now = Date.now()
  const cached = overviewCache.get(workspaceId)

  // Return fresh cached data if available and not forced
  if (!force && cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data
  }

  // Deduplicate concurrent in-flight requests for the same workspace
  if (inFlightRequests.has(workspaceId)) {
    return inFlightRequests.get(workspaceId)
  }

  const fetchPromise = (async () => {
    try {
      const res = await fetch(`/api/admin?workspaceId=${encodeURIComponent(workspaceId)}&action=overview`, {
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' }
      })

      if (!res.ok) {
        throw new Error(`Overview fetch failed with status ${res.status}`)
      }

      const json = await res.json()
      overviewCache.set(workspaceId, {
        data: json,
        timestamp: Date.now()
      })
      return json
    } finally {
      inFlightRequests.delete(workspaceId)
    }
  })()

  inFlightRequests.set(workspaceId, fetchPromise)
  return fetchPromise
}

/**
 * Retrieves the currently cached overview synchronously (if any).
 * Enables instant component rendering on initial mount without waiting for network.
 *
 * @param {string} workspaceId
 * @returns {any | null}
 */
export function getCachedWorkspaceOverview(workspaceId) {
  if (!workspaceId) return null
  const entry = overviewCache.get(workspaceId)
  return entry ? entry.data : null
}

/**
 * Invalidates the cached overview data for a workspace.
 * Call this when tasks, sprints, or members are modified.
 *
 * @param {string} workspaceId
 */
export function invalidateWorkspaceOverview(workspaceId) {
  if (!workspaceId) return
  overviewCache.delete(workspaceId)
}
