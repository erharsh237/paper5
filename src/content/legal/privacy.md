# Privacy Policy

> **DRAFT / TEMPLATE NOTICE — REVIEW REQUIRED BEFORE LEGAL SIGN-OFF:**
> This Privacy Policy is a technical draft prepared from an inspection of the Paper5 (`https://paper5.co` and `https://app.paper5.co`) source code and configuration. It intentionally avoids inventing company registration details, retention schedules, or security certifications. Before publishing in production as your binding legal policy, Paper5 must review this text with legal counsel and complete every **[To be confirmed by Paper5]** section below.

**Last Updated:** November 2026

Paper5 (`https://paper5.co` and `https://app.paper5.co`) provides a collaborative project and task management workspace for small teams. This Privacy Policy describes what information the website and application actually collect and process.

## 1. Information We Collect

### A. Account & Authentication Information
- **Registration and Sign-In (`/signup`, `/login`, `/verify`, `/forgot-password`, `/auth/action`, `/reset-password`):** Email address, username, optional display name, and credentials or one-time verification codes (OTP) managed through **Supabase Auth**.
- **Google OAuth (if chosen):** Basic profile identifiers returned by Google OAuth when signing in with Google.
- **Anti-Bot Verification:** Authentication and public form routes may invoke **Cloudflare Turnstile** (`challenges.cloudflare.com`), which evaluates single-use verification tokens to block automated abuse.

### B. Workspace & Product Activity Data
- **Team Content:** Workspaces, projects/sprints, tasks, deadlines, blocker notices, meeting notes, member roles, invitations (`/join`), and notification read states stored in **Supabase PostgreSQL** under multi-tenant access policies.
- **Profile Photos:** Optional uploaded or OAuth profile avatar images displayed on workspace profiles.
- **Optional Integrations:** If a workspace enables integrations (GitHub, Google Calendar, Discord, Slack, or custom webhooks), the tokens or webhook configurations needed to deliver those requested integrations.

### C. Contact & Feedback Form Submissions
- **Contact Us (`/contact`), Contact Sales Modal, and Give Feedback Modal:** Name, work email address, inquiry subject or feedback category, optional star rating, and message content. Submissions are validated server-side via serverless endpoints (`/api/contact`, `/api/feedback`) and forwarded to Paper5's support inbox via **Formspree**.

### D. Technical Logs, Anti-Spam Rate Limiting & Error Diagnostics
- **Serverless Anti-Spam & Rate-Limit Metadata:** Request IP addresses, endpoint paths, and transient submission fingerprint hashes processed in serverless memory (`_rateLimit.js`, `_formSecurity.js`) to enforce IP rate limits, reject hidden honeypot spam, and block duplicate submissions.
- **Error Monitoring (Sentry):** When configured via `VITE_SENTRY_DSN`, crash diagnostics are sent to **Sentry** to help resolve software errors. Browser session replay is enabled only after analytics consent is granted.

## 2. Cookies, Local Storage & Tracking

### Strictly Necessary Cookies & Storage (Always Active)
To keep accounts signed in safely across `paper5.co` and `app.paper5.co` without storing raw authentication tokens in `localStorage`:
- **Session Cookies (`/api/auth/session`):** `sb_access_token`, `sb_refresh_token`, `sb_expires_at`, `sb_2fa_pending`, and `sb_2fa_email`, set with `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`.
- **Browser Storage (`localStorage` / `sessionStorage`):** Essential preference and workflow state including `p5_cookie_consent` (your cookie consent decision), UI theme preference, selected onboarding plan (`sprintos_selected_plan`), 2FA step state (`sprintos:2fa_pending_email`), cached meeting notes / notification read state, and onboarding flags.

### Optional Analytics & Telemetry (Consent-Gated)
For visitors in the EU, UK, Switzerland, and globally, non-essential analytics scripts **do not load until you click "Accept All" or enable Analytics in Cookie Preferences** (and can be withdrawn at any time via **"Cookie Preferences"** in the website footer):
- **Google Tag Manager (`GTM-TT5LW9Z7`) & Google Analytics 4 (`G-PKKZJXS8FX`):** Dynamically loaded only after consent is granted to measure page views and verified product interactions (`page_view`, `contact_submit`, `form_submit`, `sign_up`, `login`, `pricing_view`, `cta_click`) with IP anonymization enabled. When enabled, Google Analytics may set first-party measurement cookies such as `_ga` and `_ga_*`.
- **Vercel Web Analytics (`@vercel/analytics/react`):** Rendered only after analytics consent for aggregated page and performance telemetry.
- **Live Visitor Presence (`p5_visitor_id`):** Session-scoped identifier used with Supabase Realtime presence only when analytics consent is granted.
- **Sentry Performance Tracing & Session Replay:** Enabled only when analytics consent is granted and Sentry is configured.

## 3. Third-Party Services & Subprocessors

We do not sell your personal information. Depending on the features used and your consent choices, data may be processed by:
- **Supabase Inc.** — Managed PostgreSQL database, authentication, and realtime channels.
- **Vercel Inc.** — Application hosting, serverless API execution, and optional consent-gated Vercel Web Analytics.
- **Google LLC** — Consent-gated Google Tag Manager (`GTM-TT5LW9Z7`) & Google Analytics 4 (`G-PKKZJXS8FX`), optional Google OAuth sign-in, and optional Google Calendar integration.
- **Cloudflare, Inc.** — Network security and optional Cloudflare Turnstile anti-bot verification.
- **Formspree, Inc.** — Form delivery and inbox routing for `/api/contact` and `/api/feedback`.
- **Resend / EmailJS** — Transactional emails (workspace invitations, password resets, and task notifications).
- **Sentry (Functional Software, Inc.)** — Crash and performance diagnostics (when configured).
- **Razorpay Software Private Limited** — Payment and subscription lifecycle processing (card details are not stored on Paper5 servers).

See also our [Subprocessors page](/legal/subprocessors).

## 4. Data Retention & Deletion

- **Account & Workspace Deletion:** Workspace owners can delete workspaces from Settings, and users can request account deletion via in-app flows (`/api/request-account-deletion`, `/api/delete-user`) or by emailing **support@paper5.co**.
- **Anti-Spam Rate-Limit Memory Windows:** Transient IP rate-limit counters and duplicate-submission hashes expire automatically in serverless memory (typically within 2 to 15 minutes).
- **Formspree, Backups & Analytics Retention:** **[To be confirmed by Paper5: exact retention periods for Formspree contact/feedback submissions, Supabase database backups, transactional email logs, and Google Analytics 4 event/user data retention settings.]**

## 5. Visitors in the EU, UK & Switzerland (Privacy Choices)

Visitors in the European Union, United Kingdom, Switzerland, and other regions can accept, reject, or customize optional analytics before Google Tag Manager, Google Analytics 4, Vercel Web Analytics, or live presence scripts load. You can reopen **"Cookie Preferences"** from the footer at any time to withdraw or change consent.

- **EU/UK/Swiss Supervisory & Transfer Safeguards:** **[To be confirmed by Paper5: legal bases summary, International Data Transfer mechanism (e.g., SCCs), and EU/UK representative details if applicable.]**

## 6. Operator & Contact Details

- **Support & Privacy Inquiries:** support@paper5.co
- **Security Disclosures:** security@paper5.co
- **Legal Operator Details:** **[To be confirmed by Paper5: full registered legal entity name, registered street address, jurisdiction of incorporation, and designated Data Protection / Grievance Officer.]**
