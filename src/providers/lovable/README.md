# Lovable

4 oxlint rules for Lovable-generated apps (React/Vite + Lovable Cloud/Supabase).

|                          |                                      |
| ------------------------ | ------------------------------------ |
| **Manifest**             | [manifest.ts](manifest.ts)           |
| **Rule implementations** | [rules/](rules/)                     |
| **Shared AST helpers**   | [utils.ts](utils.ts)                 |
| **Fixtures**             | `tests/fixtures/lovable/`            |
| **Rule tests**           | `tests/rules/lovable-*.test.ts`      |

Detection: `lovable-tagger` in package.json or imports, or `lovable.dev`/`lovable.app` in source.

These rules target the gap between what Lovable's docs say should be server-side (Edge Functions: secrets, payments, scheduled jobs) and what commonly ends up running client-side instead. They cover common correctness issues in data validation and cost tracking in Lovable + Supabase apps.

---

## Rules and tests by category

### Security

Client-side secret exposure and payment-handling architecture.

| Rule | Severity | CWE / OWASP | Lovable docs | Rule file | Test |
| --- | --- | --- | --- | --- | --- |
| No client-side secret fetch | error | CWE-798, A02:2021 | [Edge Functions](https://lovable.dev/docs/edge-functions) | [no-client-side-secret-fetch.ts](rules/no-client-side-secret-fetch.ts) | [test](../../../tests/rules/lovable-no-client-side-secret-fetch.test.ts) |
| Paid flag without edge function | error | CWE-284, A01:2021 | [Billing](https://lovable.dev/docs/billing) | [paid-flag-without-edge-function.ts](rules/paid-flag-without-edge-function.ts) | [test](../../../tests/rules/lovable-paid-flag-without-edge-function.test.ts) |

#### Security fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| --- | --- | --- |
| No client-side secret fetch | `lovable-no-client-side-secret-fetch-broken/fetch-stripe-key.tsx`, `load-api-key-client.tsx` | `lovable-no-client-side-secret-fetch-fixed/edge-function-call.ts`, `env-public-key-adversarial.tsx` |
| Paid flag without edge function | `lovable-paid-flag-without-edge-function-broken/subscription-check-client.tsx`, `premium-feature-no-server.ts` | `lovable-paid-flag-without-edge-function-fixed/edge-function-check.ts`, `free-feature-client-adversarial.tsx` |

---

### Correctness

Data validation and expiry/cost tracking.

| Rule | Severity | Lovable docs | Rule file | Test |
| --- | --- | --- | --- | --- |
| Expiry column never checked | warning | [Billing](https://lovable.dev/docs/billing) | [expiry-column-never-checked.ts](rules/expiry-column-never-checked.ts) | [test](../../../tests/rules/lovable-expiry-column-never-checked.test.ts) |
| Silent catch on provider call | warning | [Handling errors](https://lovable.dev/docs/error-handling) | [silent-catch-on-provider-call.ts](rules/silent-catch-on-provider-call.ts) | [test](../../../tests/rules/lovable-silent-catch-on-provider-call.test.ts) |

#### Correctness fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| --- | --- | --- |
| Expiry column never checked | `lovable-expiry-column-never-checked-broken/fetch-without-filter.ts`, `skip-expiry-check.tsx` | `lovable-expiry-column-never-checked-fixed/filter-by-expiry.ts`, `only-select-adversarial.ts` |
| Silent catch on provider call | `lovable-silent-catch-on-provider-call-broken/catch-no-log.tsx`, `try-catch-swallow.ts` | `lovable-silent-catch-on-provider-call-fixed/log-in-catch.ts`, `conditional-throw-adversarial.ts` |

---

## Test summary

| Category    | Rules | Test files | Fixture pairs |
| ----------- | ----- | ---------- | -------------- |
| Security    | 2     | 2          | 2              |
| Correctness | 2     | 2          | 2              |
| **Total**   | **4** | **4**      | **4**          |

### Running tests

```bash
# All Lovable rule tests
pnpm build
npx vitest run tests/rules/lovable-

# Single rule
npx vitest run tests/rules/lovable-no-client-side-secret-fetch.test.ts

# Lint a fixture directory end-to-end
node dist/cli.mjs tests/fixtures/lovable/lovable-no-client-side-secret-fetch-broken
```

### Test harness

Rule tests use [tests/helpers/lint-rule.ts](../../../tests/helpers/lint-rule.ts):

- `fixtureDir(ruleKey, 'broken' | 'fixed', 'lovable')` — resolves `tests/fixtures/lovable/<rule-key>-<kind>/`
- `lintFileForRule(ruleKey, filePath)` — runs oxlint with only that rule enabled

---

## Severity in reports

| Severity | Count | Affects score |
| -------- | ----- | ------------- |
| error    | 2     | −15 each      |
| warning  | 2     | −5 each       |

Structured reports include each rule's `meta.docs.rationale` under **Why this matters** (markdown export).

---

## Out of scope

These patterns require cross-file analysis or non-JS resources — not detectable via single-file AST rules:

- **Postgres RLS policies missing column-level `WITH CHECK` scoping** — Lives in `.sql` migration files; the scanner only walks `.ts/.tsx/.js/.jsx` files.
- **Default/unreplaced social-preview (Open Graph) image and metadata** — Lives in `index.html` meta tags, not parsed by oxlint.
- **No Supabase Edge Functions despite client-side secrets/payment code** — Requires directory-absence check (`supabase/functions/` missing) cross-referenced with findings — project-structure-level, not a single-file rule.

**Single-file limitations:** `expiry-column-never-checked` and `paid-flag-without-edge-function` only analyze one file at a time — a column written in one file and read/filtered in another won't be fully reconciled across the whole project.
