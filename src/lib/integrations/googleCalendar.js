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
    if (typeof window === 'undefined') return resolve()
    if (window.google?.accounts?.oauth2) return resolve()
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      gisScriptPromise = null
      reject(new Error('Could not load Google Identity Services script. Please check your network or ad blocker.'))
    }
    document.head.appendChild(script)
  })
  return gisScriptPromise
}

// In-memory cache + sessionStorage persistence across page refreshes (tab-scoped)
let cachedToken = null
let cachedTokenExpiry = 0

function getStoredToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry) return cachedToken
  try {
    if (typeof sessionStorage !== 'undefined') {
      const token = sessionStorage.getItem('paper5_gcal_token')
      const expiry = Number(sessionStorage.getItem('paper5_gcal_expiry') || 0)
      if (token && Date.now() < expiry) {
        cachedToken = token
        cachedTokenExpiry = expiry
        return token
      }
    }
  } catch (e) {}
  return null
}

function storeToken(token, expiresInSeconds) {
  cachedToken = token
  cachedTokenExpiry = Date.now() + ((expiresInSeconds || 3600) - 60) * 1000
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('paper5_gcal_token', token)
      sessionStorage.setItem('paper5_gcal_expiry', String(cachedTokenExpiry))
      sessionStorage.setItem('paper5_gcal_connected', 'true')
    }
  } catch (e) {}
}

function clearStoredToken() {
  cachedToken = null
  cachedTokenExpiry = 0
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('paper5_gcal_token')
      sessionStorage.removeItem('paper5_gcal_expiry')
      sessionStorage.removeItem('paper5_gcal_connected')
    }
  } catch (e) {}
}

async function ensureAccessToken(clientId, forceSelectAccount = false) {
  const existing = !forceSelectAccount ? getStoredToken() : null
  if (existing) return existing
  
  if (!window.google?.accounts?.oauth2) {
    await loadGis()
  }

  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: (clientId || '').trim(),
        scope: 'https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/calendar.events',
        error_callback: (err) => {
          console.error('Google OAuth Error:', err)
          const errType = err?.type || err?.message || ''
          if (errType === 'popup_closed_by_user') {
            reject(new Error('Sign-in popup was closed before authorization was completed.'))
          } else if (errType === 'access_denied') {
            reject(new Error('Access was denied. Please allow calendar permissions to connect.'))
          } else {
            reject(new Error(err?.message || errType || 'Failed to initialize Google Login. Check your Client ID.'))
          }
        },
        callback: (response) => {
          if (response.error) {
            if (response.error === 'access_denied') {
              return reject(new Error('Google authorization was cancelled or denied.'))
            }
            return reject(new Error(`Google auth failed: ${response.error}`))
          }
          if (!response.access_token) {
            return reject(new Error('No access token received from Google.'))
          }
          storeToken(response.access_token, response.expires_in)
          resolve(response.access_token)
        },
      })
      const requestOptions = forceSelectAccount ? { prompt: 'select_account' } : {}
      client.requestAccessToken(requestOptions)
    } catch (err) {
      console.error('Popup blocked or error:', err)
      reject(new Error('Failed to open Google Login popup. Please ensure popups are allowed for this site.'))
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
      cachedToken = null
      cachedTokenExpiry = 0
    }
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error?.message || `Google Calendar API error (${res.status}).`)
  }
  return res.json()
}

const DEFAULT_GOOGLE_CLIENT_ID = '909436054865-t9hd11hsgn9bfkrhetf5ipusv5i4kpjt.apps.googleusercontent.com'

export const googleCalendar = {
  id: 'google_calendar',
  name: 'Google Calendar',
  description: 'Push sprint start/end dates and the weekly meeting slot onto the team calendar.',
  configFields: [
    { key: 'googleCalendarClientId', label: 'OAuth Client ID', placeholder: '....apps.googleusercontent.com', type: 'password' },
  ],
  credentialFields: [
    { key: 'googleCalendarId', label: 'Calendar ID (optional — defaults to "primary")', placeholder: 'primary' },
  ],

  getClientId(config) {
    const fromConfig = config?.googleCalendarClientId
    const fromEnv = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID) ? import.meta.env.VITE_GOOGLE_CLIENT_ID : null
    return (fromConfig || fromEnv || DEFAULT_GOOGLE_CLIENT_ID).trim()
  },

  isConfigured(config) {
    return Boolean(this.getClientId(config))
  },

  actions: {
    async connectCalendar(config, credentials) {
      const clientId = googleCalendar.getClientId(config)
      if (!clientId) throw new Error('Google Calendar Client ID not configured for this workspace.')
      return ensureAccessToken(clientId, true)
    },

    async syncSprintDates(config, credentials, sprint) {
      const clientId = googleCalendar.getClientId(config)
      if (!clientId) throw new Error('Google Calendar Client ID not configured.')
      const token = await ensureAccessToken(clientId, false)
      return createEvent(credentials, token, {
        summary: `Sprint ${sprint.number}${sprint.goal ? `: ${sprint.goal}` : ''}`,
        start: { date: sprint.startDate },
        end: { date: sprint.endDate },
      })
    },

    async syncMeetingSlot(config, credentials, { date, sprintId }) {
      const clientId = googleCalendar.getClientId(config)
      if (!clientId) throw new Error('Google Calendar Client ID not configured.')
      const token = await ensureAccessToken(clientId, false)
      return createEvent(credentials, token, {
        summary: 'Sprint planning & review',
        description: sprintId ? `Sprint ID: ${sprintId}` : undefined,
        start: { date },
        end: { date },
      })
    },

    async testConnection(config, credentials) {
      const clientId = googleCalendar.getClientId(config)
      if (!clientId) throw new Error('Google Calendar Client ID not configured.')
      const token = await ensureAccessToken(clientId, false)
      const now = new Date()
      return createEvent(credentials, token, {
        summary: 'Paper5 Calendar Sync Test',
        description: 'If you are seeing this, your personal Google Calendar integration is working successfully!',
        start: { dateTime: now.toISOString() },
        end: { dateTime: new Date(now.getTime() + 30 * 60000).toISOString() },
      })
    },

    async fetchUpcomingEvents(config, credentials) {
      const clientId = googleCalendar.getClientId(config)
      if (!clientId) throw new Error('Google Calendar Client ID not configured.')
      const token = await ensureAccessToken(clientId, false)
      const calendarId = credentials?.googleCalendarId || 'primary'
      const timeMin = new Date().toISOString()
      const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ahead
      
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&orderBy=startTime&singleEvents=true&maxResults=10`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) {
        if (res.status === 401) {
          clearStoredToken()
          throw new Error('Your Google session expired. Please click connect again.')
        }
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || `Google Calendar API error (${res.status}).`)
      }
      const data = await res.json()
      return data.items || []
    },

    disconnectCalendar() {
      clearStoredToken()
    },

    hasValidToken() {
      return Boolean(getStoredToken())
    },

    wasConnected() {
      try {
        return typeof sessionStorage !== 'undefined' && sessionStorage.getItem('paper5_gcal_connected') === 'true'
      } catch (e) {
        return false
      }
    },
  },
}
