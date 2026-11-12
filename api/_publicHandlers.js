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
  <title>404 &mdash; Are you lost? | Paper5</title>
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
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #ffffff;
      color: #09090b;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      padding: 40px 24px;
      user-select: none;
    }
    html[data-theme="dark"] body {
      background-color: #09090b;
      color: #f4f4f5;
    }
    .lost-404-container {
      width: 100%;
      max-width: 1140px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: min(720px, 86vh);
      position: relative;
    }
    .lost-404-topbar {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      width: 100%;
      padding: 0 10px;
    }
    .lost-404-heading-left,
    .lost-404-heading-right {
      font-size: clamp(38px, 5.5vw, 68px);
      font-weight: 700;
      letter-spacing: -0.035em;
      line-height: 1;
      color: #09090b;
    }
    html[data-theme="dark"] .lost-404-heading-left,
    html[data-theme="dark"] .lost-404-heading-right {
      color: #ffffff;
    }
    .lost-404-stage {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      margin: 20px 0 10px 0;
      gap: 20px;
    }
    .lost-digit {
      font-size: clamp(140px, 26vw, 360px);
      font-weight: 800;
      line-height: 0.88;
      letter-spacing: -0.06em;
      color: #09090b;
      flex: 1;
      text-align: center;
    }
    html[data-theme="dark"] .lost-digit {
      color: #f4f4f5;
    }
    .lost-digit-left {
      text-align: right;
      padding-right: clamp(10px, 2vw, 40px);
    }
    .lost-digit-right {
      text-align: left;
      padding-left: clamp(10px, 2vw, 40px);
    }
    .lost-center-icon-wrap {
      flex-shrink: 0;
      width: clamp(120px, 18vw, 240px);
      height: clamp(130px, 20vw, 260px);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .lost-center-svg {
      width: 100%;
      height: 100%;
      filter: drop-shadow(0 16px 28px rgba(0, 0, 0, 0.08));
    }
    html[data-theme="dark"] .lost-poly-outer { fill: #f4f4f5; }
    html[data-theme="dark"] .lost-poly-inner { fill: #09090b; }
    @keyframes dotPulseNotice {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.15); opacity: 0.85; }
    }
    .lost-focal-dot {
      fill: #e11d48;
      transform-origin: 136px 110px;
      animation: dotPulseNotice 2.4s ease-in-out infinite;
    }
    .lost-404-bottom {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      width: 100%;
      padding: 0 10px;
      position: relative;
    }
    .lost-bracket {
      font-size: clamp(48px, 6vw, 90px);
      font-weight: 300;
      color: #09090b;
      line-height: 0.8;
      user-select: none;
    }
    html[data-theme="dark"] .lost-bracket { color: #ffffff; }
    .lost-action-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 14px;
      margin-bottom: 8px;
    }
    .lost-desc {
      font-size: clamp(13px, 1.1vw, 15px);
      color: #52525b;
      margin: 0;
      font-weight: 500;
      letter-spacing: -0.01em;
    }
    html[data-theme="dark"] .lost-desc { color: #a1a1aa; }
    .lost-cta-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background-color: #e11d48;
      color: #ffffff !important;
      text-decoration: none;
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 10px 22px;
      border-radius: 9999px;
      box-shadow: 0 8px 20px -4px rgba(225, 29, 72, 0.4);
      transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease, box-shadow 0.22s ease;
      cursor: pointer;
    }
    .lost-cta-btn:hover {
      background-color: #be123c;
      transform: translateY(-2px);
      box-shadow: 0 12px 26px -4px rgba(225, 29, 72, 0.55);
    }
    .lost-cta-plus {
      font-size: 14px;
      font-weight: 800;
      line-height: 1;
    }
    @media (max-width: 640px) {
      .lost-404-container { min-height: 520px; justify-content: space-around; }
      .lost-digit-left { padding-right: 0; }
      .lost-digit-right { padding-left: 0; }
      .lost-bracket { font-size: 40px; }
      .lost-action-center { gap: 12px; }
    }
  </style>
</head>
<body>
  <div class="lost-404-container">
    <div class="lost-404-topbar">
      <span class="lost-404-heading-left">Are you</span>
      <span class="lost-404-heading-right">lost?</span>
    </div>

    <div class="lost-404-stage">
      <div class="lost-digit lost-digit-left">4</div>

      <div class="lost-center-icon-wrap" role="img" aria-label="Geometric 404 block with locator dot">
        <svg
          class="lost-center-svg"
          viewBox="0 0 200 220"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M75 10 H145 V50 H175 V130 H155 V150 H175 V180 H145 V200 H75 V180 H45 V150 H20 V90 H45 V50 H75 V10 Z"
            fill="#09090b"
            class="lost-poly-outer"
          />
          <path
            d="M75 42 H135 V85 H145 V145 H125 V168 H75 V145 H52 V85 H75 V42 Z"
            fill="#ffffff"
            class="lost-poly-inner"
          />
          <circle
            cx="136"
            cy="110"
            r="18"
            fill="#e11d48"
            class="lost-focal-dot"
          />
        </svg>
      </div>

      <div class="lost-digit lost-digit-right">4</div>
    </div>

    <div class="lost-404-bottom">
      <span class="lost-bracket lost-bracket-left">[</span>

      <div class="lost-action-center">
        <p class="lost-desc">The page you were looking for is not found.</p>
        <a href="/" class="lost-cta-btn">
          <span class="lost-cta-plus">+</span>
          <span>GO BACK HOME</span>
        </a>
      </div>

      <span class="lost-bracket lost-bracket-right">]</span>
    </div>
  </div>
</body>
</html>`)
}
