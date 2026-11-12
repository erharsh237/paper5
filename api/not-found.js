/**
 * Serves a branded HTTP 404 Not Found page for unmatched marketing/public routes on Vercel.
 * Prevents soft-404 HTTP 200 responses from SPA catch-all rewrites without exposing technical details.
 * Mirrors the visitor's active light/dark theme via saved theme cookie or localStorage.
 */
function parseCookieTheme(req) {
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').toLowerCase();
  const isAppHost = host.startsWith('app.');
  const targetCookie = isAppHost ? 'p5_app_theme' : 'p5_marketing_theme';
  const rawCookie = String(req.headers?.cookie || '');
  for (const part of rawCookie.split(';')) {
    const [k, v] = part.trim().split('=');
    if (k === targetCookie && (v === 'dark' || v === 'light')) {
      return v;
    }
  }
  return 'light';
}

export default function handler(req, res) {
  const initialTheme = parseCookieTheme(req);

  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');

  res.end(`<!doctype html>
<html lang="en" data-theme="${initialTheme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>404 Page Not Found | Paper5</title>
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
    :root {
      color-scheme: light;
      --bg-void: #fafafa;
      --bg-card: #ffffff;
      --border-card: #e4e4f0;
      --border-divider: #f4f4f5;
      --text-primary: #09090b;
      --text-secondary: #52525b;
      --cta-bg: #09090b;
      --cta-text: #ffffff;
      --badge-text: #dc2626;
      --badge-bg: #fef2f2;
      --badge-border: #fecaca;
      --card-shadow: 0 12px 32px rgba(0, 0, 0, 0.05);
    }
    html[data-theme="dark"] {
      color-scheme: dark;
      --bg-void: #09090b;
      --bg-card: #18181b;
      --border-card: #27272a;
      --border-divider: #27272a;
      --text-primary: #f4f4f5;
      --text-secondary: #a1a1aa;
      --cta-bg: #ffffff;
      --cta-text: #09090b;
      --badge-text: #f87171;
      --badge-bg: rgba(239, 68, 68, 0.14);
      --badge-border: rgba(239, 68, 68, 0.35);
      --card-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: var(--bg-void);
      color: var(--text-primary);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .nf-card {
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 16px;
      padding: 40px 36px;
      max-width: 460px;
      width: 100%;
      text-align: center;
      box-shadow: var(--card-shadow);
    }
    .nf-brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-size: 18px;
      letter-spacing: -0.02em;
      margin-bottom: 20px;
      color: var(--text-primary);
      text-decoration: none;
    }
    .nf-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--badge-text);
      background: var(--badge-bg);
      border: 1px solid var(--badge-border);
      border-radius: 9999px;
      padding: 4px 12px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 8px;
      line-height: 1.3;
    }
    p {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.6;
      margin: 0 0 24px;
    }
    .nf-cta {
      display: inline-block;
      background: var(--cta-bg);
      color: var(--cta-text);
      font-size: 13.5px;
      font-weight: 600;
      text-decoration: none;
      padding: 10px 22px;
      border-radius: 8px;
    }
    .nf-cta:hover { opacity: 0.88; }
    .nf-links {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 16px;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--border-divider);
    }
    .nf-links a {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      text-decoration: none;
    }
    .nf-links a:hover { color: var(--text-primary); text-decoration: underline; }
  </style>
</head>
<body>
  <main class="nf-card">
    <a href="/" class="nf-brand">
      <img src="/logo.png" alt="" aria-hidden="true" width="26" height="26" />
      <span>PAPER5</span>
    </a>
    <div><span class="nf-badge">404 &middot; Not Found</span></div>
    <h1>This page missed its deadline.</h1>
    <p>The page you are looking for does not exist or may have been moved.</p>
    <a href="/" class="nf-cta">Back to Homepage &rarr;</a>
    <nav class="nf-links" aria-label="Public navigation">
      <a href="/features">Features</a>
      <a href="/pricing">Pricing</a>
      <a href="/docs">Documentation</a>
      <a href="/contact">Contact</a>
    </nav>
  </main>
</body>
</html>`);
}
