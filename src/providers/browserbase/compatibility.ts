/**
 * Hand-verified removals in @browserbasehq/sdk, consumed by the
 * browserbase-removed-method compatibility rule.
 *
 * 2.0.0 replaced a flat hand-written client with a Stainless-generated
 * resource client: every 1.x method (`bb.createSession()`) became a nested
 * resource call (`bb.sessions.create()`). The import and the constructor name
 * are unchanged, so nothing at the top of the file records the break — see
 * `_shared/removed-method.ts` for why that needs its own detection.
 *
 * The rule fires only on a mismatch between code and the INSTALLED version —
 * it never suggests upgrading. A project pinned to 1.5.0 calling
 * `bb.createSession()` is correct and stays silent forever.
 *
 * Every entry is verified by hand against the published tarballs
 * (implementation, not just the type diff): 1.5.0's `dist/index.js`, where each
 * method is a literal `fetch()` with the URL inline, against 2.18.0's
 * `resources/**` , where each is a `this._client.<verb>()` with the path
 * inline. That is what makes `wireIdentical` decidable here rather than
 * guessed: both sides state their method and path in one line.
 *
 * Nothing was removed WITHIN 2.x — 2.0.0 through 2.18.0 is purely additive at
 * the method level — so every entry below is the 2.0.0 boundary.
 *
 * The `MethodRemoval` shape and the rules for writing `verifyHint` live in
 * src/types.ts — this file is the Browserbase data and nothing else.
 */
import type { MethodRemoval, ProviderCompatibility } from '../../types.js';

export const BROWSERBASE_PACKAGE = '@browserbasehq/sdk';

const PACK = 'npm pack @browserbasehq/sdk 1.5.0 vs 2.18.0';

