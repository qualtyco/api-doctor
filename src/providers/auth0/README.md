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

## Rules

| Rule | Category | Severity |
| --- | --- | --- |
| `auth0-required-audience-validation` | security | error |
| `auth0-no-account-link-without-verified-email` | security | error |
| `auth0-dead-claim-verification-check` | correctness | error |
| `auth0-jwks-refresh-on-unknown-kid` | reliability | warning |
