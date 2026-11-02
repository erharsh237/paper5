import React from 'react'
import MarketingContentPage from './MarketingContentPage'

export function Changelog() {
  return (
    <MarketingContentPage title="Changelog" lastUpdated="Oct 14, 2026">
      <h2>October 2026</h2>
      <ul>
        <li>Added new multi-column footer layout.</li>
        <li>Introduced strict email verification routing.</li>
        <li>Overhauled landing page branding with new logo.</li>
      </ul>
      <h2>September 2026</h2>
      <ul>
        <li>Launched Paper5 2.0.</li>
        <li>Added automated Slack standups.</li>
      </ul>
    </MarketingContentPage>
  )
}

export function Documentation() {
  return (
    <MarketingContentPage title="Documentation" lastUpdated="Sep 01, 2026">
      <h2>Getting Started</h2>
      <p>Welcome to Paper5. To get started, create a workspace and invite your team. You can then connect your GitHub repository from the integrations tab.</p>
      <h2>Sprint Management</h2>
      <p>Sprints are time-boxed iterations. Any tasks left unfinished when the deadline hits will automatically roll over to the next sprint to ensure nothing is dropped.</p>
    </MarketingContentPage>
  )
}

export function ApiReference() {
  return (
    <MarketingContentPage title="API Reference" lastUpdated="Aug 15, 2026">
      <h2>Authentication</h2>
      <p>All API endpoints require a Bearer token. You can generate a personal access token from your profile settings.</p>
      <h3>GET /api/v1/workspaces</h3>
      <p>Returns a list of all workspaces your account has access to.</p>
      <h3>POST /api/v1/tasks</h3>
      <p>Creates a new task in the active sprint.</p>
    </MarketingContentPage>
  )
}



export function Security() {
  return (
    <MarketingContentPage title="Security & Data Protection" lastUpdated="Nov 02, 2026">
      <h2>Built with Security & Privacy by Design</h2>
      <p>Security is fundamental to Paper5. We employ modern defensive engineering, tenant isolation, and strict encryption protocols to safeguard your team's workspace data.</p>
      <ul>
        <li><strong>Tenant Isolation:</strong> Every workspace operates under strict PostgreSQL Row-Level Security (RLS) policies, guaranteeing tenant data cannot be queried across workspace boundaries.</li>
        <li><strong>Encryption in Transit & at Rest:</strong> All web traffic is encrypted with TLS 1.3 in transit. Underlying database volumes and backups are encrypted at rest with AES-256.</li>
        <li><strong>Cloud Infrastructure:</strong> Built on top of enterprise AWS cloud infrastructure via Supabase, with automatic failover, daily automated backups, and high availability.</li>
        <li><strong>Access Control & Authentication:</strong> Enforced email verification, cryptographically signed HTTP-only session tokens, and optional Two-Factor Authentication (2FA) via authenticator apps.</li>
        <li><strong>Full Data Portability:</strong> You maintain complete ownership of your team's project records with one-click full vector PDF reports and CSV data export.</li>

      </ul>
    </MarketingContentPage>
  )
}
