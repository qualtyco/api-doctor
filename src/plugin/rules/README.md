# Rules

One subfolder per API/SDK. Each `.ts` file is one oxlint rule.

```
rules/
  resend/          13 rules — see providers/resend/README.md for the full catalog
    webhook-signature.ts
    api-key-hardcoded.ts
    ...
  stripe/          (empty — contribute here)
  acme/            (your provider)
```

## Naming

| What | Convention | Example |
|------|------------|---------|
| File | kebab-case, describes the check | `missing-idempotency-key.ts` |
| Plugin key | `<provider>-<check>` | `resend-missing-idempotency-key` |
| Report id | `<provider>/<category>/<check>` | `resend/reliability/missing-idempotency-key` |

Three names must stay in sync:

```
manifest oxlintRules[].key  →  resend-missing-idempotency-key
plugin rules object key     →  resend-missing-idempotency-key
oxlint rule id                →  api-doctor/resend-missing-idempotency-key
```

## Guidelines

- **AST visitors only** — match nodes, not regex over file text (string literals inside `Literal` nodes are fine)
- **One concern per file** — easier to test, enable, and review
- **Track state in closures** — `let importsResend = false` at `create()` scope
- **`Program:exit`** — for checks that need the whole file (webhook handlers, dedup signals)
- **Adversarial fixtures** — every rule needs fixed cases that look similar but must not flag

Reference implementation: [resend/webhook-signature.ts](resend/webhook-signature.ts)

## Tests per rule

```
tests/fixtures/resend/<rule-key>-broken/   should flag (2+ files)
tests/fixtures/resend/<rule-key>-fixed/    should not flag (2+ files)
tests/rules/<rule-key>.test.ts             vitest
```

Run a single rule's tests:

```bash
pnpm build
npx vitest run tests/rules/resend-missing-idempotency-key.test.ts
```

**Contributing a provider?** [providers/README.md](../../providers/README.md)
