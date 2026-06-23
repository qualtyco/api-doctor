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

## Node-specific notes

These rules target the Node SDK (`@browserbasehq/sdk`) specifically, with field/behavior names verified directly against the live `github.com/browserbase/sdk-node` source rather than assumed from another language's SDK. A few names diverge from what you might expect if you're used to a different Browserbase SDK:

- **Mobile device emulation**: the Node SDK has **no `fingerprint.devices`/`operatingSystems` field at all**. Node's device-emulation lever is `browserSettings.os: 'mobile' | 'tablet'` — see `mobile-device-requires-os-setting.ts`.
- **Shared context**: `contextId` is **not top-level** — it's nested at `browserSettings.context.id` (with `persist?: boolean`).
- **Error handling**: `Browserbase.APIError` carries `.status`, and there is no dedicated `410` subclass — the SDK defaults to 2 automatic internal retries.

No Browserbase sample project was available to CLI-smoke-test these rules against (unlike the Firebase rule pack, which validated against a real codebase) — fixtures are synthetic Express/Next.js-style Node code constructed to match each pattern.

---

## Rules by category

### Security

| Rule                                       | Severity | CWE / OWASP        | Rule file                                                                              |
| -------------------------------------------- | -------- | -------------------- | ----------------------------------------------------------------------------------------- |
| No conditional authz on anonymous user      | error    | CWE-862, A01:2021    | [no-conditional-authz-on-anonymous-user.ts](rules/no-conditional-authz-on-anonymous-user.ts) |
| No connectUrl in API response               | error    | CWE-200, A04:2021    | [no-connect-url-in-api-response.ts](rules/no-connect-url-in-api-response.ts)              |
| Session id requires ownership check         | warning  | CWE-862              | [session-id-requires-ownership-check.ts](rules/session-id-requires-ownership-check.ts)    |

### Correctness

| Rule                                  | Severity | Rule file                                                                  |
| --------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| No concurrent shared context           | error    | [no-concurrent-shared-context.ts](rules/no-concurrent-shared-context.ts)      |
| Mobile device requires os setting      | error    | [mobile-device-requires-os-setting.ts](rules/mobile-device-requires-os-setting.ts) |
| Use typed exception status, not substring | info  | [use-typed-exception-status-not-substring.ts](rules/use-typed-exception-status-not-substring.ts) |

### Reliability

| Rule                                       | Severity | Rule file                                                                            |
| --------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| Release session on connect failure          | error    | [release-session-on-connect-failure.ts](rules/release-session-on-connect-failure.ts)      |
| Don't stack custom retry on SDK retry       | warning  | [dont-stack-custom-retry-on-sdk-retry.ts](rules/dont-stack-custom-retry-on-sdk-retry.ts)  |
| No overbroad error substring match          | error    | [no-overbroad-error-substring-match.ts](rules/no-overbroad-error-substring-match.ts)      |

### Integration

| Rule                              | Severity | Rule file                                                            |
| ----------------------------------- | -------- | ------------------------------------------------------------------------ |
| Use SDK, not raw requests          | info     | [use-sdk-not-raw-requests.ts](rules/use-sdk-not-raw-requests.ts)         |
| Centralize REQUEST_RELEASE          | warning  | [centralize-request-release.ts](rules/centralize-request-release.ts)    |

Each rule's fixtures live at `tests/fixtures/browserbase/browserbase-<rule-name>-{broken,fixed}/` (2 broken + 2 fixed, one fixed fixture adversarial, per rule) with a matching test at `tests/rules/browserbase-<rule-name>.test.ts`.

### Running tests

```bash
pnpm build
npx vitest run tests/rules/browserbase-

# Single rule
npx vitest run tests/rules/browserbase-no-concurrent-shared-context.test.ts

# Lint a fixture directory end-to-end
node dist/cli.mjs tests/fixtures/browserbase/browserbase-no-concurrent-shared-context-broken
```

## Rules not implemented

- **Fake recorder keep-alive ping**: requires modeling Browserbase's timeout semantics (no heartbeat extends an active session), not a detectable code shape in isolation.
- **Inconsistent env-var validation failure mode**: a generic "validate env vars before use" lint would catch this without being Browserbase-specific.
