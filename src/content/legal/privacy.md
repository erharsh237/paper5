# Privacy Policy

**Last Updated:** August 2026

Paper5, registered in Punjab, India (referred to as the "Data Fiduciary", "we", "us", or "our"), is committed to protecting the privacy of our users ("Data Principals", "you"). This Privacy Policy explains how we collect, use, process, and protect your personal data when you use the SprintOS SaaS platform ("Service"), in compliance with the Digital Personal Data Protection Act, 2023 (DPDP) and applicable global privacy regulations.

## 1. Information We Collect

We only collect information necessary to operate, secure, and provide the Service:

- **Account & Security Data:** When you sign up, we collect your email address, display name, and authentication tokens. Authentication forms are protected by **Cloudflare Turnstile**, which processes non-invasive bot challenge tokens and telemetry data to prevent automated attacks.
- **Workspace Data:** You and your team may upload tasks, meeting notes, sprint deadlines, and organizational structures. If **Zero-Data Retention Mode** is selected, workspace content is processed transiently in browser session memory and is not stored in our backend database.
- **Integration Credentials:** If you connect third-party integrations (e.g., GitHub, Google Calendar, Discord, Vercel), we securely store the access tokens required to communicate with those APIs on your behalf.
- **Technical & Security Logs:** We collect diagnostic logs (e.g., IP addresses, device user agents) for security audit trails and sliding-window rate limiting (`rate_limit_log`).

## 2. Cookies, Session Tokens, and Security

**Session Token Security:** SprintOS uses strictly necessary `HttpOnly, Secure, SameSite=Strict` cookies (`sb_access_token`, `sb_refresh_token`) and in-memory heap storage (`inMemoryStorage`) to maintain secure session state. Tokens are kept out of `localStorage` to eliminate XSS token exfiltration vulnerabilities.

**Anti-Bot Security:** We use Cloudflare Turnstile (`challenges.cloudflare.com`) to evaluate challenge tokens on authentication pages. Turnstile operates without tracking cookies or personal profiling.

## 3. How We Use Your Data

As a Data Fiduciary, we use your data strictly for the following purposes:
- To operate, maintain, and provide the features of the Service.
- To enforce multi-tenant isolation and Row-Level Security (RLS) policies.
- To process subscription billing and invoices via **Razorpay**.
- To execute automated security rate limiting and account lockout protections.

## 4. Data Processors and Third Parties

We do not sell your personal data. We share data only with authorized Data Processors who assist in operating the Service:
- **Supabase Inc.:** Managed PostgreSQL database, authentication, and realtime API backend.
- **Vercel Inc.:** Frontend hosting and serverless function execution.
- **Cloudflare, Inc.:** Anti-bot challenge validation and edge WAF security.
- **Razorpay Software Private Limited:** Subscription payment processing. We do not store payment card details on our servers.

For a complete list, view our [Subprocessors List](/legal/subprocessors).

## 5. Your Rights as a Data Principal

Under the DPDP Act and global frameworks, you have the right to:
- **Right to Access & Data Ownership:** Obtain a summary or full JSON/PDF export of your Workspace data from Workspace Settings.
- **Right to Erasure:** Workspace Owners can permanently delete their entire Workspace, triggering an irreversible deletion of all stored database records.
- **Zero-Data Retention Choice:** Opt out of cloud database storage by enabling Zero-Data Retention Mode.

## 6. Contact Us / Grievance Officer

If you have questions about this Privacy Policy or wish to exercise your rights, please contact our Grievance Officer at:
**Email:** support@paper5.co  
**Address:** Paper5, Ludhiana, Punjab, India
