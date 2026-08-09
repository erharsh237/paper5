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
    <MarketingContentPage title="Security & Compliance" lastUpdated="Oct 15, 2026">
      <h2>Enterprise-Grade Security</h2>
      <p>Security is not an afterthought at Paper5. It is built into the foundation of our architecture.</p>
      <ul>
        <li><strong>Data Isolation:</strong> Cryptographically isolated workspace environments.</li>
        <li><strong>Compliance:</strong> Powered by SOC2 Type II certified infrastructure with native GDPR and DPDP compliance.</li>
        <li><strong>Authentication:</strong> Enforced email verification and optional Multi-Factor Authentication.</li>
      </ul>
    </MarketingContentPage>
  )
}
