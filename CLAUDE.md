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

### Source layout

```
src/
├── cli.ts              Entry point — parses flags, runs scan, emits output, exits
├── scanner.ts          Walks files, detects providers, shells out to oxlint
├── detector.ts         package.json / import / URL-pattern heuristics
├── types.ts            Shared contracts (ScanResult, Report, Finding, manifests)
├── reporter/           Terminal, JSON, markdown, and file output
├── plugin/
│   ├── index.ts        Oxlint plugin entrypoint — imports rules from providers/
│   └── rule-registry.ts  Reads meta.docs from each rule; used by report-builder
└── providers/
    ├── index.ts        Registers all provider manifests
    └── <name>/
        ├── manifest.ts   Detection signals + CLI-facing rule metadata
        ├── utils.ts      Shared AST helpers (provider-specific)
        ├── rules/        One .ts file per oxlint check
        └── README.md     Rule catalog for this provider
```

### Data flow

```
cli.ts
  └─ scan()                    scanner.ts
       ├─ detectProviders()     detector.ts + providers/*/manifest.ts
       ├─ buildOxlintConfig()   enables api-doctor/<key> rules per detected SDK
       ├─ oxlint --format json  runs providers/<name>/rules/*.ts (AST-based)
       └─ ScanResult[]
  └─ buildReport()             reporter/report-builder.ts
  └─ emitReport()              reporter/ → terminal | json | markdown | file
```

Detection reads **manifests only**. Linting runs the **plugin**. Reporting merges oxlint diagnostics with manifest metadata (`message`, `fix`, `docsUrl`, `severity`) and rule docs from `plugin/rule-registry.ts` (which reads `meta.docs` directly from the rule objects).

### Three names that must stay in sync

```
manifest oxlintRules[].key  →  resend-missing-idempotency-key
plugin/index.ts object key  →  resend-missing-idempotency-key
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

Fixture files may be named `*.test.ts` to exercise test-file detection; vitest excludes `tests/fixtures/**`.

## Adding a rule (checklist)

1. `src/providers/<name>/rules/<check>.ts` — AST visitors, named export + default export
2. Register in `src/plugin/index.ts` — import path is `../providers/<name>/rules/<check>.js`
3. Add entry to `src/providers/<name>/manifest.ts` → `oxlintRules[]`
4. Add entry to `src/plugin/rule-registry.ts` (reads `meta.docs` automatically — verify `buildRegistry()` covers the new key)
5. `tests/fixtures/<name>/<rule-key>-broken/` (2+ files)
6. `tests/fixtures/<name>/<rule-key>-fixed/` (2+ files)
7. `tests/rules/<rule-key>.test.ts` — copy an existing Resend test
8. `pnpm build && pnpm test`

`scanner.ts` reads manifests automatically — do not edit it when adding rules.

## Adding a new provider (checklist)

1. `src/providers/<name>/manifest.ts` — detection signals + `oxlintRules[]`
2. `src/providers/<name>/rules/*.ts` — one file per check
3. `src/providers/<name>/utils.ts` — shared AST helpers (if needed)
4. `src/providers/<name>/README.md` — rule catalog by category
5. Register manifest in `src/providers/index.ts`
6. Register rules in `src/plugin/index.ts`
7. Fixtures and tests under `tests/`
8. `pnpm build && pnpm test`

Full details and manifest field reference: [CONTRIBUTING.md](CONTRIBUTING.md)

## Rule implementation notes

- Use AST visitors (`CallExpression`, `ImportDeclaration`, `Program:exit`), never regex over raw source text.
- Track file-level state in closures (`let importsResend = false` at `create()` scope); use `Program:exit` for whole-file checks.
- Shared AST helpers live in `src/providers/<name>/utils.ts`. Extract a helper when two or more rules share the same AST pattern.
- Reference implementation: `src/providers/resend/rules/webhook-signature.ts`
