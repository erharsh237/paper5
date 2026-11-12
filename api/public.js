import {
  handleContact,
  handleFeedback,
  handleForgotPassword,
  handleNotFound
} from './_publicHandlers.js'

const ACTION_HANDLERS = {
  contact: handleContact,
  feedback: handleFeedback,
  'forgot-password': handleForgotPassword,
  'not-found': handleNotFound
}

/**
 * Resolves the target public action from the rewritten query param or URL path.
 */
function resolveAction(req) {
  const queryAction = typeof req.query?.action === 'string' ? req.query.action.trim().toLowerCase() : ''
  if (queryAction && ACTION_HANDLERS[queryAction]) {
    return queryAction
  }

  const pathname = String(req.url || '').split('?')[0].toLowerCase()
  if (pathname === '/api/contact') return 'contact'
  if (pathname === '/api/feedback') return 'feedback'
  if (pathname === '/api/forgot-password') return 'forgot-password'
  return 'not-found'
}

/**
 * Unified public endpoint consolidating contact, feedback, password recovery,
 * and SSR 404 responses within Vercel's Hobby plan Serverless Function limit.
 */
export default function handler(req, res) {
  const action = resolveAction(req)
  return ACTION_HANDLERS[action](req, res)
}
