---
name: rule-author
description: Converts a provider audit document into AST-based oxlint rules, fixtures, and tests in the api-doctor monorepo. Reads docs/audits/<provider>-audit-<date>.md and writes to packages/oxlint-plugin-api-doctor/. Use when Reuben says "write the rules from the audit," "implement the <provider> rule pack," or "convert audit <path> into oxlint rules."
---

# Rule Author Skill

Convert audit findings into oxlint rules, fixtures, and tests. The audit is the source of truth — do not invent provider facts, do not add findings not in the audit, do not skip rules from the recommended list.

## Required inputs

Confirm before starting:

1. Path to audit document (e.g., `docs/audits/stripe-audit-2026-07-10.md`)
2. Provider name (read from audit, confirm)
3. Whether any rules in the recommended list should be skipped

If the audit doesn't exist or has fewer than 13 findings, stop and tell Reuben to re-run the audit first.

The reference rule is `resend/webhook-signature-missing` — match its structure.

## Process

### 1. Plan

Read the audit. Extract the recommended rule list and adversarial findings. Present this plan to Reuben:

> "Implementing N rules from `<audit-path>`:
> 1. `<provider>/<rule-1>` (Finding A) — critical, security
> 2. `<provider>/<rule-2>` (Finding C) — high, correctness
> ...
>
> Per rule: 1 rule file + 2 broken fixtures + 2 fixed fixtures (≥1 adversarial) + 1 test = 6 files.
>
> Implement one at a time, pause after each. Start with rule 1?"

Wait for confirmation.

### 2. Implement each rule

For each rule, in audit-priority order:

**(a) Rule file** at `src/plugin/rules/<provider>-<rule-name>.ts`:

````typescript
export default {
  meta: {
    type: 'problem' | 'suggestion',     // 'problem' for error, 'suggestion' for warning/info
    docs: {
      description: '<from audit finding title>',
      category: '<security | correctness | reliability | integration>',
      docsUrl: '<from audit>',
      cwe: '<if security>',
      owasp: '<if security>',
      rationale: '<2-3 sentences, why this matters>',
    },
    messages: { <messageId>: '<message text>' },
    schema: [],
  },
  create(context) {
    // AST visitors only — no source.includes()
    return {
      ImportDeclaration(node) { /* track imports */ },
      CallExpression(node) { /* track calls */ },
      'Program:exit'() { /* report */ },
    };
  },
};
````

**Detection constraints:**
- AST visitors only. No `source.includes()` except for content inside string literals (e.g., checking HTML templates for placeholders).
- Handle renamed imports: `import { Webhook as MyHook } from 'svix'` is still a Svix import.
- Handle dynamic property access: `resend["emails"]["send"]` is the same as `resend.emails.send`.
- Skip test files for security/correctness rules where appropriate (paths matching `/test/`, `*.test.ts`, etc.).

**(b) Broken fixtures** at `tests/fixtures/<provider>/<rule-name>-broken/`:

Two fixtures, 10-40 lines each. Use realistic patterns from the audit's "Affected files" (Next.js App Router by default). The two fixtures must demonstrate *distinct* manifestations of the bug, not the same pattern twice.

**(c) Fixed fixtures** at `tests/fixtures/<provider>/<rule-name>-fixed/`:

Two fixtures:
- One straightforward correct version
- At least one adversarial: code that looks like it should trigger the rule but is actually correct. Use the audit's adversarial findings; if none map, construct one (e.g., for `api-key-hardcoded`, a string `"re_test_dummy"` inside a comment).

**(d) Test** at `tests/rules/<provider>-<rule-name>.test.ts`:

Use vitest, matching the existing test pattern. Assert:
- Each broken fixture produces ≥1 diagnostic
- Each fixed fixture produces 0 diagnostics
- Diagnostic's `messageId` matches expected

**(e) Register** the rule in `src/index.ts`.

**(f) Verify before continuing:**
1. Run `pnpm test`. All previous tests still pass.
2. Confirm new rule fires on broken fixtures, not on fixed.
3. Confirm new rule doesn't false-positive on *other* rules' fixtures.

Then status update:

> "Rule N complete: `<provider>/<rule-name>`. All tests pass. Cross-rule false-positives: none. Ready for rule N+1?"

Wait for confirmation.

### 3. Extract shared utilities (only on second occurrence)

When a pattern appears in two rules, extract to `src/plugin/utils/`:

- `is<Provider>Import(node)`
- `is<Provider>SendCall(node)`
- `getCallOptions(node, argIndex)`
- `findPropertyInObject(objectExpression, propertyName)`
- `isInsideTestFile(filename)`
- `isClientSideFile(source, filename)`

**Never extract on first occurrence.** Wait for the second.

### 4. Final pass

After all rules implemented:

1. Run `pnpm test` — all green.
2. Run the api-doctor CLI against the audit's sample-project directory.
3. Verify each audit finding from the recommended list is caught by its corresponding rule.
4. Produce summary:

> "All N rules implemented and tested.
>
> CLI smoke test vs. `<sample-project-path>`:
> - Findings caught: X / Y
> - Findings missed: <list with reason — usually `detectability=N`>
>
> Files: N rule files, N×4 fixtures, N test files. Utility extractions: <list>.
>
> Ready to commit."

## Critical rules

1. **Audit is the source of truth.** If you need a detail not in it, stop and ask. Do not guess.
2. **Don't consolidate rules.** Each recommended rule = its own file. Don't merge "similar" ones.
3. **Match audit severity.** `error` → `meta.type: 'problem'`. `warning` or `info` → `'suggestion'`.
4. **Fixtures match audit's affected files.** Use the same patterns the audit found in real agent code.
5. **Adversarial fixtures non-negotiable.** One per rule, minimum.
6. **Implement in audit priority order.** Don't skip or reorder without asking.
7. **Pause after each rule.** Quality lives in the pauses.

## Common failure modes

- **Drifting to string matching.** If you write `source.includes()` in `create()`, stop and rewrite as AST visitors.
- **Premature utility extraction.** Wait for the second occurrence.
- **Skipping cross-rule false-positive check.** A new rule can fire incorrectly on fixtures from other rules. Always run the full test suite.
- **Skipping the CLI smoke test in step 4.** This is how you verify the rules actually catch what the audit found.

## What this skill does NOT do

- Modify the audit (re-run `provider-audit` if it's wrong)
- Modify `packages/api-doctor/` (CLI is out of scope)
- Publish to npm
- Add provider detection registration (separate task)
- Write rules not in the audit's recommended list