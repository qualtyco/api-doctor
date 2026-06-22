# Supabase

12 oxlint rules for the [Supabase](https://supabase.com) JavaScript client (`@supabase/supabase-js`).

|                          |                                      |
| ------------------------ | ------------------------------------ |
| **Manifest**             | [manifest.ts](manifest.ts)           |
| **Rule implementations** | [rules/](rules/)                     |
| **Shared AST helpers**   | [utils.ts](utils.ts)                 |
| **Fixtures**             | `tests/fixtures/supabase/`           |
| **Rule tests**           | `tests/rules/supabase-*.test.ts`     |
| **Source audit**         | [docs/audits/supabase-audit-2026-06-21.md](../../../docs/audits/supabase-audit-2026-06-21.md) |

Detection: `@supabase/supabase-js` in package.json, `import from '@supabase/supabase-js'`, or `supabase.co` in source.

Six rules from the [2026-06-21 audit](../../../docs/audits/supabase-audit-2026-06-21.md) target the `{ data, error }` return contract, Realtime fan-out, storage upload handling, and `user_metadata` authorization mistakes common in agent-generated apps.

---

## Rules and tests by category

### Security

Client-writable JWT metadata used as authorization.

| Rule | Severity | CWE / OWASP | Supabase docs | Rule file | Test |
| --- | --- | --- | --- | --- | --- |
| No user_metadata authz | error | CWE-285, A01:2021 | [RLS — user vs app metadata](https://supabase.com/docs/guides/database/postgres/row-level-security) | [no-user-metadata-authz.ts](rules/no-user-metadata-authz.ts) | [supabase-no-user-metadata-authz.test.ts](../../../tests/rules/supabase-no-user-metadata-authz.test.ts) |

#### Fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| --- | --- | --- |
| No user_metadata authz | `supabase-no-user-metadata-authz-broken/01-get-user-role.ts`, `02-signup-role-in-data.ts` | `supabase-no-user-metadata-authz-fixed/01-app-metadata-only.ts`, `02-profile-table-lookup-adversarial.ts` |

---

### Correctness

Query scoping, validation, and Supabase's non-throwing `{ data, error }` contract.

| Rule | Severity | Supabase docs | Rule file | Test |
| --- | --- | --- | --- | --- |
| Scope queries by tenant column | error | [`.eq()`](https://supabase.com/docs/reference/javascript/eq) | [scope-queries-by-tenant-column.ts](rules/scope-queries-by-tenant-column.ts) | [supabase-scope-queries-by-tenant-column.test.ts](../../../tests/rules/supabase-scope-queries-by-tenant-column.test.ts) |
| Single without error check | warning | [`.single()`](https://supabase.com/docs/reference/javascript/single) | [single-without-error-check.ts](rules/single-without-error-check.ts) | [supabase-single-without-error-check.test.ts](../../../tests/rules/supabase-single-without-error-check.test.ts) |
| Unchecked mutation error | warning | [`.insert()`](https://supabase.com/docs/reference/javascript/insert) | [unchecked-mutation-error.ts](rules/unchecked-mutation-error.ts) | [supabase-unchecked-mutation-error.test.ts](../../../tests/rules/supabase-unchecked-mutation-error.test.ts) |
| Non-atomic replace pattern | warning | [Database functions](https://supabase.com/docs/guides/database/functions) | [non-atomic-replace-pattern.ts](rules/non-atomic-replace-pattern.ts) | [supabase-non-atomic-replace-pattern.test.ts](../../../tests/rules/supabase-non-atomic-replace-pattern.test.ts) |
| Consistent input length limits | warning | [Tables](https://supabase.com/docs/guides/database/tables) | [consistent-input-length-limits.ts](rules/consistent-input-length-limits.ts) | [supabase-consistent-input-length-limits.test.ts](../../../tests/rules/supabase-consistent-input-length-limits.test.ts) |
| Validate UUID columns | info | [Data types](https://supabase.com/docs/guides/database/tables#data-types) | [validate-uuid-columns.ts](rules/validate-uuid-columns.ts) | [supabase-validate-uuid-columns.test.ts](../../../tests/rules/supabase-validate-uuid-columns.test.ts) |
| Order by timestamp not identity | info | [`.order()`](https://supabase.com/docs/reference/javascript/order) | [order-by-timestamp-not-identity.ts](rules/order-by-timestamp-not-identity.ts) | [supabase-order-by-timestamp-not-identity.test.ts](../../../tests/rules/supabase-order-by-timestamp-not-identity.test.ts) |

#### Fixtures

| Rule | Broken | Fixed |
| --- | --- | --- |
| Scope queries by tenant column | `supabase-scope-queries-by-tenant-column-broken/01-history-route.ts`, `02-orders-by-user.ts` | `supabase-scope-queries-by-tenant-column-fixed/01-eq-filter.ts`, `02-match-filter-adversarial.ts` |
| Single without error check | `supabase-single-without-error-check-broken/01-project-detail.ts`, `02-edit-prefill.ts` | `supabase-single-without-error-check-fixed/01-checks-error.ts`, `02-maybe-single-adversarial.ts` |
| Unchecked mutation error | `supabase-unchecked-mutation-error-broken/01-save-for-later.ts`, `02-send-reply.ts` | `supabase-unchecked-mutation-error-fixed/01-checks-error.ts`, `02-select-not-mutation-adversarial.ts` |
| Non-atomic replace pattern | `supabase-non-atomic-replace-pattern-broken/01-education-replace.ts`, `02-experiences-replace.ts` | `supabase-non-atomic-replace-pattern-fixed/01-checks-both-steps.ts`, `02-delete-only-adversarial.ts` |
| Consistent input length limits | `supabase-consistent-input-length-limits-broken/01-history-post.ts`, `02-comments-upsert.ts`, `03-nullish-coalesced-value.ts` | `supabase-consistent-input-length-limits-fixed/01-all-capped.ts`, `02-uniformly-uncapped-adversarial.ts` |
| Validate UUID columns | `supabase-validate-uuid-columns-broken/01-history-post.ts`, `02-accounts-upsert.ts`, `03-nullish-coalesced-value.ts` | `supabase-validate-uuid-columns-fixed/01-uuid-regex-check.ts`, `02-non-uuid-named-regex-adversarial.ts` |
| Order by timestamp not identity | `supabase-order-by-timestamp-not-identity-broken/01-history-route.ts`, `02-messages-updated-at.ts` | `supabase-order-by-timestamp-not-identity-fixed/01-order-by-created-at.ts`, `02-two-chains-adversarial.ts` |

---

### Reliability

Idempotency, env validation, Realtime scope, and storage error surfacing.

| Rule | Severity | Supabase docs | Rule file | Test |
| --- | --- | --- | --- | --- |
| Realtime missing filter | error | [Realtime filtering](https://supabase.com/docs/guides/realtime/postgres-changes#filtering) | [realtime-missing-filter.ts](rules/realtime-missing-filter.ts) | [supabase-realtime-missing-filter.test.ts](../../../tests/rules/supabase-realtime-missing-filter.test.ts) |
| Idempotent mutations | warning | [`.upsert()`](https://supabase.com/docs/reference/javascript/upsert) | [idempotent-mutations.ts](rules/idempotent-mutations.ts) | [supabase-idempotent-mutations.test.ts](../../../tests/rules/supabase-idempotent-mutations.test.ts) |
| Fail-fast env validation | warning | [Initializing](https://supabase.com/docs/reference/javascript/initializing) | [fail-fast-env-validation.ts](rules/fail-fast-env-validation.ts) | [supabase-fail-fast-env-validation.test.ts](../../../tests/rules/supabase-fail-fast-env-validation.test.ts) |
| Storage error not surfaced | warning | [Storage upload](https://supabase.com/docs/reference/javascript/storage-from-upload) | [storage-error-not-surfaced.ts](rules/storage-error-not-surfaced.ts) | [supabase-storage-error-not-surfaced.test.ts](../../../tests/rules/supabase-storage-error-not-surfaced.test.ts) |

#### Fixtures

| Rule | Broken | Fixed |
| --- | --- | --- |
| Realtime missing filter | `supabase-realtime-missing-filter-broken/01-app-layout.ts`, `02-messages-page.ts` | `supabase-realtime-missing-filter-fixed/01-filtered-subscription.ts`, `02-non-postgres-changes-adversarial.ts` |
| Idempotent mutations | `supabase-idempotent-mutations-broken/01-history-insert.ts`, `02-orders-array-insert.ts` | `supabase-idempotent-mutations-fixed/01-insert-with-idempotency-key.ts`, `02-upsert-on-conflict-adversarial.ts` |
| Fail-fast env validation | `supabase-fail-fast-env-validation-broken/01-lib-supabase.ts`, `02-cleanup-script.ts` | `supabase-fail-fast-env-validation-fixed/01-guarded-extracted-vars.ts`, `02-non-env-args-adversarial.ts` |
| Storage error not surfaced | `supabase-storage-error-not-surfaced-broken/01-avatar-upload.ts`, `02-resume-upload.ts` | `supabase-storage-error-not-surfaced-fixed/01-throws-on-upload-error.ts`, `02-else-branch-adversarial.ts` |

---

## Test summary

| Category | Rules | Test files | Fixture pairs |
| --- | --- | --- | --- |
| Security | 1 | 1 | 1 |
| Correctness | 7 | 7 | 7 |
| Reliability | 4 | 4 | 4 |
| **Total** | **12** | **12 rule tests** | **12 broken/fixed dirs** |

### Running tests

```bash
# All Supabase rule tests
pnpm build
npx vitest run tests/rules/supabase-

# Single rule
npx vitest run tests/rules/supabase-unchecked-mutation-error.test.ts

# Lint a fixture directory end-to-end
node dist/cli.mjs tests/fixtures/supabase/supabase-unchecked-mutation-error-broken
```

### Test harness

Rule tests use [tests/helpers/lint-rule.ts](../../../tests/helpers/lint-rule.ts):

- `fixtureDir(ruleKey, 'broken' | 'fixed', 'supabase')` — resolves `tests/fixtures/supabase/<rule-key>-<kind>/`
- `lintFileForRule(ruleKey, filePath)` — runs oxlint with only that rule enabled

---

## Severity in reports

| Severity | Count | Affects score |
| --- | --- | --- |
| error | 3 rules | −15 each |
| warning | 7 rules | −5 each |
| info | 2 rules | no penalty |

Structured reports include each rule's `meta.docs.rationale` under **Why this matters** (markdown export).

---

## Out of scope (documented in audit, not AST rules)

These findings from the [2026-06-21 audit](../../../docs/audits/supabase-audit-2026-06-21.md) require migration SQL or config cross-reference — not detectable in JS/TS source alone:

- Public storage buckets for PII documents (Finding B)
- RLS `USING (true)` on participant tables (Finding C)
- Client-writable payment status columns (Finding D)
- Auth trigger exception handling (Finding J)
- MCP `project_ref` not pinned (Finding L)
- CLI link vs runtime project drift (Finding M)
