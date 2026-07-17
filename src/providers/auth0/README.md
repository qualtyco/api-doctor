# Auth0

4 oxlint rules for manual Auth0 JWT verification in Node/TypeScript backends (`jsonwebtoken` + `jwks-rsa`, or `express-jwt`).

|                          |                                      |
| ------------------------ | ------------------------------------ |
| **Manifest**             | [manifest.ts](manifest.ts)           |
| **Rule implementations** | [rules/](rules/)                     |
| **Fixtures**             | `tests/fixtures/auth0/`              |
| **Rule tests**           | `tests/rules/auth0-*.test.ts`        |

Detection: `jsonwebtoken`, `jwks-rsa`, or `express-jwt` in package.json or imports, or `auth0.com` in source.

These rules target manual JWT verification with `jsonwebtoken`/`jwks-rsa`/`express-jwt` — the common hand-rolled pattern for validating Auth0-issued tokens in a Node/Express API, as opposed to using a managed middleware that handles verification end-to-end. They cover the failure modes most specific to that pattern: audience checks that silently become optional, account-linking that trusts an unverified email claim, dead verification logic from a stringify/substring bug, and JWKS caches that don't recover after a signing-key rotation.

---

## Rules and tests by category

### Security

JWT verification correctness and payload trust in account linking.

| Rule | Severity | CWE / OWASP | Why it matters | Auth0 docs | Rule file | Test |
| --- | --- | --- | --- | --- | --- | --- |
| Required audience validation | error | CWE-347, A07:2021 | Audience validation is silently skipped if AUTH0_AUDIENCE is unset in the environment, allowing tokens issued for other APIs to pass authentication. Applies equally to direct `jwt.verify()` and `express-jwt` middleware — either is a valid verification path, as long as `audience` is unconditional in it. | [Validate JSON Web Tokens](https://auth0.com/docs/secure/tokens/json-web-tokens/validate-json-web-tokens) | [required-audience-validation.ts](rules/required-audience-validation.ts) | [test](../../../tests/rules/auth0-required-audience-validation.test.ts) |
| No account link without verified email | error | CWE-640, A01:2021 | User accounts are silently linked by matching an unverified email claim to an existing account, enabling account takeover if the email comes from an untrusted source. | [Link user accounts](https://auth0.com/docs/manage-users/user-accounts/user-account-linking) | [no-account-link-without-verified-email.ts](rules/no-account-link-without-verified-email.ts) | [test](../../../tests/rules/auth0-no-account-link-without-verified-email.test.ts) |

#### Security fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| --- | --- | --- |
| Required audience validation | `auth0-required-audience-validation-broken/jwt-verify-missing-audience.ts` (direct `jwt.verify()`), `express-jwt-conditional-audience.ts` (middleware) | `auth0-required-audience-validation-fixed/jwt-verify-with-audience.ts` (direct `jwt.verify()`), `express-jwt-fail-closed-audience.ts` (middleware) |
| No account link without verified email | `auth0-no-account-link-without-verified-email-broken/prisma-findunique-relink.ts`, `userinfo-fallback-findfirst.ts` | `auth0-no-account-link-without-verified-email-fixed/namespaced-verified-claim-gate.ts`, `verified-gate-before-lookup-adversarial.ts` |

---

### Correctness

Token parsing logic and claim inspection.

| Rule | Severity | Why it matters | Auth0 docs | Rule file | Test |
| --- | --- | --- | --- | --- | --- |
| Dead claim verification check | error | The email_verified claim check is syntactically dead code and can never be true, masking the gate that prevents account takeover via unverified email (see Security section). | [Decode tokens](https://auth0.com/docs/secure/tokens/json-web-tokens/json-web-token-claims) | [dead-claim-verification-check.ts](rules/dead-claim-verification-check.ts) | [test](../../../tests/rules/auth0-dead-claim-verification-check.test.ts) |

> **Dead claim verification check — the `true`/`false` exception:** `.includes('true')` / `.includes('false')` against a stringified boolean claim is allowed — those are the only two strings a stringified boolean can produce, so the check is functional (if unidiomatic). Anything else (`'yes'`, `'1'`, wrong casing, etc.) is unreachable, which is exactly the copy-paste/typo mistake this rule catches.

#### Correctness fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| --- | --- | --- |
| Dead claim verification check | `auth0-dead-claim-verification-check-broken/string-wrap-includes.ts`, `tostring-includes.ts` | `auth0-dead-claim-verification-check-fixed/direct-boolean-check.ts`, `literal-true-string-check.ts` |

---

### Reliability

JWKS cache refresh on key rotation.

| Rule | Severity | Why it matters | Auth0 docs | Rule file | Test |
| --- | --- | --- | --- | --- | --- |
| JWKS refresh on unknown kid | warning | JWKS is cached for 24 hours with no fallback when a token's key ID is unknown; after Auth0 rotates signing keys, new tokens fail to validate for up to 24h until the cache naturally expires. | [JWKS endpoint](https://auth0.com/docs/secure/tokens/json-web-tokens/json-web-key-set-properties) | [jwks-refresh-on-unknown-kid.ts](rules/jwks-refresh-on-unknown-kid.ts) | [test](../../../tests/rules/auth0-jwks-refresh-on-unknown-kid.test.ts) |

> **In plain terms:** Auth0 occasionally swaps its signing keys, like changing a lock. Apps cache the key set instead of fetching it on every request. If Auth0 swaps keys while that cache is still "fresh," a new token's key ID (`kid`) won't be found — and unless the code goes and fetches a fresh copy right then, every legitimate token fails until the cache times out on its own (up to 24h). This rule flags key-lookup code with no such fallback.

#### Reliability fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| --- | --- | --- |
| JWKS refresh on unknown kid | `auth0-jwks-refresh-on-unknown-kid-broken/async-await-single-load.ts`, `ttl-cache-callback-no-retry.ts` | `auth0-jwks-refresh-on-unknown-kid-fixed/always-fresh-single-call.ts`, `retry-with-forced-refresh.ts` |

---

## Test summary

| Category    | Rules | Test files | Fixture pairs |
| ----------- | ----- | ---------- | -------------- |
| Security    | 2     | 2          | 2              |
| Correctness | 1     | 1          | 1              |
| Reliability | 1     | 1          | 1              |
| **Total**   | **4** | **4**      | **4**          |
