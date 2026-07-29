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

export function loadGis() {
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
let cachedToken = localStorage.getItem('gcal_token') || null
let cachedTokenExpiry = parseInt(localStorage.getItem('gcal_token_expiry') || '0', 10)

async function ensureAccessToken(clientId) {
  if (cachedToken && Date.now() < cachedTokenExpiry) return cachedToken
  
  if (!window.google?.accounts?.oauth2) {
    await loadGis()
  }

  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: (clientId || '').trim(),
        scope: 'https://www.googleapis.com/auth/calendar.events',
        error_callback: (err) => {
          console.error('Google OAuth Error:', err)
          reject(new Error(err.message || err.type || 'Failed to initialize Google Login. Check your Client ID.'))
        },
        callback: (response) => {
          if (response.error) return reject(new Error(`Google auth failed: ${response.error}`))
          cachedToken = response.access_token
          cachedTokenExpiry = Date.now() + (response.expires_in - 60) * 1000
          localStorage.setItem('gcal_token', cachedToken)
          localStorage.setItem('gcal_token_expiry', cachedTokenExpiry.toString())
          resolve(cachedToken)
        },
      })
      client.requestAccessToken()
    } catch (err) {
      console.error('Popup blocked or error:', err)
      reject(new Error('Failed to open Google Login. Please ensure popups are allowed.'))
    }
  })
}

async function createEvent(credentials, accessToken, event) {
  const calendarId = credentials?.googleCalendarId || 'primary'
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }
  )
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('gcal_token')
      localStorage.removeItem('gcal_token_expiry')
      cachedToken = null
      cachedTokenExpiry = 0
    }
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
  ],
  credentialFields: [
    { key: 'googleCalendarId', label: 'Calendar ID (optional — defaults to "primary")', placeholder: 'primary' },
  ],

  isConfigured(config) {
    return Boolean(config?.googleCalendarClientId)
  },

  actions: {
    async syncSprintDates(config, credentials, sprint) {
      if (!googleCalendar.isConfigured(config)) throw new Error('Google Calendar Client ID not configured.')
      const token = await ensureAccessToken(config.googleCalendarClientId)
      return createEvent(credentials, token, {
        summary: `Sprint ${sprint.number}${sprint.goal ? `: ${sprint.goal}` : ''}`,
        start: { date: sprint.startDate },
        end: { date: sprint.endDate },
      })
    },

    async syncMeetingSlot(config, credentials, { date, sprintId }) {
      if (!googleCalendar.isConfigured(config)) throw new Error('Google Calendar Client ID not configured.')
      const token = await ensureAccessToken(config.googleCalendarClientId)
      return createEvent(credentials, token, {
        summary: 'Sprint planning & review',
        description: sprintId ? `Sprint ID: ${sprintId}` : undefined,
        start: { date },
        end: { date },
      })
    },

    async testConnection(config, credentials) {
      if (!googleCalendar.isConfigured(config)) throw new Error('Google Calendar Client ID not configured.')
      const token = await ensureAccessToken(config.googleCalendarClientId)
      const now = new Date()
      return createEvent(credentials, token, {
        summary: 'Securiq Calendar Sync Test',
        description: 'If you are seeing this, your personal Google Calendar integration is working successfully!',
        start: { dateTime: now.toISOString() },
        end: { dateTime: new Date(now.getTime() + 30 * 60000).toISOString() },
      })
    },

    async fetchUpcomingEvents(config, credentials) {
      if (!googleCalendar.isConfigured(config)) throw new Error('Google Calendar Client ID not configured.')
      const token = await ensureAccessToken(config.googleCalendarClientId)
      const calendarId = credentials?.googleCalendarId || 'primary'
      const timeMin = new Date().toISOString()
      const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ahead
      
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&orderBy=startTime&singleEvents=true&maxResults=10`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('gcal_token')
          localStorage.removeItem('gcal_token_expiry')
          cachedToken = null
          cachedTokenExpiry = 0
          throw new Error('Your session expired. Please click connect again.')
        }
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || `Google Calendar API error (${res.status}).`)
      }
      const data = await res.json()
      console.log('[Calendar Sync] Raw events returned by Google API:', data.items)
      return data.items || []
    },

    disconnectCalendar() {
      localStorage.removeItem('gcal_token')
      localStorage.removeItem('gcal_token_expiry')
      cachedToken = null
      cachedTokenExpiry = 0
    },

    hasValidToken() {
      return Boolean(cachedToken && Date.now() < cachedTokenExpiry)
    },
  },
}