export const browserbaseMethodRemovals: MethodRemoval[] = [
  {
    path: 'createSession',
    removedIn: '2.0.0',
    replacement: 'sessions.create',
    kind: 'signature-change',
    // Same POST /v1/sessions, but the body is no longer merged with a
    // client-level projectId — the caller must supply it. Not identical
    // arguments, so not wireIdentical.
    wireIdentical: false,
    verifiedAt: '2026-08-19',
    evidence: `${PACK}. 1.5.0 dist/index.js:36 \`createSession(options)\` → \`fetch(\${baseAPIURL}/v1/sessions, { method: 'POST', body: JSON.stringify({ projectId: this.projectId, ...options }) })\`. 2.18.0 resources/sessions/sessions.js:64 \`create\` → \`this._client.post('/v1/sessions', { body: { timeout: api_timeout, ...body } })\`. Same method and path; the projectId merge is gone.`,
    verifyHint:
      'Same POST /v1/sessions, but the arguments are not the same: 1.x merged the client-level `projectId` (from the constructor or BROWSERBASE_PROJECT_ID) into the body for you and threw locally if it was missing. 2.x requires `projectId` explicitly in the params object. Check that this call site passes it — without it the failure is a server-side 4xx rather than the old local throw.',
  },
  {
    path: 'listSessions',
    removedIn: '2.0.0',
    replacement: 'sessions.list',
    kind: 'rename',
    wireIdentical: true,
    verifiedAt: '2026-08-19',
    evidence: `${PACK}. 1.5.0 dist/index.js:27 \`listSessions()\` → \`fetch(\${baseAPIURL}/v1/sessions)\` (no method → GET, header \`x-bb-api-key\`). 2.18.0 resources/sessions/sessions.js:82 \`list\` → \`this._client.get('/v1/sessions', { query })\` with \`authHeaders\` returning \`X-BB-API-Key\` (index.js:117). Same GET, same path, same auth header, and the old call passed no arguments to differ.`,
    verifyHint:
      'Same GET /v1/sessions, same API-key header, and the 1.x call took no arguments — no behavior change in the request. The successor additionally accepts an optional filter query, which you can ignore. Check the return value: both resolve a session array, so a call site that iterated the result is unaffected.',
  },
  {
    path: 'getSession',
    removedIn: '2.0.0',
    replacement: 'sessions.retrieve',
    kind: 'rename',
    wireIdentical: true,
    verifiedAt: '2026-08-19',
    evidence: `${PACK}. 1.5.0 dist/index.js:71 \`getSession(sessionId)\` → \`fetch(\${baseAPIURL}/v1/sessions/\${sessionId})\` (GET). 2.18.0 resources/sessions/sessions.js:70 \`retrieve(id)\` → \`this._client.get(\\\`/v1/sessions/\${id}\\\`)\`. Same GET, same path, same single id argument, same auth header.`,
    verifyHint:
      'Same GET /v1/sessions/{id}, same auth, same single id argument — no behavior change, this is a rename. The one thing to check is error handling: 1.x returned the parsed body whatever the status, 2.x throws a typed `APIError` subclass on a non-2xx, so a call site that inspected the response for an error field now needs a try/catch.',
  },
  {
    path: 'completeSession',
    removedIn: '2.0.0',
    replacement: 'sessions.update',
    kind: 'signature-change',
    wireIdentical: false,
    verifiedAt: '2026-08-19',
    evidence: `${PACK}. 1.5.0 dist/index.js:51 \`completeSession(sessionId)\` → \`fetch(\${baseAPIURL}/v1/sessions/\${sessionId}, { method: 'POST', body: JSON.stringify({ projectId: this.projectId, status: 'REQUEST_RELEASE' }) })\`. 2.18.0 resources/sessions/sessions.js:76 \`update(id, body)\` → \`this._client.post(\\\`/v1/sessions/\${id}\\\`, { body })\`. Same POST and path; the body is now entirely the caller's.`,
    verifyHint:
      "Same POST /v1/sessions/{id}, but the body that made it a *completion* is no longer implied. 1.x hardcoded `{ projectId, status: 'REQUEST_RELEASE' }`; the generic `sessions.update(id, body)` sends whatever you give it, so the call must become `sessions.update(id, { projectId, status: 'REQUEST_RELEASE' })`. Omit the status and the session is not released — the request still succeeds, which is why this one is worth checking rather than assuming.",
  },
  {
    path: 'getDebugConnectionURLs',
    removedIn: '2.0.0',
    replacement: 'sessions.debug',
    kind: 'rename',
    wireIdentical: true,
    verifiedAt: '2026-08-19',
    evidence: `${PACK}. 1.5.0 dist/index.js:113 \`getDebugConnectionURLs(sessionId)\` → \`fetch(\${baseAPIURL}/v1/sessions/\${sessionId}/debug, { method: 'GET' })\`. 2.18.0 resources/sessions/sessions.js:88 \`debug(id)\` → \`this._client.get(\\\`/v1/sessions/\${id}/debug\\\`)\`. Same GET, same path, same single id argument, same auth header.`,
    verifyHint:
      'Same GET /v1/sessions/{id}/debug, same auth, same single id argument — no behavior change, this is a rename. As with the other 2.x calls, a non-2xx now throws a typed error instead of resolving the parsed body.',
  },
  {
    path: 'getSessionLogs',
    removedIn: '2.0.0',
    replacement: 'sessions.logs.list',
    kind: 'rename',
    wireIdentical: true,
    verifiedAt: '2026-08-19',
    evidence: `${PACK}. 1.5.0 dist/index.js:124 \`getSessionLogs(sessionId)\` → \`fetch(\${baseAPIURL}/v1/sessions/\${sessionId}/logs)\` (GET). 2.18.0 resources/sessions/logs.js:11 \`list(id)\` → \`this._client.get(\\\`/v1/sessions/\${id}/logs\\\`)\`. Same GET, same path, same single id argument, same auth header.`,
    verifyHint:
      'Same GET /v1/sessions/{id}/logs, same auth, same single id argument — no behavior change, this is a rename onto a nested resource. A non-2xx now throws a typed error rather than resolving the body.',
  },
  {
    path: 'getSessionRecording',
    removedIn: '2.0.0',
    replacement: 'sessions.recording.retrieve',
    kind: 'rename',
    wireIdentical: true,
    verifiedAt: '2026-08-19',
    evidence: `${PACK}. 1.5.0 dist/index.js:80 \`getSessionRecording(sessionId)\` → \`fetch(\${baseAPIURL}/v1/sessions/\${sessionId}/recording)\` (GET). 2.18.0 resources/sessions/recording/recording.js:50 \`retrieve(id)\` → \`this._client.get(\\\`/v1/sessions/\${id}/recording\\\`)\`. Same GET, same path, same single id argument, same auth header.`,
    verifyHint:
      'Same GET /v1/sessions/{id}/recording, same auth, same single id argument — no behavior change, this is a rename onto a nested resource. A non-2xx now throws a typed error rather than resolving the body.',
  },
  {
    path: 'getSessionDownloads',
    removedIn: '2.0.0',
    replacement: 'sessions.downloads.list',
    kind: 'signature-change',
    // Same GET and path, but 1.x retried internally and 2.x does not. A
    // behaviour difference behind an identical request is exactly the case
    // wireIdentical must not paper over.
    wireIdentical: false,
    verifiedAt: '2026-08-19',
    evidence: `${PACK}. 1.5.0 dist/index.js:89 \`getSessionDownloads(sessionId, retryInterval = 2000, retryCount = 2)\` wraps \`fetch(\${baseAPIURL}/v1/sessions/\${sessionId}/downloads, { method: 'GET' })\` in a retry loop driven by those two parameters. 2.18.0 resources/sessions/downloads.js:11 \`list(id)\` → \`this._client.get(\\\`/v1/sessions/\${id}/downloads\\\`)\`, with no per-call retry parameters.`,
    verifyHint:
      'The request is the same GET /v1/sessions/{id}/downloads, but the retrying is gone: 1.x polled up to `retryCount` times at `retryInterval` because downloads are not ready the instant a session ends, and the successor issues one request. If this call site passed either argument — or relied on the defaults to wait out that window — it needs its own polling now, or it will read an empty/absent archive on a session that has only just finished.',
  },
  {
    path: 'createContext',
    removedIn: '2.0.0',
    replacement: 'contexts.create',
    kind: 'signature-change',
    wireIdentical: false,
    verifiedAt: '2026-08-19',
    evidence: `${PACK}. 1.5.0 dist/index.js:211 \`createContext()\` → \`fetch(\${baseAPIURL}/v1/contexts, { method: 'POST', body: JSON.stringify({ projectId: this.projectId }) })\`, throwing locally when the response is not ok. 2.18.0 resources/contexts.js:12 \`create(body)\` → \`this._client.post('/v1/contexts', { body })\`. Same method and path; the projectId is no longer supplied from the client.`,
    verifyHint:
      "Same POST /v1/contexts, but the body is now the caller's: 1.x always sent the client-level `projectId`, 2.x sends what you pass and treats `projectId` as optional (inferred from the API key when omitted). Check whether this call site depended on a projectId that differs from the key's default — if it did, pass it explicitly.",
  },
  {
    path: 'getConnectURL',
    removedIn: '2.0.0',
    kind: 'removed',
    wireIdentical: false,
    verifiedAt: '2026-08-19',
    evidence: `${PACK}. 1.5.0 dist/index.js:24 \`getConnectURL({ sessionId, proxy })\` returns a string built locally — \`\${baseConnectURL}?apiKey=\${this.apiKey}&sessionId=…&enableProxy=…\` — and makes no request. No such method exists on 2.18.0's Browserbase class (index.d.ts declares only the resource properties and the protected transport hooks).`,
    verifyHint:
      "There is no successor method because the URL is no longer something the client can build: 2.x returns `connectUrl` on the session object from `sessions.create()` / `sessions.retrieve()`, so read it from there and pass it to your Puppeteer/Playwright connect call. Note the security difference while you are here — the 1.x string embedded the raw API key in a query parameter, and the 2.x `connectUrl` carries a session-scoped signature instead, so anywhere the old URL was logged or handed to a browser is worth re-checking.",
  },
];

/**
 * Manifest-facing record. Declaring this on `browserbaseManifest.compatibility`
 * is the only registration step.
 *
 * The 1.x Puppeteer convenience helpers (`load`, `loadURL`, `loadURLs`,
 * `screenshot`) are deliberately NOT listed. They are gone from 2.x, but they
 * drove a headless browser rather than calling the API, their replacement is
 * "write the Playwright/Puppeteer code yourself or use Stagehand", and there
 * is no request to compare — so there is no honest `verifyHint` to write
 * beyond "this feature left the SDK". A compatibility entry that cannot name
 * what to check is not verified enough to ship.
 *
 * `removals` is empty: 2.0.0 kept the `Browserbase` export as the client
 * constructor, so there is no exported-symbol removal to record here.
 */
export const browserbaseCompatibility: ProviderCompatibility = {
  package: BROWSERBASE_PACKAGE,
  removals: [],
  methodRemovals: browserbaseMethodRemovals,
};
