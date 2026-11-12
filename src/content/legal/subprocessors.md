# Subprocessors List

**Last Updated:** November 2026

To operate Paper5 (`https://paper5.co` and `https://app.paper5.co`), Paper5 uses the following third-party service providers ("Subprocessors") based on integrations verified in the Paper5 codebase. **[To be confirmed by Paper5: contractual DPA effective dates and exact regional hosting selections configured in vendor dashboards.]**

## Core Infrastructure, Auth & Security

- **Supabase, Inc.**
  - **Purpose:** Managed PostgreSQL database, Row-Level Security (RLS), user authentication, realtime channels, and edge functions.
  - **Region:** **[To be confirmed by Paper5: configured Supabase project region]**

- **Vercel Inc.**
  - **Purpose:** Static asset hosting, serverless API function execution (`/api/*`), and consent-gated Vercel Web Analytics.
  - **Region:** Global Edge Network / Serverless deployment region

- **Cloudflare, Inc.**
  - **Purpose:** Cloudflare Turnstile anti-bot verification on authentication and protected form flows.
  - **Region:** Global Edge Network

## Communications, Forms & Error Monitoring

- **Formspree, Inc.**
  - **Purpose:** Receiving and routing public contact and feedback submissions forwarded from `/api/contact` and `/api/feedback`.

- **Resend / EmailJS**
  - **Purpose:** Sending transactional emails (workspace invitations, password reset links, and deadline assignment alerts).

- **Sentry (Functional Software, Inc.)**
  - **Purpose:** Application error diagnostics (and consent-gated replay/tracing when `VITE_SENTRY_DSN` is configured).

## Analytics (Consent-Gated)

- **Google LLC (Google Analytics 4)**
  - **Purpose:** Optional website usage analytics loaded only when `VITE_GA_MEASUREMENT_ID` is configured and the user grants analytics consent.

## Billing & User-Connected Integrations

- **Razorpay Software Private Limited**
  - **Purpose:** Subscription billing and cancellation webhook integration.
- **User-Enabled Workspace Integrations (Optional):**
  - **GitHub, Inc.** (repository / PR tracking when connected)
  - **Google LLC** (Google OAuth / Google Calendar when connected)
  - **Discord Inc. / Slack Technologies, LLC** (workspace webhook notifications when configured)

## Updates to This List
We update this page when subprocessors are added or removed. For questions, contact **support@paper5.co**.
