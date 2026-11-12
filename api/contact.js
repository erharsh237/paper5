import {
  sanitizeText,
  isValidEmail,
  isDuplicateSubmission,
  verifyTurnstileToken,
  runFormPreamble,
  forwardToFormspree
} from './_formSecurity.js'

const ALLOWED_SUBJECTS = new Set([
  'General Inquiry',
  'Sales & Enterprise',
  'Technical Support',
  'Billing & Invoices',
  'Security Disclosure',
  'Product Feedback',
  'Contact Sales'
])

export default async function handler(req, res) {
  if (!runFormPreamble(req, res, { max: 5, windowMs: 600000 })) {
    return
  }

  const name = sanitizeText(req.body.name || '', { maxLen: 100 })
  const emailRaw = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const rawSubject = sanitizeText(req.body.subject || 'General Inquiry', { maxLen: 100 })
  const subject = ALLOWED_SUBJECTS.has(rawSubject) ? rawSubject : 'General Inquiry'
  const message = sanitizeText(req.body.message || '', { maxLen: 3000, preserveNewlines: true })
  const source = sanitizeText(req.body.source || 'Paper5 Contact Form', { maxLen: 100 })

  if (!isValidEmail(emailRaw)) {
    return res.status(400).json({ error: 'Please provide a valid work email address.' })
  }
  if (message.length < 5) {
    return res.status(400).json({ error: 'Message must be at least 5 characters.' })
  }
  if (isDuplicateSubmission(req, 'contact', [emailRaw, subject, message.slice(0, 300)])) {
    return res.status(409).json({
      error: 'Duplicate submission detected. Your message was already received — please wait a couple of minutes before sending again.'
    })
  }

  const turnstileCheck = await verifyTurnstileToken(req, req.body.turnstileToken)
  if (!turnstileCheck.ok) {
    return res.status(turnstileCheck.status || 400).json({ error: turnstileCheck.error })
  }

  const endpoint = process.env.FORMSPREE_CONTACT_ENDPOINT || 'https://formspree.io/f/mwvgzpwa'
  try {
    await forwardToFormspree(endpoint, {
      name: name || 'Website Visitor',
      email: emailRaw,
      subject,
      message,
      source
    })
    return res.status(200).json({ ok: true, message: 'Message delivered successfully.' })
  } catch (err) {
    console.error('[api/contact] Delivery error:', err)
    return res.status(502).json({
      error: 'Unable to deliver message right now. Please try again or email support@paper5.co.'
    })
  }
}
