// Real Google Calendar integration via Google Identity Services (GIS) —
// this is the one integration here that genuinely needs an external setup
// step I can't do for you: a Google OAuth Client ID.
//
// Setup (one-time, in Google Cloud Console):
//   1. Create/select a project, enable the "Google Calendar API".
//   2. Create an OAuth 2.0 Client ID (type: Web application).
//   3. Add this app's origin (e.g. https://your-tracker.web.app) to
//      "Authorized JavaScript origins" — NOT redirect URIs, this uses the
//      token/implicit flow, not a redirect.
//   4. Paste the Client ID into Integrations settings below.
//
// The consent popup appears the first time any team member tries to sync
// a sprint; each person authorizes individually (Google requires this —
// there's no way to pre-authorize on everyone's behalf from the client).

let gisScriptPromise = null

function loadGis() {
  if (gisScriptPromise) return gisScriptPromise
  gisScriptPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load Google Identity Services script.'))
    document.head.appendChild(script)
  })
  return gisScriptPromise
}

// Access tokens from the implicit flow are short-lived (~1hr) and
// intentionally not persisted — re-prompting occasionally is the correct
// tradeoff for a client-only app with no refresh-token storage.
let cachedToken = null
let cachedTokenExpiry = 0

async function ensureAccessToken(clientId) {
  if (cachedToken && Date.now() < cachedTokenExpiry) return cachedToken
  await loadGis()
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/calendar.events',
      callback: (response) => {
        if (response.error) return reject(new Error(`Google auth failed: ${response.error}`))
        cachedToken = response.access_token
        cachedTokenExpiry = Date.now() + (response.expires_in - 60) * 1000
        resolve(cachedToken)
      },
    })
    client.requestAccessToken()
  })
}

async function createEvent(config, accessToken, event) {
  const calendarId = config.googleCalendarId || 'primary'
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }
  )
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error?.message || `Google Calendar API error (${res.status}).`)
  }
  return res.json()
}

export const googleCalendar = {
  id: 'google_calendar',
  name: 'Google Calendar',
  description: 'Push sprint start/end dates and the weekly meeting slot onto the team calendar.',
  configFields: [
    { key: 'googleCalendarClientId', label: 'OAuth Client ID', placeholder: '....apps.googleusercontent.com' },
    { key: 'googleCalendarId', label: 'Calendar ID (optional — defaults to "primary")', placeholder: 'primary' },
  ],
  credentialFields: [],

  isConfigured(config) {
    return Boolean(config?.googleCalendarClientId)
  },

  actions: {
    async syncSprintDates(config, _credentials, sprint) {
      if (!this.isConfigured(config)) throw new Error('Google Calendar Client ID not configured.')
      const token = await ensureAccessToken(config.googleCalendarClientId)
      return createEvent(config, token, {
        summary: `Sprint ${sprint.number}${sprint.goal ? `: ${sprint.goal}` : ''}`,
        start: { date: sprint.startDate },
        end: { date: sprint.endDate },
      })
    },

    async syncMeetingSlot(config, _credentials, { date, sprintId }) {
      if (!this.isConfigured(config)) throw new Error('Google Calendar Client ID not configured.')
      const token = await ensureAccessToken(config.googleCalendarClientId)
      return createEvent(config, token, {
        summary: 'Sprint planning & review',
        description: sprintId ? `Sprint ID: ${sprintId}` : undefined,
        start: { date },
        end: { date },
      })
    },
  },
}
