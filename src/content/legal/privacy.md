# Privacy Policy

**Effective Date:** November 12, 2026  
**Last Updated:** November 12, 2026

Paper5 ("Paper5", "we", "us", or "our"), operating at `https://paper5.co` and `https://app.paper5.co`, provides a collaborative project and task management workspace engineered for startups, engineering teams, and small organizations.

This Privacy Policy explains how we collect, use, disclose, protect, and retain personal information when you visit our website, register for an account, access our workspaces, or communicate with our support and sales teams.

---

## 1. Information We Collect

### A. Account & Authentication Information
When you create an account, sign in, or manage your profile (`/signup`, `/login`, `/verify`, `/forgot-password`, `/auth/action`, `/reset-password`):
- **User Credentials & Identifiers:** Email address, username, optional full name, account creation date, and authentication factors (including one-time password / OTP verification tokens).
- **Federated Authentication (Google OAuth):** If you choose to authenticate using Google, we receive your verified Google email address, account name, and profile avatar URL directly from Google OAuth scopes.
- **Anti-Bot & Verification Metadata:** Public authentication and contact routes incorporate Cloudflare Turnstile to distinguish real users from automated malicious scrapers. Single-use challenge validation tokens are processed to safeguard our infrastructure.

### B. Workspace, Sprint & Collaboration Content
When using the Paper5 workspace application:
- **Workspaces & Memberships:** Workspace names, member email addresses, assigned workspace roles (`Owner`, `Admin`, `Member`, `Collaborator`), invitations, and audit log entries.
- **Project & Task Content:** Agile sprints, workflow columns, task titles, descriptions, due dates, owner assignments, milestone tags, deliverable proof attachments/URLs, and blocker status reports.
- **Meeting Notes & Action Items:** Meeting titles, attendee lists, synchronized notes, linked action items, and deadline records.
- **Notification State:** Read/unread flags, delivery timestamps, and alert notification triggers.

### C. Contact & Feedback Form Submissions
When you submit an inquiry through `/contact`, the Contact Sales modal, or the in-app Feedback modal:
- Name, work email address, company name, subject, inquiry category, feedback message text, and optional user satisfaction rating.
- Form submissions are processed through our serverless security gateway (`/api/contact`, `/api/feedback`) and forwarded securely to our support queue via Formspree.

### D. Technical Logs, Security & Rate-Limiting Data
- **Anti-Spam & Network Integrity:** Transient request IP addresses, endpoint paths, user-agent headers, and cryptographic submission hashes processed in volatile serverless memory (`_rateLimit.js`, `_formSecurity.js`) to block denial-of-service attempts, spam bots, and duplicate requests.
- **Error Diagnostics:** In the event of application failures, diagnostic crash logs and stack traces are captured via Sentry to detect and remediate bugs.

---

## 2. Cookies, Local Storage & Privacy Preferences

Paper5 adheres to privacy-by-design standards. We distinguish between strictly necessary technical cookies and optional measurement tools.

### Strictly Necessary Cookies & Storage (Always Active)
These technologies are required for core site functionality, security, and authentication, and cannot be disabled:
- **Secure Authentication Cookies:** Managed via `/api/auth/session` with `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/` flags (`sb_access_token`, `sb_refresh_token`, `sb_expires_at`, `sb_2fa_pending`, `sb_2fa_email`). These securely maintain authenticated sessions without exposing raw JWTs to malicious browser extensions.
- **Local Browser Storage (`localStorage` / `sessionStorage`):** Essential local preferences including your cookie consent choices (`p5_cookie_consent`), UI dark/light theme preference, selected subscription plan during signup (`sprintos_selected_plan`), multi-factor authentication handshake state, and offline draft caching.

### Optional Analytics & Telemetry (Consent-Gated Only)
Optional analytics and telemetry scripts are **blocked by default** and will never execute until you provide explicit consent via our Cookie Preferences banner:
- **Google Tag Manager (`GTM-TT5LW9Z7`) & Google Analytics 4 (`G-PKKZJXS8FX`):** Loaded only upon explicit consent to measure aggregated site visits, navigation flows, and conversion metrics with IP anonymization enabled.
- **Vercel Web Analytics (`@vercel/analytics/react`):** Privacy-friendly aggregated page performance and web vitals tracking loaded only when analytics consent is enabled.
- **Live Visitor Presence (`p5_visitor_id`):** Realtime workspace collaborator presence channels loaded only with active user consent.
- **Sentry Performance Tracing & Replay:** Performance traces and user experience replays are restricted strictly to consent-granted sessions.

You can modify or withdraw your consent at any time by clicking **"Cookie Preferences"** in the footer of any page.

---

## 3. How We Use Your Information

Paper5 processes personal data exclusively for lawful business and operational purposes:
1. **To Provide the Service:** Operating your workspaces, persisting tasks, authenticating team members, synchronizing sprint boards, and delivering verified deliverables.
2. **To Ensure Account & Platform Security:** Preventing credential stuffing, enforcing role-based permissions, monitoring system health, and defending against automated abuse.
3. **To Communicate With You:** Sending critical transactional notifications, workspace invitations, password reset links, security alerts, and responding to support tickets.
4. **To Process Payments:** Facilitating subscription billing, upgrades, and renewals through PCI-DSS Level 1 certified payment gateways.
5. **To Comply With Legal Obligations:** Maintaining necessary financial transaction records and fulfilling legitimate regulatory or judicial requests.

