# S2

17 oxlint rules for [S2](https://s2.dev/docs/intro) (`@s2-dev/streamstore`), the durable real-time stream store.

|                          |                              |
| ------------------------ | ---------------------------- |
| **Manifest**             | [manifest.ts](manifest.ts)   |
| **Rule implementations** | [rules/](rules/)             |
| **Shared AST helpers**   | [utils.ts](utils.ts)         |
| **Fixtures**             | `tests/fixtures/s2/`         |
| **Rule tests**           | `tests/rules/s2-*.test.ts`   |
| **Audit source**         | `docs/audits/s2-audit-2026-07-10.md` |

Detection: `@s2-dev/streamstore` / `@s2-dev/streamstore-patterns` / `@s2-dev/resumable-stream` in package.json or imports, or `s2.dev` in source.

---

## Rules and tests by category

### Security

Scoped-token hygiene: keeping the account-wide bearer token out of browsers, expiring and narrowing issued tokens, and never persisting issue-once secrets.

| Rule | Severity | CWE / OWASP | Why it matters | Docs | Rule file | Test |
| ---- | -------- | ----------- | --- | ---- | --------- | ---- |
| scoped-token-for-client | error | CWE-522, API2:2023 | The account token in a client bundle or response body lets any visitor read/write/delete every stream. | [Access tokens](https://s2.dev/docs/sdk/access-tokens) | [scoped-token-for-client.ts](rules/scoped-token-for-client.ts) | [test](../../../tests/rules/s2-scoped-token-for-client.test.ts) |
| no-hardcoded-access-token | error | CWE-798, API8:2023 | A literal token committed to source control is a leaked bearer credential that lives in git history forever. | [Access tokens](https://s2.dev/docs/sdk/access-tokens) | [no-hardcoded-access-token.ts](rules/no-hardcoded-access-token.ts) | [test](../../../tests/rules/s2-no-hardcoded-access-token.test.ts) |
| token-expiry-and-least-privilege | error | CWE-272, API1:2023 | A never-expiring token with read+write over all basins/streams is a standing account-wide credential. The documented `basins: { prefix: "" }` + streams narrowing pattern is accepted. | [Access tokens](https://s2.dev/docs/sdk/access-tokens) | [token-expiry-and-least-privilege.ts](rules/token-expiry-and-least-privilege.ts) | [test](../../../tests/rules/s2-token-expiry-and-least-privilege.test.ts) |
| token-secret-handling | warning | CWE-532 | issue() shows the secret once; logging it persists a live credential, and list() never returns secrets. | [Access tokens](https://s2.dev/docs/sdk/access-tokens) | [token-secret-handling.ts](rules/token-secret-handling.ts) | [test](../../../tests/rules/s2-token-secret-handling.test.ts) |

### Correctness

Batch limits and read-position semantics: the tail is the end (not the last record), a single read is one capped batch, and TypeScript-vs-Python API-shape confusion.

| Rule | Severity | Why it matters | Docs | Rule file | Test |
| ---- | -------- | --- | ---- | --------- | ---- |
| append-batch-limit | error | Batches over 1000 records / 1 MiB are rejected by the service; statically oversized `AppendInput.create` calls fail at runtime. | [Appending](https://s2.dev/docs/sdk/appending) | [append-batch-limit.ts](rules/append-batch-limit.ts) | [test](../../../tests/rules/s2-append-batch-limit.test.ts) |
| tail-is-end-not-last-record | warning | Bounded reads at `tailOffset: 0` return nothing — the tail is one past the last record. | [Reading](https://s2.dev/docs/sdk/reading) | [tail-is-end-not-last-record.ts](rules/tail-is-end-not-last-record.ts) | [test](../../../tests/rules/s2-tail-is-end-not-last-record.test.ts) |
| single-read-is-capped | warning | One read from seqNum 0 is at most 1000 records / 1 MiB, silently dropping the rest of the stream. Advisory: fires on deliberately capped reads from 0 too. | [Reading](https://s2.dev/docs/sdk/reading) | [single-read-is-capped.ts](rules/single-read-is-capped.ts) | [test](../../../tests/rules/s2-single-read-is-capped.test.ts) |
| metrics-date-arguments | warning | TS metrics take Date objects (Python takes epoch ints) and timeseries sets need an interval. | [Metrics](https://s2.dev/docs/sdk/metrics) | [metrics-date-arguments.ts](rules/metrics-date-arguments.ts) | [test](../../../tests/rules/s2-metrics-date-arguments.test.ts) |

### Reliability

The append durability/exactly-once contract (at-least-once by default, exactly-once explicitly) plus session lifecycle, idempotent provisioning, and environment-aware endpoint targeting.

| Rule | Severity | Why it matters | Docs | Rule file | Test |
| ---- | -------- | --- | ---- | --------- | ---- |
| append-retry-duplicates | error | Unary appends under `appendRetryPolicy: "all"` duplicate records on a lost ack; Producer/session writers (which track matchSeqNum) are exempt. | [Retries & timeouts](https://s2.dev/docs/sdk/retries-timeouts) | [append-retry-duplicates.ts](rules/append-retry-duplicates.ts) | [test](../../../tests/rules/s2-append-retry-duplicates.test.ts) |
| append-session-for-streams | error | Per-element unary appends (Promise.all/map, for-of) lose cross-batch ordering and hit the 200 batches/sec limit; fence/trim command records are exempt. | [Appending](https://s2.dev/docs/sdk/appending) | [append-session-for-streams.ts](rules/append-session-for-streams.ts) | [test](../../../tests/rules/s2-append-session-for-streams.test.ts) |
| await-append-durability | warning | submit() means enqueued, not durable — durability is ack(); close() flushes. | [Appending](https://s2.dev/docs/sdk/appending) | [await-append-durability.ts](rules/await-append-durability.ts) | [test](../../../tests/rules/s2-await-append-durability.test.ts) |
| no-manual-append-retry-loop | warning | Catch-and-append-again duplicates on a lost ack and stacks backoff on the SDK's; classify-and-rethrow handlers are exempt. | [Retries & timeouts](https://s2.dev/docs/sdk/retries-timeouts) | [no-manual-append-retry-loop.ts](rules/no-manual-append-retry-loop.ts) | [test](../../../tests/rules/s2-no-manual-append-retry-loop.test.ts) |
| read-session-terminates | warning | A stop-less session in a request handler follows the stream forever and the request hangs; followers with an abort signal are exempt. | [Reading](https://s2.dev/docs/sdk/reading) | [read-session-terminates.ts](rules/read-session-terminates.ts) | [test](../../../tests/rules/s2-read-session-terminates.test.ts) |
| tail-offset-clamp | warning (advisory) | `tailOffset: N` without `clamp: true` errors on streams shorter than N; advisory because S2's own doc snippet omits clamp. | [Reading](https://s2.dev/docs/sdk/reading) | [tail-offset-clamp.ts](rules/tail-offset-clamp.ts) | [test](../../../tests/rules/s2-tail-offset-clamp.test.ts) |
| idempotent-resource-create | warning | Re-creating an existing basin/stream throws HTTP 409; bare creates crash the second run or a concurrent creator. | [Stream resources](https://s2.dev/docs/sdk/stream-resources) | [idempotent-resource-create.ts](rules/idempotent-resource-create.ts) | [test](../../../tests/rules/s2-idempotent-resource-create.test.ts) |
| close-stream-client | warning | Sessions/Producers pin an HTTP/2 connection; never closing them leaks per request or hangs process exit. | [Appending](https://s2.dev/docs/sdk/appending) | [close-stream-client.ts](rules/close-stream-client.ts) | [test](../../../tests/rules/s2-close-stream-client.test.ts) |
| use-s2-environment-endpoints | info (advisory) | Env-token clients without `...S2Environment.parse()` or `endpoints` are pinned to the cloud service — s2-lite/self-hosted can't be targeted. | [Endpoints](https://s2.dev/docs/sdk/endpoints) | [use-s2-environment-endpoints.ts](rules/use-s2-environment-endpoints.ts) | [test](../../../tests/rules/s2-use-s2-environment-endpoints.test.ts) |

---

## Non-rule findings (from the audit)

- **`ack.end.seqNum` is exclusive** (Finding G): a static rule can't distinguish "used as last record" (bug) from "used as exclusive bound" (correct) without dataflow — documented here instead.
- **`noSideEffects` without failure verification** (Partial P1): after a failed append under `noSideEffects`, the caller must verify (checkTail/read) whether the write landed; an absence-of-verification pattern is not reliably static.
