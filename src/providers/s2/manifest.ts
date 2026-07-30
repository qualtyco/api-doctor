import type { ProviderManifest } from '../../types.js';

export const s2Manifest: ProviderManifest = {
  name: 's2',
  displayName: 'S2',
  detect: {
    packages: ['@s2-dev/streamstore', '@s2-dev/streamstore-patterns', '@s2-dev/resumable-stream'],
    imports: ['@s2-dev/streamstore', '@s2-dev/streamstore-patterns', '@s2-dev/resumable-stream'],
    urlPatterns: ['s2.dev'],
  },
  surface: {
    // Only the core SDK exports the S2 client. @s2-dev/streamstore-patterns
    // and @s2-dev/resumable-stream are standalone helpers that neither depend
    // on nor re-export it, so they cannot verify a client construction.
    packages: ['@s2-dev/streamstore'],
    clientConstructors: ['S2'],
    clientNamePattern: /^s2([-_]?client)?$/i,
    docsUrl: 'https://s2.dev/docs/api/protocol',
    // Verified against @s2-dev/streamstore@0.25.0 dist/esm/*.d.ts (S2 root
    // class: readonly resource props basins/accessTokens/locations/metrics
    // plus the basin() accessor) and cross-checked against the official
    // OpenAPI spec (github.com/s2-streamstore/s2-specs, s2/v1/openapi.json):
    // all 15 account-level endpoints map to a method below. Three entries are
    // SDK-side extras with no 1:1 endpoint: `basin` (local accessor returning
    // the basin-scoped client — no HTTP call of its own) and
    // basins.listAll / accessTokens.listAll (auto-pagination helpers over
    // list). The nine basin/stream-scoped endpoints (streams list/create/
    // get_config/ensure/delete/reconfigure, plus append, read, check_tail)
    // are reachable only through `s2.basin(name)` scoped clients; the
    // coverage collector deliberately drops calls chained through an
    // intermediate call (`s2.basin('b').stream('s').append()`) or made on a
    // scoped-client variable, so their SDK methods (basin.streams.*,
    // stream.append/read/checkTail/appendSession/readSession/...) are not
    // listed — `basin` appearing in `used` is the signal that data-plane
    // usage exists. Re-verify on SDK bumps (`pnpm check:surface`).
    methods: [
      'accessTokens.issue',
      'accessTokens.list',
      'accessTokens.listAll',
      'accessTokens.revoke',
      'basin',
      'basins.create',
      'basins.delete',
      'basins.ensure',
      'basins.getConfig',
      'basins.list',
      'basins.listAll',
      'basins.reconfigure',
      'locations.getDefault',
      'locations.list',
      'locations.setDefault',
      'metrics.account',
      'metrics.basin',
      'metrics.stream',
    ],
  },
  rules: [
    {
      key: 's2-scoped-token-for-client',
      resultRule: 's2/scoped-token-for-client',
      message: 'Broad S2 access token exposed to client-side code.',
      fix: 'Issue a short-lived scoped token on the server (accessTokens.issue with basins/streams scope, opGroups, expiresAt) and hand that to the client instead of S2_ACCESS_TOKEN.',
      docsUrl: 'https://s2.dev/docs/sdk/access-tokens',
      severity: 'error',
    },
    {
      key: 's2-append-retry-duplicates',
      resultRule: 's2/append-retry-duplicates',
      message: 'Unary stream.append with appendRetryPolicy "all" can duplicate records when an acknowledgement is lost.',
      fix: 'Use retry: { appendRetryPolicy: "noSideEffects" } for unary appends, add a matchSeqNum precondition, or write through a Producer/append session which tracks matchSeqNum.',
      docsUrl: 'https://s2.dev/docs/sdk/retries-timeouts',
      severity: 'error',
    },
    {
      key: 's2-no-hardcoded-access-token',
      resultRule: 's2/no-hardcoded-access-token',
      message: 'Hardcoded S2 access token found in source code.',
      fix: 'Read the token from process.env.S2_ACCESS_TOKEN (or a secret store) and throw if unset.',
      docsUrl: 'https://s2.dev/docs/sdk/access-tokens',
      severity: 'error',
    },
    {
      key: 's2-append-batch-limit',
      resultRule: 's2/append-batch-limit',
      message: 'AppendInput.create batch exceeds the 1000-record limit; S2 rejects batches over 1000 records or 1 MiB.',
      fix: 'Chunk into batches of at most 1000 records / 1 MiB, or use a Producer which batches to the limits automatically.',
      docsUrl: 'https://s2.dev/docs/sdk/appending',
      severity: 'error',
    },
    {
      key: 's2-append-session-for-streams',
      resultRule: 's2/append-session-for-streams',
      message: 'Concurrent or looped unary appends lose cross-batch ordering and hit the 200 batches/sec rate limit.',
      fix: 'Open one appendSession() or Producer for steady streams of writes; it pipelines, preserves order, and applies backpressure.',
      docsUrl: 'https://s2.dev/docs/sdk/appending',
      severity: 'error',
    },
    {
      key: 's2-token-expiry-and-least-privilege',
      resultRule: 's2/token-expiry-and-least-privilege',
      message: 'Access token issued without expiry or scope narrowing — a standing account-wide credential.',
      fix: 'Always set expiresAt and scope the token to the narrowest basins/streams match plus a minimal opGroups or ops list.',
      docsUrl: 'https://s2.dev/docs/sdk/access-tokens',
      severity: 'error',
    },
    {
      key: 's2-await-append-durability',
      resultRule: 's2/await-append-durability',
      message: 'Append session submits records but never awaits ack() or close() — records may not be durable.',
      fix: 'Await the ticket ack() when durability matters, and always await session.close() (ideally in a finally block) to flush outstanding batches.',
      docsUrl: 'https://s2.dev/docs/sdk/appending',
      severity: 'warning',
    },
    {
      key: 's2-no-manual-append-retry-loop',
      resultRule: 's2/no-manual-append-retry-loop',
      message: 'Hand-rolled retry loop around stream.append duplicates records on a lost acknowledgement.',
      fix: 'Configure retry on the S2 client instead; for exactly-once use a matchSeqNum precondition or a Producer.',
      docsUrl: 'https://s2.dev/docs/sdk/retries-timeouts',
      severity: 'warning',
    },
    {
      key: 's2-tail-is-end-not-last-record',
      resultRule: 's2/tail-is-end-not-last-record',
      message: 'Reading at the tail returns no existing records — the tail is the end position, not the last record.',
      fix: 'Use tailOffset: N (with clamp: true) to get the last N existing records, or a follow session / wait for future records.',
      docsUrl: 'https://s2.dev/docs/sdk/reading',
      severity: 'warning',
    },
    {
      key: 's2-single-read-is-capped',
      resultRule: 's2/single-read-is-capped',
      message: 'A single read returns at most one batch (1000 records / 1 MiB) — it is not the whole stream.',
      fix: 'Iterate a readSession, or page by advancing start.from.seqNum past the last returned record.',
      docsUrl: 'https://s2.dev/docs/sdk/reading',
      severity: 'warning',
    },
    {
      key: 's2-read-session-terminates',
      resultRule: 's2/read-session-terminates',
      message: 'Read session in a request handler has no stop condition — it follows the stream forever and the request hangs.',
      fix: 'Add stop: { waitSecs: 0 } (or count/bytes/until) for bounded reads; only omit stop for a long-lived follower with an abort signal.',
      docsUrl: 'https://s2.dev/docs/sdk/reading',
      severity: 'warning',
    },
    {
      key: 's2-tail-offset-clamp',
      resultRule: 's2/tail-offset-clamp',
      message: 'tailOffset without clamp: true can error on streams shorter than the offset.',
      fix: 'Use start: { from: { tailOffset: N }, clamp: true } when N may exceed the stream length.',
      docsUrl: 'https://s2.dev/docs/sdk/reading',
      severity: 'warning',
    },
    {
      key: 's2-idempotent-resource-create',
      resultRule: 's2/idempotent-resource-create',
      message: 'Resource create has no HTTP 409 handling — re-creating an existing basin/stream throws.',
      fix: 'Catch S2Error with status 409 (already exists) and rethrow anything else, e.g. .catch(err => { if (!(err instanceof S2Error && err.status === 409)) throw err; }).',
      docsUrl: 'https://s2.dev/docs/sdk/stream-resources',
      severity: 'warning',
    },
    {
      key: 's2-close-stream-client',
      resultRule: 's2/close-stream-client',
      message: 'Append session or Producer is never closed — sessions hold an HTTP/2 connection and leak or hang the process.',
      fix: 'Await close() on the session/Producer in a finally block; reuse one client across requests where possible.',
      docsUrl: 'https://s2.dev/docs/sdk/appending',
      severity: 'warning',
    },
    {
      key: 's2-use-s2-environment-endpoints',
      resultRule: 's2/use-s2-environment-endpoints',
      message: 'S2 client reads the token from the environment but ignores endpoint overrides, pinning the app to the cloud service.',
      fix: 'Construct the client with new S2({ ...S2Environment.parse(), accessToken }), or pass endpoints explicitly for s2-lite/self-hosted deployments.',
      docsUrl: 'https://s2.dev/docs/sdk/endpoints',
      severity: 'info',
    },
    {
      key: 's2-metrics-date-arguments',
      resultRule: 's2/metrics-date-arguments',
      message: 'Metrics call passes epoch numbers instead of Date objects, or omits interval on a timeseries set.',
      fix: 'In TypeScript pass start/end as Date objects (e.g. new Date(Date.now() - 3600 * 1000)) and set interval: "hour" | "minute" for storage/append-ops metrics.',
      docsUrl: 'https://s2.dev/docs/sdk/metrics',
      severity: 'warning',
    },
    {
      key: 's2-token-secret-handling',
      resultRule: 's2/token-secret-handling',
      message: 'Issued access-token secret written to logs, or expected from accessTokens.list() which returns metadata only.',
      fix: 'Treat issue().accessToken as write-once: store it in a secret manager, never log it. Use list() for metadata and revoke({ id }) by id.',
      docsUrl: 'https://s2.dev/docs/sdk/access-tokens',
      severity: 'warning',
    },
  ],
};