**We never sell, rent, trade, or monetize your personal information or workspace content.**

---

## 4. Subprocessors and Third-Party Sharing

We share data with third-party service providers ("Subprocessors") solely to provide, secure, and maintain the platform. All subprocessors are subject to strict data protection agreements ensuring confidentiality, security, and compliance with applicable data protection laws.

Our active subprocessor directory is maintained at [Subprocessors](/legal/subprocessors) and includes:
- **Supabase Inc.** — Managed PostgreSQL database with Row-Level Security, authentication infrastructure, and realtime channels.
- **Vercel Inc.** — Global edge network hosting, CDN, and serverless compute execution.
- **Cloudflare, Inc.** — DNS management, DDoS mitigation, and Cloudflare Turnstile bot verification.
- **Formspree, Inc.** — Secure form gateway for contact inquiries and user feedback.
- **Resend / EmailJS** — Transactional email delivery for invitations, password resets, and notifications.
- **Sentry (Functional Software, Inc.)** — Error monitoring and software crash diagnostics.
- **Razorpay Software Private Limited** — Secure payment processing and subscription billing. Paper5 never stores complete credit card numbers or banking secrets.

### User-Directed Integrations
If your workspace administrator elects to connect optional third-party integrations (e.g., GitHub, Google Calendar, Discord, Slack, or custom webhooks), we exchange the necessary authorization tokens to execute actions explicitly requested by your team.

---

## 5. Data Retention & Deletion

- **Active Workspace Data:** Stored for as long as your workspace remains active.
- **Zero-Data Retention Mode:** For teams utilizing zero-data persistence mode (`save_data: false`), workspace content is processed strictly in temporary client browser memory and is never written to backend databases.
- **Account & Workspace Deletion:** Workspace owners can permanently delete workspaces directly within Workspace Settings. Users may delete their user account via the in-app deletion flow (`/api/delete-user`, `/api/request-account-deletion`) or by emailing `support@paper5.co`. Upon verified request, personal data and workspace databases are permanently purged within 30 days, except where retention is required by applicable tax or financial auditing laws.
- **Transient Security & Rate-Limit Logs:** In-memory rate limiting and anti-spam submission hashes expire automatically within 2 to 15 minutes.
- **System Backups:** Encrypted database backups are cycled and purged on a standard 30-day rolling retention cycle.

---

## 6. International Data Transfers & Global Privacy Rights

Paper5 provides services globally. Data may be stored and processed in servers located in the United States, India, or European Union depending on regional infrastructure routing. Whenever personal data is transferred internationally, we ensure adequate transfer mechanisms—such as standard contractual clauses (SCCs) and robust encryption in transit (TLS 1.3) and at rest (AES-256)—are in place.

### Your Rights Under GDPR, UK GDPR, and Applicable Privacy Laws
Depending on your jurisdiction, you have the right to:
- **Access & Portability:** Request a copy of the personal information we maintain about you in a structured, machine-readable format.
- **Rectification:** Request corrections to incomplete or inaccurate account details.
- **Erasure ("Right to Be Forgotten"):** Request the permanent deletion of your personal account data.
- **Restriction & Objection:** Object to or restrict the processing of your data under specific statutory circumstances.
- **Withdraw Consent:** Withdraw consent previously granted for analytics and cookies at any time via the Cookie Preferences link.
- **Lodge a Complaint:** Lodge a complaint with your competent supervisory authority.

To exercise any of these rights, contact us at **support@paper5.co**.

---

## 7. Security Safeguards

We implement defense-in-depth organizational, physical, and technical safeguards, including:
- End-to-end transport layer security (HTTPS / TLS 1.3) with HSTS headers.
- Multi-tenant PostgreSQL database isolation enforced by database-level Row Level Security (RLS).
- `HttpOnly`, `Secure`, `SameSite=Lax` authentication token handling.
- Cryptographic password hashing and optional multi-factor authentication (2FA).
- Continuous vulnerability scanning and rate-limited API protection.

---

## 8. Children's Privacy

Paper5 is a workplace productivity service intended for business professionals, founders, and adults aged 18 and older (or the age of majority in your jurisdiction). We do not knowingly solicit or collect personal information from individuals under the age of 16. If we become aware that a child has provided us with personal information, we will take immediate steps to delete such data.

---

## 9. Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect operational, legal, or regulatory modifications. When material changes are introduced, we will notify registered users via in-app notification banners or email prior to the changes taking effect, and update the "Last Updated" date at the top of this page.

---

## 10. Contact Us

If you have questions, feedback, or requests regarding this Privacy Policy or our data protection practices, please contact us:

- **Email:** [support@paper5.co](mailto:support@paper5.co)
- **Security Team:** [security@paper5.co](mailto:security@paper5.co)
- **Official Website:** [https://paper5.co](https://paper5.co)
- **App Portal:** [https://app.paper5.co](https://app.paper5.co)
