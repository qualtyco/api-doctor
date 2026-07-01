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
| Required audience validation | error | CWE-347, A07:2021 | Audience validation is silently skipped if AUTH0_AUDIENCE is unset in the environment, allowing tokens issued for other APIs to pass authentication. | [JWT for server-to-server](https://auth0.com/docs/get-started/authentication-and-authorization/client-credentials-flow) | [required-audience-validation.ts](rules/required-audience-validation.ts) | [test](../../../tests/rules/auth0-required-audience-validation.test.ts) |
| No account link without verified email | error | CWE-640, A01:2021 | User accounts are silently linked by matching an unverified email claim to an existing account, enabling account takeover if the email comes from an untrusted source. | [Link user accounts](https://auth0.com/docs/manage-users/user-accounts/user-account-linking) | [no-account-link-without-verified-email.ts](rules/no-account-link-without-verified-email.ts) | [test](../../../tests/rules/auth0-no-account-link-without-verified-email.test.ts) |

#### Security fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| --- | --- | --- |
| Required audience validation | `auth0-required-audience-validation-broken/no-audience-check.ts`, `substring-includes-audience.ts` | `auth0-required-audience-validation-fixed/eq-audience-check.ts`, `literal-true-string-check-adversarial.ts` |
| No account link without verified email | `auth0-no-account-link-without-verified-email-broken/prisma-findunique-relink.ts`, `userinfo-fallback-findfirst.ts` | `auth0-no-account-link-without-verified-email-fixed/namespaced-verified-claim-gate.ts`, `verified-gate-before-lookup-adversarial.ts` |

---

### Correctness

Token parsing logic and claim inspection.

| Rule | Severity | Why it matters | Auth0 docs | Rule file | Test |
| --- | --- | --- | --- | --- | --- |
| Dead claim verification check | error | The email_verified claim check is syntactically dead code and can never be true, masking the gate that prevents account takeover via unverified email (see Security section). | [Decode tokens](https://auth0.com/docs/get-started/authentication-and-authorization/validate-tokens/jwt-based-access-control) | [dead-claim-verification-check.ts](rules/dead-claim-verification-check.ts) | [test](../../../tests/rules/auth0-dead-claim-verification-check.test.ts) |

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

### Running tests

```bash
# All Auth0 rule tests
pnpm build
npx vitest run tests/rules/auth0-

# Single rule
npx vitest run tests/rules/auth0-required-audience-validation.test.ts

# Lint a fixture directory end-to-end
node dist/cli.mjs tests/fixtures/auth0/auth0-required-audience-validation-broken
```

### Test harness

Rule tests use [tests/helpers/lint-rule.ts](../../../tests/helpers/lint-rule.ts):

- `fixtureDir(ruleKey, 'broken' | 'fixed', 'auth0')` — resolves `tests/fixtures/auth0/<rule-key>-<kind>/`
- `lintFileForRule(ruleKey, filePath)` — runs oxlint with only that rule enabled

---

## Severity in reports

| Severity | Count | Affects score |
| -------- | ----- | ------------- |
| error    | 3     | −15 each      |
| warning  | 1     | −5 each       |

Structured reports include each rule's `meta.docs.rationale` under **Why this matters** (markdown export).
