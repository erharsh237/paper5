# Subprocessors Directory

**Effective Date:** November 12, 2026  
**Last Updated:** November 12, 2026

To provide, secure, and operate Paper5 (`https://paper5.co` and `https://app.paper5.co`), Paper5 contracts with third-party service providers ("Subprocessors") that process certain data on our behalf. 

Before engaging any subprocessor, Paper5 evaluates their privacy practices, data handling protocols, and technical security posture. Each vendor is bound by formal Data Processing Agreements (DPAs) incorporating standard contractual clauses (SCCs) and strict confidentiality obligations.

---

## 1. Core Cloud Infrastructure, Authentication & Security

| Subprocessor | Corporate Entity & Location | Processing Activity & Purpose | Data Processed | Data Location |
| :--- | :--- | :--- | :--- | :--- |
| **Supabase** | Supabase, Inc.<br>United States | Cloud PostgreSQL database, user authentication & OTP verification, Row-Level Security (RLS) enforcement, and realtime websockets. | User credentials, account emails, workspace content, tasks, sprints, and meeting records. | United States / Global Edge |
| **Vercel** | Vercel Inc.<br>United States | Global Content Delivery Network (CDN), application hosting, static asset serving, and serverless compute (`/api/*`). | Encrypted web requests, transient serverless function execution payload, and IP headers. | Global Edge Network |
| **Cloudflare** | Cloudflare, Inc.<br>United States | DNS management, Distributed Denial of Service (DDoS) mitigation, Web Application Firewall (WAF), and Cloudflare Turnstile bot verification. | Network telemetry, client IP address, HTTP request headers, and bot challenge tokens. | Global Edge Network |

---

## 2. Communications, Support & Error Monitoring

| Subprocessor | Corporate Entity & Location | Processing Activity & Purpose | Data Processed | Data Location |
| :--- | :--- | :--- | :--- | :--- |
| **Formspree** | Formspree, Inc.<br>United States | Form ingestion gateway routing public contact messages, enterprise sales inquiries, and user feedback submissions to support staff. | Contact name, work email address, company name, inquiry subject, message body, and user rating. | United States |
| **Resend / EmailJS** | Resend, Inc. / EmailJS<br>United States | Transactional email delivery service for workspace invitations, password reset verification links, and assignment alerts. | Recipient email address, recipient name, notification message subject, and email delivery status. | United States |
| **Sentry** | Functional Software, Inc.<br>United States | Automated error monitoring, stack trace capture, and crash diagnostic telemetry to identify application bugs. | Anonymized application crash logs, user-agent details, error traces, and diagnostic metadata. | United States |

---

## 3. Analytics & Telemetry (Consent-Gated Only)

*The following services are strictly consent-gated. They never execute or set tracking cookies unless a visitor explicitly selects "Accept All" or activates Analytics within our Cookie Preferences modal.*

| Subprocessor | Corporate Entity & Location | Processing Activity & Purpose | Data Processed | Data Location |
| :--- | :--- | :--- | :--- | :--- |
| **Google LLC** | Google LLC<br>United States | Google Tag Manager (`GTM-TT5LW9Z7`) and Google Analytics 4 (`G-PKKZJXS8FX`) for aggregate website navigation and traffic measurement with IP anonymization enabled. | Pseudonymous client identifiers, visited page paths, referral sources, device types, and general geographical region. | United States / Global |
| **Vercel Web Analytics** | Vercel Inc.<br>United States | Real User Monitoring (RUM) and Core Web Vitals performance telemetry for page speed and usability monitoring. | Aggregated, non-personally identifiable page load speeds, screen dimensions, and browser versions. | Global Edge |

---

## 4. Payment Gateway & Merchant Services

| Subprocessor | Corporate Entity & Location | Processing Activity & Purpose | Data Processed | Data Location |
| :--- | :--- | :--- | :--- | :--- |
| **Razorpay** | Razorpay Software Private Limited<br>India | Payment gateway processing for workspace subscription plans, billing management, and transaction reconciliation. | Billing contact name, billing email, invoice address, transaction amounts, subscription tier, and masked card identifiers. Paper5 never stores complete card numbers or CVV codes. | India |

---

## 5. Optional User-Connected Workspace Integrations

Workspace administrators may voluntarily connect external third-party tools to automate sprint and developer workflows. Data exchanged through these integrations is transmitted strictly at the direction of the workspace administrator:

- **GitHub, Inc. (Microsoft Corporation):** Pull request links, commit statuses, branch references, and repository issue sync.
- **Google Calendar (Google LLC):** Meeting synchronization and sprint deadline milestone calendar integration.
- **Discord Inc. / Slack Technologies, LLC (Salesforce, Inc.):** Outgoing webhook notifications and team channel broadcast alerts.

---

## 6. Subprocessor Updates & Inquiries

We notify workspace owners prior to the onboarding of any new subprocessor that will handle customer data. Workspace owners may subscribe to subprocessor notifications or submit inquiries regarding our subprocessor compliance by emailing **support@paper5.co**.
