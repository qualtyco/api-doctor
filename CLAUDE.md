# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install        # install deps
pnpm build          # compile src/ → dist/ (tsup bundles cli.ts + plugin/index.ts)
pnpm dev            # watch mode
pnpm test           # vitest run (builds once via globalSetup before workers)
```

Run a single rule's tests (requires a prior build):

```bash
pnpm build && npx vitest run tests/rules/resend-missing-idempotency-key.test.ts
```

Smoke-test against a fixture directory:

```bash
node dist/cli.mjs tests/fixtures/resend/resend-api-key-hardcoded-broken
```

## Architecture

Two outputs from a single build (`tsup.config.ts`):

| Output | Entry | Description |
|--------|-------|-------------|
| `dist/cli.{mjs,cjs}` | `src/cli.ts` | CLI binary (`api-doctor` bin) |
| `dist/plugin.js` | `src/plugin/index.ts` | Oxlint JS plugin (consumed by the CLI and directly by users) |

### Data flow

```
cli.ts
  └─ scan()                    scanner.ts
       ├─ detectProviders()     detector.ts + providers/*/manifest.ts
       ├─ buildOxlintConfig()   enables api-doctor/<key> rules per detected SDK
       ├─ oxlint --format json  runs plugin/rules/<provider>/*.ts (AST-based)
       └─ ScanResult[]
  └─ buildReport()             reporter/report-builder.ts
  └─ emitReport()              reporter/ → terminal | json | markdown | file
```

Detection reads **manifests only**. Linting runs the **plugin**. Reporting merges oxlint diagnostics with manifest metadata (`message`, `fix`, `docsUrl`, `severity`) and rule docs (`category`, `rationale`, `cwe`, `owasp`) from `plugin/rule-registry.ts`.

### Provider = manifest + rules

Every provider is two linked pieces:

- `src/providers/<name>/manifest.ts` — detection signals + rule metadata shown in CLI output
- `src/plugin/rules/<name>/*.ts` — one file per oxlint AST rule

### Three names that must stay in sync

```
manifest oxlintRules[].key  →  resend-missing-idempotency-key
plugin rules object key     →  resend-missing-idempotency-key
oxlint rule id              →  api-doctor/resend-missing-idempotency-key
```

### Test layout

```
tests/
├── fixtures/<provider>/<rule-key>-broken/   should flag (2+ files each)
├── fixtures/<provider>/<rule-key>-fixed/    should not flag
├── rules/<rule-key>.test.ts                 one vitest file per rule
├── scanner.test.ts                          end-to-end scan()
├── reporter/                                snippet, report-builder, cli-output
└── helpers/lint-rule.ts                     shared oxlint harness
```

Fixture files may be named `*.test.ts` to exercise test-file detection; they are excluded from vitest via `vitest.config.ts`.

## Adding a rule (checklist)

1. `src/plugin/rules/<provider>/<check>.ts` — AST visitors, named export + default export
2. Register in `src/plugin/index.ts` (key = manifest key)
3. Add entry in `src/providers/<provider>/manifest.ts` → `oxlintRules[]`
4. Add `getRuleDocsMeta` entry in `src/plugin/rule-registry.ts`
5. `tests/fixtures/<provider>/<rule-key>-broken/` (2+ files)
6. `tests/fixtures/<provider>/<rule-key>-fixed/` (2+ files)
7. `tests/rules/<rule-key>.test.ts` — copy an existing Resend test
8. `pnpm build && pnpm test`

`scanner.ts` reads manifests automatically — do not edit it when adding rules.

## Rule implementation notes

- Use AST visitors (`CallExpression`, `ImportDeclaration`, `Program:exit`), never regex over raw source text (string literals inside `Literal` nodes are fine).
- Track file-level state in closures (`let importsResend = false` at `create()` scope); use `Program:exit` for whole-file checks.
- Shared AST helpers for Resend rules live in `src/plugin/utils/resend.ts`. Extract a helper when two or more rules share the same AST pattern.
- Reference implementation: `src/plugin/rules/resend/webhook-signature.ts`
