import { github } from './github'
import { googleCalendar } from './googleCalendar'
import { discord } from './discord'
import { slack } from './slack'
import { vercel } from './vercel'

// Central registry. Adding a new integration later means writing one file
// matching the shape in types.js and adding it here — nothing else in the
// app needs to change to have it show up on the Integrations page.
export const INTEGRATIONS = [github, googleCalendar, discord, slack, vercel]

export function getIntegration(id) {
  return INTEGRATIONS.find(i => i.id === id) || null
}
