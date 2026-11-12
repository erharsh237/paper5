import {
  handleContact,
  handleFeedback,
  handleForgotPassword,
  handleNotFound,
  handleServerError
} from './_publicHandlers.js'

const ACTION_HANDLERS = {
  contact: handleContact,
  feedback: handleFeedback,
  'forgot-password': handleForgotPassword,
  'not-found': handleNotFound,
  '500': handleServerError,
  'server-error': handleServerError
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
  if (pathname === '/api/500' || pathname === '/500') return '500'
  return 'not-found'
}

/**
 * Unified public endpoint consolidating contact, feedback, password recovery,
 * SSR 404 responses, and resilient 500 error handling within Vercel's Serverless Function limit.
 */
export default async function handler(req, res) {
  try {
    const action = resolveAction(req)
    return await ACTION_HANDLERS[action](req, res)
  } catch (err) {
    return handleServerError(req, res, err)
  }
}
