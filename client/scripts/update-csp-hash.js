#!/usr/bin/env node
// Regenerates the hash sources in the script-src CSP directive of netlify.toml from the
// BUILT production page (dist/client/browser/index.html), so anything the Angular build
// injects (e.g. Beasties' CSS-activation script) is covered, not just our own snippets.
//
// Hashes every inline <script> and every inline event handler (on*="...") attribute.
// 'unsafe-hashes' is emitted only when event handlers are present. Non-hash sources
// (e.g. https://p.jeffsoftware.com) are preserved as-is.
//
// Usage (after `npm run build:prod`):
//   npm run update-csp               # rewrite netlify.toml if needed
//   npm run update-csp -- --check    # exit 1 if netlify.toml is out of date (CI)
const { createHash } = require('node:crypto');
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const htmlPath = join(root, 'dist/client/browser/index.html');
const tomlPath = join(root, 'netlify.toml');
const check = process.argv.includes('--check');

if (!existsSync(htmlPath)) {
  console.error(`${htmlPath} not found — run \`npm run build:prod\` first.`);
  process.exit(1);
}
const html = readFileSync(htmlPath, 'utf8');
if (html.includes('ng-server-context="ssg"')) {
  console.error(`${htmlPath} is the email pre-render, not the production build — run \`npm run build:prod\` first.`);
  process.exit(1);
}

const sha256 = (text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

// Browsers hash attribute values after entity decoding
const decodeEntities = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const JS_TYPES = /^(|text\/javascript|application\/javascript|module)$/i;
const scriptHashes = [];
for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (/\ssrc\s*=/i.test(attrs) || body === '') continue;
  const type = (attrs.match(/\stype\s*=\s*["']?([^"'\s>]*)/i) || [])[1] || '';
  if (!JS_TYPES.test(type)) continue; // e.g. application/json, ld+json don't execute
  scriptHashes.push(sha256(body));
}

const handlerHashes = [];
for (const [, , dq, sq] of html.matchAll(/<[^>]*?\s(on[a-z]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
  handlerHashes.push(sha256(decodeEntities(dq ?? sq)));
}

const toml = readFileSync(tomlPath, 'utf8');
const cspLine = toml.match(/^(\s*Content-Security-Policy\s*=\s*")([^"]*)(".*)$/m);
if (!cspLine) {
  console.error('No Content-Security-Policy header found in netlify.toml');
  process.exit(1);
}
const [fullLine, prefix, policy, suffix] = cspLine;
const directives = policy.split(';').map((d) => d.trim());
const idx = directives.findIndex((d) => d.startsWith('script-src '));
if (idx === -1) {
  console.error('No script-src directive found in netlify.toml CSP');
  process.exit(1);
}

const oldSources = directives[idx].split(/\s+/).slice(1);
const keep = oldSources.filter((s) => !/^'sha(256|384|512)-/.test(s) && s !== "'unsafe-hashes'");
const selfSources = keep.filter((s) => s === "'self'");
const otherSources = keep.filter((s) => s !== "'self'");
const hashes = [...new Set([...scriptHashes, ...handlerHashes])];
const newSources = [
  ...selfSources,
  ...(handlerHashes.length ? ["'unsafe-hashes'"] : []),
  ...hashes,
  ...otherSources
];
directives[idx] = ['script-src', ...newSources].join(' ');

const updated = toml.replace(fullLine, `${prefix}${directives.join('; ')}${suffix}`);

if (updated === toml) {
  console.log('CSP script-src already up to date.');
  process.exit(0);
}

const added = newSources.filter((s) => !oldSources.includes(s));
const removed = oldSources.filter((s) => !newSources.includes(s));
const summary = [...added.map((s) => `  + ${s}`), ...removed.map((s) => `  - ${s}`)].join('\n');

if (check) {
  console.error(
    `netlify.toml CSP script-src does not match the built index.html:\n${summary}\n` +
      'Run `npm run build:prod && npm run update-csp` and commit netlify.toml.'
  );
  process.exit(1);
}
writeFileSync(tomlPath, updated);
console.log(`netlify.toml script-src updated:\n${summary}`);
