# Privacy Policy

**Last Updated:** August 2026

Paper5, registered in Punjab, India (referred to as the "Data Fiduciary", "we", "us", or "our"), is committed to protecting the privacy of our users ("Data Principals", "you"). This Privacy Policy explains how we collect, use, process, and protect your personal data when you use the SprintOS SaaS platform ("Service"), in compliance with the Digital Personal Data Protection Act, 2023 (DPDP) and other applicable privacy laws.

## 1. Information We Collect

We only collect information necessary to provide and secure the Service.

- **Account Data:** When you sign up, we collect your email address, display name, and profile picture (if using Google Auth).
- **Workspace Data:** You and your team may upload tasks, meeting notes, evidence files, and organizational structures. 
- **Integration Credentials:** If you connect third-party integrations (e.g., GitHub, Google Calendar, Discord, Vercel), we securely collect and store the access tokens required to communicate with those APIs on your behalf.
- **Technical & Usage Data:** We automatically collect standard diagnostic data (e.g., IP addresses, device types) via our infrastructure provider to maintain the security and stability of the Service.

## 2. Cookies and Tracking

**Current Cookie Usage:** SprintOS currently uses **only strictly necessary session cookies** (provided by Firebase Authentication) to keep you logged in and secure your session. 
*(Note: If analytics or non-essential tracking tools are added in the future, this policy must be updated and a Cookie Consent Manager implemented).*

## 3. How We Use Your Data

As a Data Fiduciary, we use your data strictly for the following purposes:
- To operate, maintain, and provide the features of the Service.
- To facilitate third-party API requests you explicitly initiate (e.g., fetching GitHub PRs or Google Calendar events).
- To send transactional emails (e.g., sprint reminders, email verification).
- To process subscription billing (via Stripe).

## 4. Data Processors and Third Parties

We do not sell your personal data. We share data only with authorized Data Processors who help us operate the Service. These processors are contractually bound to secure your data:
- **Google Cloud / Firebase:** For hosting, database (Firestore), authentication, and cloud functions.
- **Stripe:** For processing payments. We do not store your credit card details on our servers.
- **Integration Providers:** If you connect third-party apps (e.g., GitHub, Slack), data flows to those platforms according to their respective privacy policies.

For a full list of processors, please view our [Subprocessors List](/legal/subprocessors).

## 5. Your Rights as a Data Principal

Under the DPDP Act and similar frameworks (like GDPR), you have the right to:
- **Right to Access:** Obtain a summary of the personal data we hold about you. Workspace Owners can export a full `.json` copy of their Workspace data from the Settings page.
- **Right to Correction and Erasure:** You can update your profile information in the app. Workspace Owners can permanently delete their entire Workspace (which triggers a recursive, irreversible deletion of all tasks, notes, and credentials). You may also request deletion of your individual account by contacting us.
- **Right to Grievance Redressal:** You have the right to register a grievance with us regarding the processing of your data.

## 6. Data Security and Retention

We implement robust security measures, including logical tenant isolation via Firestore Security Rules, ensuring users cannot access data outside their authorized Workspaces. Personal integration tokens are strictly scoped to the individual user. We retain your data only as long as your account or Workspace is active, or as required by law.

## 7. Contact Us / Grievance Officer

If you have questions about this Privacy Policy or wish to exercise your rights, please contact our Grievance Officer at:
**Email:** support@paper5.com
**Address:** Paper5, Ludhiana, India
