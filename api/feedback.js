import {
  sanitizeText,
  isValidEmail,
  isDuplicateSubmission,
  verifyTurnstileToken,
  runFormPreamble,
  forwardToFormspree
} from './_formSecurity.js'

const ALLOWED_CATEGORIES = new Set([
  'Feedback',
  'Feature Request',
  'Bug Report',
  'UI/UX Feedback',
  'General Feedback'
])

export default async function handler(req, res) {
  if (!runFormPreamble(req, res, { max: 6, windowMs: 600000 })) {
    return
  }

  const name = sanitizeText(req.body.name || 'Anonymous User', { maxLen: 100 })
  const rawEmail = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const email = rawEmail && rawEmail !== 'not-provided' ? rawEmail : ''
  if (email && !isValidEmail(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' })
  }

  const rawCategory = sanitizeText(req.body.category || 'General Feedback', { maxLen: 60 })
  const category = ALLOWED_CATEGORIES.has(rawCategory) ? rawCategory : 'General Feedback'
  const rawRating = String(req.body.rating ?? '5').trim()
  const ratingNum = ['1', '2', '3', '4', '5'].includes(rawRating) ? rawRating : '5'
  const message = sanitizeText(req.body.message || '', { maxLen: 3000, preserveNewlines: true })
  const source = sanitizeText(req.body.source || 'Paper5 Application Feedback', { maxLen: 100 })

  if (message.length < 3) {
    return res.status(400).json({ error: 'Feedback message must be at least 3 characters.' })
  }
  if (isDuplicateSubmission(req, 'feedback', [email || 'anon', category, message.slice(0, 300)])) {
    return res.status(409).json({
      error: 'Duplicate feedback detected. Thank you — your feedback was already received.'
    })
  }

  const turnstileCheck = await verifyTurnstileToken(req, req.body.turnstileToken)
  if (!turnstileCheck.ok) {
    return res.status(turnstileCheck.status || 400).json({ error: turnstileCheck.error })
  }

  const endpoint = process.env.FORMSPREE_FEEDBACK_ENDPOINT || 'https://formspree.io/f/xwlekeea'
  try {
    await forwardToFormspree(endpoint, {
      name,
      email: email || 'not-provided',
      category,
      rating: `${ratingNum} / 5 Stars`,
      message,
      source
    })
    return res.status(200).json({ ok: true, message: 'Feedback delivered successfully.' })
  } catch (err) {
    console.error('[api/feedback] Delivery error:', err)
    return res.status(502).json({
      error: 'Unable to submit feedback right now. Please try again shortly.'
    })
  }
}
