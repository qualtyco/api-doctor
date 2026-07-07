#!/usr/bin/env node
/**
 * Validates every docs URL referenced in src/providers/ (rules, manifests, READMEs).
 *
 * A link fails when:
 *   - the response status is >= 400 (hard 404s, dead pages)
 *   - the page title looks like a not-found page despite a 200 (soft 404)
 *   - the request redirects to a *different page* (link rot masked by a
 *     redirect to a renamed path or a generic landing page) — the source
 *     should reference the final URL directly so users land on the right page
 *
 * Usage: node scripts/check-docs-links.mjs
 * Exits 1 if any link fails. Network-dependent by design — run it before
 * releases or on a schedule, not inside the unit-test suite.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const PROVIDERS_DIR = join(ROOT, 'src', 'providers');

const URL_PATTERN = /https?:\/\/[a-zA-Z0-9./_?=&#%-]+/g;
const SKIP_HOSTS = new Set(['example.com', 'cdn.example.com', 'localhost', 'api.example.com']);
// Hosts whose bot protection blocks non-browser clients; verify these manually.
const MANUAL_CHECK_HOSTS = new Set([]);
const CONCURRENCY = 8;
const TIMEOUT_MS = 20_000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** Collect .ts and .md files under src/providers recursively. */
function collectFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectFiles(full));
    else if (/\.(ts|md)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Map of url -> [file:line, ...] */
function extractUrls() {
  const locations = new Map();
  for (const file of collectFiles(PROVIDERS_DIR)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const raw of line.match(URL_PATTERN) ?? []) {
        const url = raw.replace(/[.,)\]]+$/, '');
        let host;
        try {
          host = new URL(url).hostname;
        } catch {
          continue;
        }
        if (SKIP_HOSTS.has(host)) continue;
        const loc = `${relative(ROOT, file)}:${i + 1}`;
        if (!locations.has(url)) locations.set(url, []);
        locations.get(url).push(loc);
      }
    });
  }
  return locations;
}

/** Compare URLs ignoring fragment, trailing slash, and scheme upgrades. */
function samePage(a, b) {
  const norm = (u) => {
    const p = new URL(u);
    p.searchParams.delete('hl'); // Google docs append a locale param on redirect
    const search = p.searchParams.toString();
    return `${p.hostname.replace(/^www\./, '')}${p.pathname.replace(/\/$/, '')}${search ? `?${search}` : ''}`;
  };
  return norm(a) === norm(b);
}

async function checkUrl(url) {
  const target = url.split('#')[0];
  let res;
  try {
    res = await fetch(target, {
      redirect: 'follow',
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*', 'accept-language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return { url, ok: false, reason: `request failed: ${err.cause?.code ?? err.name}` };
  }

  if (MANUAL_CHECK_HOSTS.has(new URL(target).hostname)) {
    return { url, ok: true, note: 'manual-check host, status not enforced' };
  }
  if (res.status >= 400) {
    return { url, ok: false, reason: `HTTP ${res.status}` };
  }
  if (!samePage(target, res.url)) {
    return { url, ok: false, reason: `redirects to ${res.url} — update the source to the final URL` };
  }

  const body = (await res.text()).slice(0, 20_000);
  const title = /<title[^>]*>([^<]*)/i.exec(body)?.[1]?.trim() ?? '';
  if (/not found|404|doesn'?t exist/i.test(title)) {
    return { url, ok: false, reason: `soft 404 (title: "${title}")` };
  }
  return { url, ok: true };
}

async function main() {
  const locations = extractUrls();
  const urls = [...locations.keys()].sort();
  console.log(`Checking ${urls.length} unique URLs from src/providers ...`);

  const results = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < urls.length) {
        const url = urls[cursor++];
        results.push(await checkUrl(url));
      }
    }),
  );

  const failures = results.filter((r) => !r.ok);
  for (const f of failures) {
    console.error(`\nFAIL ${f.url}\n  ${f.reason}`);
    for (const loc of locations.get(f.url)) console.error(`  at ${loc}`);
  }
  console.log(`\n${results.length - failures.length}/${results.length} links OK`);
  if (failures.length > 0) {
    console.error(`${failures.length} broken or stale link(s).`);
    process.exit(1);
  }
}

main();
