#!/usr/bin/env node
// Serves the production build (dist/client/browser) with the "/*" headers from netlify.toml
// — including the real Content-Security-Policy — loads it in headless Chromium, and fails on
// any CSP violation, uncaught page error, or if Angular never bootstraps.
//
// Off-origin requests (PostHog, Google Fonts, ...) are aborted to keep the test hermetic;
// the browser still enforces CSP before issuing them, so disallowed hosts are still caught.
//
// Usage (after `npm run build:prod`): npm run smoke:csp
// Set CHROMIUM_PATH to use an existing Chromium instead of Playwright's downloaded one.
const { createServer } = require('node:http');
const { existsSync, readFileSync, statSync } = require('node:fs');
const { extname, join, normalize } = require('node:path');
const { chromium } = require('playwright');

const root = join(__dirname, '..');
const distDir = join(root, 'dist/client/browser');
const indexPath = join(distDir, 'index.html');

if (!existsSync(indexPath)) {
  console.error(`${indexPath} not found — run \`npm run build:prod\` first.`);
  process.exit(1);
}

// Header values from the [[headers]] block for "/*"
function readSiteHeaders() {
  const toml = readFileSync(join(root, 'netlify.toml'), 'utf8');
  const block = toml.split('[[headers]]').find((b) => /^\s*for\s*=\s*"\/\*"/m.test(b));
  if (!block) throw new Error('No [[headers]] block for "/*" in netlify.toml');
  const headers = {};
  for (const [, key, value] of block.matchAll(/^\s*([A-Za-z-]+)\s*=\s*"([^"]*)"\s*$/gm)) {
    if (key !== 'for') headers[key] = value;
  }
  if (!headers['Content-Security-Policy']) throw new Error('No Content-Security-Policy in netlify.toml');
  return headers;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain'
};

function startServer(headers) {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = normalize(join(distDir, urlPath));
    if (!file.startsWith(distDir) || !existsSync(file) || statSync(file).isDirectory()) {
      file = indexPath; // SPA fallback, mirrors the netlify.toml redirect
    }
    res.writeHead(200, { ...headers, 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function main() {
  const server = await startServer(readSiteHeaders());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const failures = [];

  try {
    const page = await browser.newPage();
    await page.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
    await page.addInitScript(() => {
      window.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        window.__cspViolations.push(
          `${e.effectiveDirective} blocked ${e.blockedURI || 'inline'}${e.sample ? ` (${e.sample})` : ''}`
        );
      });
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /Content Security Policy/i.test(msg.text()))
        failures.push(`console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => failures.push(`page error: ${err.message}`));

    await page.goto(origin, { waitUntil: 'load' });
    const bootstrapped = await page
      .waitForFunction(() => document.querySelector('app-root')?.children.length > 0, null, { timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    if (!bootstrapped) failures.push('Angular did not bootstrap: <app-root> is empty');
    await page.waitForTimeout(1000); // let late inline scripts / lazy chunks run

    for (const v of await page.evaluate(() => window.__cspViolations)) failures.push(`CSP violation: ${v}`);
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error(`CSP smoke test FAILED:\n${[...new Set(failures)].map((f) => `  - ${f}`).join('\n')}`);
    process.exit(1);
  }
  console.log('CSP smoke test passed: no violations, app bootstrapped.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
