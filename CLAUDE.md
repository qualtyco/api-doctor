# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git policy

**Never commit or push without being explicitly asked.** Finish the work, leave all changes uncommitted in the working tree, and summarize what changed so it can be reviewed first. Plan or task approval is not commit authorization. If a commit split would help, propose the split and messages and wait for the go-ahead.

## Commands

```bash
pnpm install        # install deps
pnpm build          # compile src/ → dist/ (tsup bundles cli.ts + plugin/index.ts)
pnpm dev            # watch mode
pnpm test           # vitest run (builds once via globalSetup before workers)
pnpm check:links    # validate every docs URL in src/providers (404s, soft 404s, stale redirects) — network-bound, run before releases
pnpm check:surface  # diff surface.methods manifests against the latest SDK type declarations (drift guard) — network-bound, run before releases
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
├── coverage/           SDK surface coverage (CLI-only; informational, never scored)
│   └── collect.ts      oxc-parser pass over provider files → used method paths
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

### SDK surface coverage (`src/coverage/`)

Coverage records which SDK method paths a codebase actually calls (`report.coverage`, plus `sdk_used`/`unknown_sdk_calls` on the `provider_scanned` telemetry event). Rules that must never be broken:

- Coverage is **not a rule**: never in `findings[]`, never affects the score, and no output may contain counts, ratios, or "X of Y" — using a small part of an API is a fit, not a gap.
- Surface method lists in `manifest.ts` → `surface.methods` are **hand-written and verified against the SDK's published types/docs** — never auto-derived from package exports. `pnpm check:surface` guards them against SDK drift.
- Client identity is **verified, never assumed from names**: a binding counts only when it traces to the SDK (same-file construction, or an import resolved to a project module that verifiably exports a client/constructor). Unverifiable wrapper imports are dropped.
- Coverage is skipped entirely (section omitted, not empty) when a provider was detected from a URL string alone.
- Undercounting stays measurable: calls on a verified client outside the surface manifest are counted (never named) as `unknown_sdk_calls` in telemetry. The report itself carries no counts.
- Coverage runs in the CLI via its own `oxc-parser` pass — **`src/plugin/index.ts` must never import from `src/coverage/`** (dist/plugin.js stays lint-only). `oxc-parser` is pinned exact (0.x native dep) — bump it deliberately and re-run the coverage tests.
- **Coverage must never fail a scan**: `walkAst` is iterative (deep ASTs blow the call stack) and `parseFile` wraps parse *and* walk, dropping unanalysable files rather than propagating. An informational feature must not be able to take down the tool.
- Notables (hand-written unused-capability pointers) were deliberately dropped from v1: too heuristic-heavy to scale across providers. If they return, they must be justified by telemetry data, fire only on positive code evidence, and scope suppression signals to the provider.

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
├── fixtures/<provider>/docs-examples/       verbatim official doc samples; scan must match each file's declared expectations
├── rules/<rule-key>.test.ts                 one vitest file per rule
├── scanner.test.ts                          end-to-end scan()
├── docs-examples.test.ts                    guards against flagging providers' own doc examples
├── reporter/                                snippet, report-builder, cli-output
└── helpers/lint-rule.ts                     shared oxlint harness
```

Fixture files may be named `*.test.ts` to exercise test-file detection; vitest excludes `tests/fixtures/**`.

### Test suite policy

The test suite is the contract for rule behavior — **never edit existing tests or fixtures to make a failing run pass**. If a test fails, the bug is in the rule or source code; fix it there. Adding new tests and fixtures for new rules is expected (see the checklists below). The only legitimate reason to change an existing test is that the intended behavior itself changed — in that case, call the change out explicitly in the PR description and explain why the old expectation was wrong; never adjust expectations silently.

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
8. `tests/fixtures/<name>/docs-examples/` — verbatim code samples from the official docs, each headed by `// docs-example-source: <url>` and, when advisory rules fire on the minimal sample by design, `// docs-example-expected: <rule-id>, ...` (see `tests/fixtures/resend/docs-examples/`)
9. `pnpm build && pnpm test` and `pnpm check:links`

## Rule implementation notes

- Use AST visitors (`CallExpression`, `ImportDeclaration`, `Program:exit`), never regex over raw source text.
- Track file-level state in closures (`let importsResend = false` at `create()` scope); use `Program:exit` for whole-file checks.
- Shared AST helpers live in `src/providers/<name>/utils.ts`. Extract a helper when two or more rules share the same AST pattern.
- Reference implementation: `src/providers/resend/rules/webhook-signature.ts`
