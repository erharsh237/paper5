import { createClient } from '@supabase/supabase-js'
import { setCorsHeaders } from './_cors.js'
import { checkRateLimit } from './_rateLimit.js'
import {
  sanitizeText,
  isValidEmail,
  isHoneypotTriggered,
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

const ALLOWED_CATEGORIES = new Set([
  'Feedback',
  'Feature Request',
  'Bug Report',
  'UI/UX Feedback',
  'General Feedback'
])

export async function handleContact(req, res) {
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

export async function handleFeedback(req, res) {
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

export async function handleForgotPassword(req, res) {
  setCorsHeaders(req, res)
  res.setHeader('Content-Type', 'application/json')
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (checkRateLimit(req, res, { max: 5, windowMs: 900000 })) {
    return
  }
  if (isHoneypotTriggered(req.body)) {
    return res.status(400).json({ error: 'Submission rejected by spam protection.' })
  }

  const turnstileCheck = await verifyTurnstileToken(req, req.body?.turnstileToken)
  if (!turnstileCheck.ok) {
    return res.status(turnstileCheck.status || 400).json({ error: turnstileCheck.error })
  }

  const { email } = req.body || {}
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' })
  }

  const cleanEmail = email.trim().toLowerCase()
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://sdbglndhjkqhkphzqmum.supabase.co'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const resendApiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY

  if (!serviceKey) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey)

  try {
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .ilike('email', cleanEmail)
      .maybeSingle()

    void userProfile

    const targetRedirect = 'https://app.paper5.co/auth/action'

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: cleanEmail,
      options: {
        redirectTo: targetRedirect
      }
    })

    if (linkErr || !linkData?.properties) {
      return res.status(404).json({ error: 'No account found with this email address.' })
    }

    const tokenHash = linkData?.properties?.hashed_token
    const emailOtp = linkData?.properties?.email_otp
    let rawToken = ''
    try {
      if (linkData?.properties?.action_link) {
        const u = new URL(linkData.properties.action_link)
        rawToken = u.searchParams.get('token') || ''
      }
    } catch (_) {}

    const params = new URLSearchParams()
    if (tokenHash) params.set('token_hash', tokenHash)
    if (rawToken) params.set('token', rawToken)
    if (emailOtp) params.set('otp', emailOtp)
    params.set('email', cleanEmail)
    params.set('type', 'recovery')

    const actionLink = `https://app.paper5.co/auth/action?${params.toString()}`

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827; margin: 0; padding: 24px; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .title { font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 16px 0; }
          .btn { display: inline-block; background: #10b981; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 24px 0; }
          .link-fallback { word-break: break-all; font-size: 12px; color: #6b7280; margin-top: 16px; }
          .footer { font-size: 12px; color: #9ca3af; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2 class="title">Reset Your Password 🔐</h2>
          <p>We received a request to reset the password for your SprintOS account (<strong>${cleanEmail}</strong>).</p>
          
          <a href="${actionLink}" class="btn" target="_blank" rel="noopener noreferrer">Reset Password &rarr;</a>

          <p style="font-size: 13px; color: #4b5563;">This link will expire in 24 hours. If you did not request a password reset, you can safely ignore this email.</p>

          <div class="link-fallback">
            If the button above does not work, copy and paste this link into your browser:<br>
            <a href="${actionLink}" style="color: #10b981;">${actionLink}</a>
          </div>

          <div class="footer">
            SprintOS Technologies · Security & Account Management
          </div>
        </div>
      </body>
      </html>
    `

    const textBody = `Reset Your Password\n\nWe received a request to reset the password for your SprintOS account (${cleanEmail}).\n\nClick the link below to set a new password:\n${actionLink}\n\nThis link will expire in 24 hours. If you did not request this, you can ignore this email.`

    let emailSentViaResend = false
    if (resendApiKey) {
      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: process.env.SENDER_EMAIL || 'Paper5 <onboarding@resend.dev>',
            to: [cleanEmail],
            subject: 'Reset your Paper5 password',
            html: htmlBody,
            text: textBody
          })
        })

        const resendJson = await resp.json()
        if (resp.ok && resendJson?.id) {
          emailSentViaResend = true
        } else {
          console.warn('Resend dispatch notice (falling back to Supabase auth):', resendJson)
        }
      } catch (rErr) {
        console.warn('Resend fetch exception:', rErr)
      }
    }

    if (!emailSentViaResend) {
      try {
        const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || serviceKey
        const supabaseAnon = createClient(supabaseUrl, anonKey)
        await supabaseAnon.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: targetRedirect
        })
      } catch (sbErr) {
        console.warn('Supabase resetPasswordForEmail notice:', sbErr)
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Password reset link sent'
    })
  } catch (err) {
    console.error('Password reset handler exception:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

function parseCookieTheme(req) {
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').toLowerCase()
  const isAppHost = host.startsWith('app.')
  const targetCookie = isAppHost ? 'p5_app_theme' : 'p5_marketing_theme'
  const rawCookie = String(req.headers?.cookie || '')
  for (const part of rawCookie.split(';')) {
    const [k, v] = part.trim().split('=')
    if (k === targetCookie && (v === 'dark' || v === 'light')) {
      return v
    }
  }
  return 'light'
}

export function handleNotFound(req, res) {
  const initialTheme = parseCookieTheme(req)

  res.statusCode = 404
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  res.setHeader('Cache-Control', 'no-store')

  res.end(`<!doctype html>
<html lang="en" data-theme="${initialTheme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>404 Page Not Found | Paper5</title>
  <meta name="robots" content="noindex, nofollow" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=2" />
  <script>
    (function () {
      try {
        var host = window.location.hostname || '';
        var key = host.indexOf('app.') === 0 ? 'paper5_app_theme' : 'paper5_marketing_theme';
        var saved = localStorage.getItem(key);
        if (saved === 'dark' || saved === 'light') {
          document.documentElement.setAttribute('data-theme', saved);
        }
      } catch (_) {}
    })();
  </script>
  <style>
    :root {
      color-scheme: light;
      --bg-void: #fafafa;
      --bg-card: #ffffff;
      --border-card: #e4e4f0;
      --border-divider: #f4f4f5;
      --text-primary: #09090b;
      --text-secondary: #52525b;
      --cta-bg: #09090b;
      --cta-text: #ffffff;
      --badge-text: #dc2626;
      --badge-bg: #fef2f2;
      --badge-border: #fecaca;
      --card-shadow: 0 12px 32px rgba(0, 0, 0, 0.05);
    }
    html[data-theme="dark"] {
      color-scheme: dark;
      --bg-void: #09090b;
      --bg-card: #18181b;
      --border-card: #27272a;
      --border-divider: #27272a;
      --text-primary: #f4f4f5;
      --text-secondary: #a1a1aa;
      --cta-bg: #ffffff;
      --cta-text: #09090b;
      --badge-text: #f87171;
      --badge-bg: rgba(239, 68, 68, 0.14);
      --badge-border: rgba(239, 68, 68, 0.35);
      --card-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: var(--bg-void);
      color: var(--text-primary);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .nf-card {
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 16px;
      padding: 40px 36px;
      max-width: 460px;
      width: 100%;
      text-align: center;
      box-shadow: var(--card-shadow);
    }
    .nf-brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-size: 18px;
      letter-spacing: -0.02em;
      margin-bottom: 20px;
      color: var(--text-primary);
      text-decoration: none;
    }
    .nf-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--badge-text);
      background: var(--badge-bg);
      border: 1px solid var(--badge-border);
      border-radius: 9999px;
      padding: 4px 12px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 8px;
      line-height: 1.3;
    }
    p {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.6;
      margin: 0 0 24px;
    }
    .nf-cta {
      display: inline-block;
      background: var(--cta-bg);
      color: var(--cta-text);
      font-size: 13.5px;
      font-weight: 600;
      text-decoration: none;
      padding: 10px 22px;
      border-radius: 8px;
    }
    .nf-cta:hover { opacity: 0.88; }
    .nf-links {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 16px;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--border-divider);
    }
    .nf-links a {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      text-decoration: none;
    }
    .nf-links a:hover { color: var(--text-primary); text-decoration: underline; }
  </style>
</head>
<body>
  <main class="nf-card">
    <a href="/" class="nf-brand">
      <img src="/logo.png" alt="" aria-hidden="true" width="26" height="26" />
      <span>PAPER5</span>
    </a>
    <div><span class="nf-badge">404 &middot; Not Found</span></div>
    <h1>This page missed its deadline.</h1>
    <p>The page you are looking for does not exist or may have been moved.</p>
    <a href="/" class="nf-cta">Back to Homepage &rarr;</a>
    <nav class="nf-links" aria-label="Public navigation">
      <a href="/features">Features</a>
      <a href="/pricing">Pricing</a>
      <a href="/docs">Documentation</a>
      <a href="/contact">Contact</a>
    </nav>
  </main>
</body>
</html>`)
}
