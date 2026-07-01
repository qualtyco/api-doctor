# Browserbase

11 oxlint rules for the [Browserbase](https://browserbase.com) Node SDK (`@browserbasehq/sdk`).

|                          |                                       |
| ------------------------ | ------------------------------------- |
| **Manifest**             | [manifest.ts](manifest.ts)            |
| **Rule implementations** | [rules/](rules/)                      |
| **Shared AST helpers**   | [utils.ts](utils.ts)                  |
| **Fixtures**             | `tests/fixtures/browserbase/`         |
| **Rule tests**           | `tests/rules/browserbase-*.test.ts`   |

Detection: `@browserbasehq/sdk` in package.json, `import from '@browserbasehq/sdk'`, or `api.browserbase.com` in source.

These rules target the Node SDK (`@browserbasehq/sdk`) specifically. Field/behavior names are verified directly against the live SDK source rather than assumed from another language's SDK. A few names diverge from what you might expect if migrating from a different Browserbase SDK — see **Node-specific notes** below.

---

## Node-specific notes

- **Mobile device emulation**: the Node SDK has no `fingerprint.devices`/`operatingSystems` field. Node's device-emulation lever is `browserSettings.os: 'mobile' | 'tablet'` — see `mobile-device-requires-os-setting.ts`.
- **Shared context**: `contextId` is not top-level — it's nested at `browserSettings.context.id` (with optional `persist?: boolean`).
- **Error handling**: `Browserbase.APIError` carries `.status`, and there is no dedicated `410` subclass — the SDK defaults to 2 automatic internal retries.

No Browserbase sample project was available to CLI-smoke-test these rules against (unlike the Firebase rule pack, which validated against a real codebase) — fixtures are synthetic Express/Next.js-style Node code constructed to match each pattern.

---

## Rules and tests by category

### Security

Session management, API response leakage, and authorization checks.

| Rule | Severity | CWE / OWASP | Why it matters | Browserbase docs | Rule file | Test |
| --- | --- | --- | --- | --- | --- | --- |
| No conditional authz on anonymous user | error | CWE-862, A01:2021 | Authorization check is gated behind is_authenticated, which fails for AnonymousUser, exposing session data and recordings to unauthenticated access. | [Connect API](https://docs.browserbase.com/api-reference/api-client/create) | [no-conditional-authz-on-anonymous-user.ts](rules/no-conditional-authz-on-anonymous-user.ts) | [test](../../../tests/rules/browserbase-no-conditional-authz-on-anonymous-user.test.ts) |
| No connectUrl in API response | error | CWE-200, A04:2021 | connect_url is a self-authenticating bearer token for full CDP control; returning it in the HTTP response body exposes it to logs, network tabs, and error trackers. | [Session response](https://docs.browserbase.com/api-reference/sessions/retrieve) | [no-connect-url-in-api-response.ts](rules/no-connect-url-in-api-response.ts) | [test](../../../tests/rules/browserbase-no-connect-url-in-api-response.test.ts) |
| Session id requires ownership check | warning | CWE-862 | Session ID parameter is accepted with no ownership check, allowing any authenticated user to access live debugger URLs for other users' sessions (IDOR). | [Create session](https://docs.browserbase.com/api-reference/sessions/create) | [session-id-requires-ownership-check.ts](rules/session-id-requires-ownership-check.ts) | [test](../../../tests/rules/browserbase-session-id-requires-ownership-check.test.ts) |

#### Security fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| --- | --- | --- |
| No conditional authz on anonymous user | `browserbase-no-conditional-authz-on-anonymous-user-broken/anon-session-no-check.ts`, `guest-user-no-verification.ts` | `browserbase-no-conditional-authz-on-anonymous-user-fixed/authz-check-first.ts`, `authenticated-no-check-adversarial.ts` |
| No connectUrl in API response | `browserbase-no-connect-url-in-api-response-broken/return-session-direct.ts`, `send-connectUrl-to-client.ts` | `browserbase-no-connect-url-in-api-response-fixed/extract-connectUrl-server.ts`, `other-session-field-adversarial.ts` |
| Session id requires ownership check | `browserbase-session-id-requires-ownership-check-broken/no-user-check.ts`, `accept-any-session-id.ts` | `browserbase-session-id-requires-ownership-check-fixed/verify-ownership.ts`, `anonymous-session-no-check-adversarial.ts` |

---

### Correctness

Context atomicity and device configuration requirements.

| Rule | Severity | Why it matters | Browserbase docs | Rule file | Test |
| --- | --- | --- | --- | --- | --- |
| No concurrent shared context | error | Same Browserbase Context reused across concurrent sessions breaks the product's functionality; Browserbase docs explicitly warn that "Sites may force a log out." | [Shared context](https://docs.browserbase.com/guides/shared-context) | [no-concurrent-shared-context.ts](rules/no-concurrent-shared-context.ts) | [test](../../../tests/rules/browserbase-no-concurrent-shared-context.test.ts) |
| Mobile device requires os setting | error | Mobile device combos never configure Browserbase's fingerprint/device emulation, so sites receive desktop user-agent and miss exercising their mobile code paths. | [Mobile emulation](https://docs.browserbase.com/guides/mobile-emulation) | [mobile-device-requires-os-setting.ts](rules/mobile-device-requires-os-setting.ts) | [test](../../../tests/rules/browserbase-mobile-device-requires-os-setting.test.ts) |
| Use typed exception status, not substring | info | Error detection relies on fragile substring matching instead of typed status codes, breaking when the API's error messages change. | [Error handling](https://docs.browserbase.com/guides/error-handling) | [use-typed-exception-status-not-substring.ts](rules/use-typed-exception-status-not-substring.ts) | [test](../../../tests/rules/browserbase-use-typed-exception-status-not-substring.test.ts) |

#### Correctness fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| --- | --- | --- |
| No concurrent shared context | `browserbase-no-concurrent-shared-context-broken/parallel-persist-context.ts`, `concurrent-mutations.ts` | `browserbase-no-concurrent-shared-context-fixed/sequential-context-use.ts`, `single-session-no-share-adversarial.ts` |
| Mobile device requires os setting | `browserbase-mobile-device-requires-os-setting-broken/mobile-no-os.ts`, `emulate-without-setting.ts` | `browserbase-mobile-device-requires-os-setting-fixed/mobile-with-os.ts`, `desktop-no-os-adversarial.ts` |
| Use typed exception status, not substring | `browserbase-use-typed-exception-status-not-substring-broken/substring-match.ts`, `message-includes-check.ts` | `browserbase-use-typed-exception-status-not-substring-fixed/typed-status-check.ts`, `other-error-type-adversarial.ts` |

---

### Reliability

Session lifecycle management and error handling strategy.

| Rule | Severity | Why it matters | Browserbase docs | Rule file | Test |
| --- | --- | --- | --- | --- | --- |
| Release session on connect failure | error | If CDP handshake fails after session creation, the session is never released and accumulates charges until the timeout elapses (up to 6 hours). | [Error handling](https://docs.browserbase.com/guides/error-handling) | [release-session-on-connect-failure.ts](rules/release-session-on-connect-failure.ts) | [test](../../../tests/rules/browserbase-release-session-on-connect-failure.test.ts) |
| No overbroad error substring match | error | Broad substring matching like "session" in error messages kills healthy recordings on transient network errors, causing false positives. | [API errors](https://docs.browserbase.com/api-reference/errors) | [no-overbroad-error-substring-match.ts](rules/no-overbroad-error-substring-match.ts) | [test](../../../tests/rules/browserbase-no-overbroad-error-substring-match.test.ts) |
| Don't stack custom retry on SDK retry | warning | Layering custom retry on top of SDK's built-in retry (2 retries) can trigger up to 9 actual HTTP attempts, compounding latency and consuming quota. | [Retry logic](https://docs.browserbase.com/guides/error-handling#retry-logic) | [dont-stack-custom-retry-on-sdk-retry.ts](rules/dont-stack-custom-retry-on-sdk-retry.ts) | [test](../../../tests/rules/browserbase-dont-stack-custom-retry-on-sdk-retry.test.ts) |

#### Reliability fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| --- | --- | --- |
| Release session on connect failure | `browserbase-release-session-on-connect-failure-broken/no-release-on-error.ts`, `throw-without-cleanup.ts` | `browserbase-release-session-on-connect-failure-fixed/release-in-finally.ts`, `no-connect-attempt-adversarial.ts` |
| No overbroad error substring match | `browserbase-no-overbroad-error-substring-match-broken/includes-timeout.ts`, `substring-partial-match.ts` | `browserbase-no-overbroad-error-substring-match-fixed/specific-error-check.ts`, `http-error-specific-adversarial.ts` |
| Don't stack custom retry on SDK retry | `browserbase-dont-stack-custom-retry-on-sdk-retry-broken/custom-retry-wrapper.ts`, `manual-retry-loop.ts` | `browserbase-dont-stack-custom-retry-on-sdk-retry-fixed/no-custom-retry.ts`, `debug-log-no-retry-adversarial.ts` |

---

### Integration

Best practices for SDK usage and API interaction patterns.

| Rule | Severity | Browserbase docs | Rule file | Test |
| --- | --- | --- | --- | --- |
| Use SDK, not raw requests | info | [SDK reference](https://docs.browserbase.com/api-reference/api-client) | [use-sdk-not-raw-requests.ts](rules/use-sdk-not-raw-requests.ts) | [test](../../../tests/rules/browserbase-use-sdk-not-raw-requests.test.ts) |
| Centralize REQUEST_RELEASE | warning | [Session release](https://docs.browserbase.com/api-reference/sessions/release) | [centralize-request-release.ts](rules/centralize-request-release.ts) | [test](../../../tests/rules/browserbase-centralize-request-release.test.ts) |

#### Integration fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| --- | --- | --- |
| Use SDK, not raw requests | `browserbase-use-sdk-not-raw-requests-broken/fetch-raw-request.ts`, `manual-http-call.ts` | `browserbase-use-sdk-not-raw-requests-fixed/sdk-method-call.ts`, `internal-utility-call-adversarial.ts` |
| Centralize REQUEST_RELEASE | `browserbase-centralize-request-release-broken/scattered-release-calls.ts`, `release-in-multiple-places.ts` | `browserbase-centralize-request-release-fixed/single-release-handler.ts`, `no-release-needed-adversarial.ts` |

---

## Test summary

| Category    | Rules | Test files | Fixture pairs |
| ----------- | ----- | ---------- | -------------- |
| Security    | 3     | 3          | 3              |
| Correctness | 3     | 3          | 3              |
| Reliability | 3     | 3          | 3              |
| Integration | 2     | 2          | 2              |
| **Total**   | **11** | **11**    | **11**         |

### Running tests

```bash
# All Browserbase rule tests
pnpm build
npx vitest run tests/rules/browserbase-

# Single rule
npx vitest run tests/rules/browserbase-no-concurrent-shared-context.test.ts

# Lint a fixture directory end-to-end
node dist/cli.mjs tests/fixtures/browserbase/browserbase-no-concurrent-shared-context-broken
```

### Test harness

Rule tests use [tests/helpers/lint-rule.ts](../../../tests/helpers/lint-rule.ts):

- `fixtureDir(ruleKey, 'broken' | 'fixed', 'browserbase')` — resolves `tests/fixtures/browserbase/<rule-key>-<kind>/`
- `lintFileForRule(ruleKey, filePath)` — runs oxlint with only that rule enabled

---

## Severity in reports

| Severity | Count | Affects score |
| -------- | ----- | ------------- |
| error    | 5     | −15 each      |
| warning  | 4     | −5 each       |
| info     | 2     | no penalty    |

Structured reports include each rule's `meta.docs.rationale` under **Why this matters** (markdown export).

---

## Known detection limits

Rules operate per-file on the modular SDK's API shapes. A project that wraps SDK calls behind project-local helpers will hide the call shapes these rules look for. Pattern matching is SDK-version-specific — upgrading the SDK or using `@` version aliases may change detection accuracy.
