# Data Processing Agreement (DPA)

**Last Updated:** August 2026

This Data Processing Agreement ("DPA") forms part of the Terms of Service between Paper5 ("Data Processor") and the customer ("Data Controller" or "Workspace Owner") utilizing the SprintOS Service.

## 1. Definitions
- **Data Controller:** The Workspace Owner determining the purposes and means of processing personal data.
- **Data Processor:** SprintOS processing personal data on behalf of the Data Controller.
- **Personal Data:** Any information relating to an identified or identifiable natural person processed by the Processor on behalf of the Controller.

## 2. Processing of Personal Data & Retention Modes
The Processor shall process Personal Data on behalf of and in accordance with the documented instructions of the Controller. 

- **Standard Cloud Processing (`save_data: true`)**: The Processor hosts, stores, and organizes project management data, tasks, and integration credentials within PostgreSQL database infrastructure protected by Row-Level Security (RLS).
- **User-Selected Ephemeral Processing (`save_data: false`)**: Where the Controller selects Zero-Data Retention Mode, the Processor acts solely as an in-memory execution proxy. Personal Data is processed exclusively within volatile browser session memory and is **not persisted** to backend database storage.

## 3. Security Measures
The Processor shall implement appropriate technical and organizational security measures, including:
- Logical multi-tenant isolation enforced via PostgreSQL Row-Level Security (RLS).
- Session token isolation using `HttpOnly, Secure, SameSite=Strict` cookies.
- Anti-bot challenge validation via Cloudflare Turnstile.
- Cryptographic HMAC-SHA256 signature verification and 5-minute timestamp expiration on webhooks.
- Encryption of data in transit (TLS 1.3) and at rest (AES-256).

## 4. Subprocessors
The Controller grants the Processor general authorization to engage Subprocessors. The current list of Subprocessors is maintained at [Subprocessors List](/legal/subprocessors). The Processor will impose data protection terms on any Subprocessor it engages that protect Personal Data to the same standard provided for by this DPA.

## 5. Data Subject Requests
The Processor shall assist the Controller in fulfilling Data Subject rights by providing self-service tools (such as Workspace JSON/PDF exports and permanent Workspace deletion) within the Service.

## 6. Personal Data Breach
In the event of a personal data breach affecting Controller data, the Processor shall notify the Controller without undue delay after becoming aware of the breach.

## 7. Deletion or Return of Data
Upon termination of the Service or upon Workspace deletion by the Controller, the Processor shall delete all Personal Data from active databases. For Workspaces operating in Zero-Data Retention Mode, data is deleted automatically upon browser session termination.

## 8. Governing Law
This DPA shall be governed by the laws stipulated in the Terms of Service.
