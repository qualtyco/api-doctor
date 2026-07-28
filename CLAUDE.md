# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git policy

**Never commit or push without being explicitly asked.** Finish the work, leave all changes uncommitted in the working tree, and summarize what changed so it can be reviewed first. Plan or task approval is not commit authorization. If a commit split would help, propose the split and messages and wait for the go-ahead.

## Commands

```bash
pnpm install        # install deps
pnpm build          # compile src/ → dist/ (tsup bundles cli.ts + plugin/index.ts)
pnpm dev            # watch mode
pnpm test           # full check: test:unit + check:links + check:surface — network-bound
pnpm test:unit      # vitest run only (builds once via globalSetup) — fast, offline, for the inner loop
pnpm check:links    # validate every docs URL in src/providers (404s, soft 404s, stale redirects)
pnpm check:surface  # diff surface.methods manifests against the latest SDK type declarations (drift guard)
```

**Run `pnpm test` before committing.** The two network-bound guards catch what the
unit suite structurally cannot, because both compare the repo against the outside
world: a provider moving a docs page (`check:links`), and an SDK growing or
renaming methods the surface manifest doesn't list (`check:surface`). Both have
already caught real problems. Nothing enforces this automatically — use
`pnpm test:unit` while iterating and the full `pnpm test` before you commit.

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

Python rules ship under `src/providers/*/rules/python/` with a stdlib runtime in `src/engines/python/runtime/` (spawned by the CLI). Scanning `.py` files requires Python 3.10+ on PATH.

### Source layout

```
src/
├── cli.ts              Entry point — parses flags, runs scan, emits output, exits
├── scanner.ts          Walks files, classifies language, fans out to engines
├── detector.ts         package.json / pyproject / import / URL heuristics
├── types.ts            Shared contracts (ScanResult, Report, Finding, manifests)
├── engines/
│   ├── classify.ts     Per-file language (javascript | python)
│   ├── js/runner.ts    Oxlint engine
│   └── python/         Node runner + stdlib-ast runtime/
├── reporter/           Terminal, JSON, markdown, and file output
├── coverage/           SDK surface coverage (CLI-only; JS/TS; never scored)
│   └── collect.ts      oxc-parser pass over provider files → used method paths
├── plugin/
│   ├── index.ts        Oxlint plugin — imports providers/*/rules/js/
│   └── rule-registry.ts  Reads meta.docs from each JS rule
└── providers/
    ├── index.ts        Registers all provider manifests
    └── <name>/
        ├── manifest.ts   Detection + rules[] (+ optional surface)
        ├── utils.ts / utils.py
        ├── rules/js/     Oxlint / ESTree rules
        ├── rules/python/ stdlib-ast rules (same rule keys)
        └── README.md
```

### Data flow

```
cli.ts
  └─ scan()                    scanner.ts
       ├─ classify each file   engines/classify.ts
       ├─ detectProviders()    detector.ts + manifests
       ├─ collectCoverage()    coverage/ (JS files only)
       ├─ runJsEngine()        oxlint + providers/*/rules/js
       ├─ runPythonEngine()    python -m runtime + providers/*/rules/python
       └─ ScanResult[] (merged)
  └─ buildReport()             reporter/report-builder.ts
  └─ emitReport()
```

Detection reads **manifests only**. Engines produce diagnostics; reporting merges them with manifest metadata and rule docs from `plugin/rule-registry.ts`.

### SDK surface coverage (`src/coverage/`)

Coverage records which SDK method paths a codebase actually calls (`report.coverage`, plus `sdk_used`/`unknown_sdk_calls` on the `provider_scanned` telemetry event). Rules that must never be broken:

- Coverage is **not a rule**: never in `findings[]`, never affects the score, and no output may contain counts, ratios, or "X of Y" — using a small part of an API is a fit, not a gap.
- Surface method lists in `manifest.ts` → `surface.methods` are **hand-written and verified against the SDK's published types/docs** — never auto-derived from package exports. `pnpm check:surface` guards them against SDK drift.
- Client identity is **verified, never assumed from names**: a binding counts only when it traces to the SDK (same-file construction, or an import resolved to a project module that verifiably exports a client/constructor). Unverifiable wrapper imports are dropped.
- Coverage is skipped entirely (section omitted, not empty) when a provider was detected from a URL string alone.
- Undercounting stays measurable: calls on a verified client outside the surface manifest are counted (never named) as `unknown_sdk_calls` in telemetry. The report itself carries no counts.
- Coverage runs in the CLI via its own `oxc-parser` pass — **`src/plugin/index.ts` must never import from `src/coverage/`** (dist/plugin.js stays lint-only). `oxc-parser` is pinned exact (0.x native dep) — bump it deliberately and re-run the coverage tests.
- **Coverage must never fail a scan**: `walkAst` is iterative (deep ASTs blow the call stack) and `parseFile` wraps parse *and* walk, dropping unanalysable files rather than propagating. An informational feature must not be able to take down the tool.
- Coverage is **JS/TS only** — never feed `.py` files into `collectCoverage`.
- Notables (hand-written unused-capability pointers) were deliberately dropped from v1: too heuristic-heavy to scale across providers. If they return, they must be justified by telemetry data, fire only on positive code evidence, and scope suppression signals to the provider.

### Three names that must stay in sync

```
manifest rules[].key        →  resend-missing-idempotency-key
plugin/index.ts object key  →  resend-missing-idempotency-key
oxlint rule id              →  api-doctor/resend-missing-idempotency-key
Python RULE_KEY             →  resend-missing-idempotency-key
```

### Test layout

```
tests/
├── fixtures/<provider>/<rule-key>-broken/   should flag (2+ files each)
├── fixtures/<provider>/<rule-key>-fixed/    should not flag
├── fixtures/<provider>/docs-examples/       verbatim official doc samples
├── rules/<rule-key>.test.ts                 one vitest file per rule
├── scanner.test.ts / scanner-python.test.ts end-to-end scan()
├── helpers/lint-rule.ts                     oxlint harness
└── helpers/lint-python-rule.ts              Python runtime harness
```

Fixture files may be named `*.test.ts` to exercise test-file detection; vitest excludes `tests/fixtures/**`.

### Test suite policy

The test suite is the contract for rule behavior — **never edit existing tests or fixtures to make a failing run pass**. If a test fails, the bug is in the rule or source code; fix it there. Adding new tests and fixtures for new rules is expected (see the checklists below). The only legitimate reason to change an existing test is that the intended behavior itself changed — in that case, call the change out explicitly in the PR description and explain why the old expectation was wrong; never adjust expectations silently.

## Adding a rule (checklist)

1. `src/providers/<name>/rules/js/<check>.ts` — AST visitors, named export + default export
2. Register in `src/plugin/index.ts` — import `../providers/<name>/rules/js/<check>.js`
3. Add entry to `src/providers/<name>/manifest.ts` → `rules[]` (set `languages` when Python applies)
4. Optional Python port: `src/providers/<name>/rules/python/<check>.py` with `RULE_KEY` + `check(tree, path, source)`
5. Rule registry coverage via plugin import (automatic)
6. `tests/fixtures/<name>/<rule-key>-broken/` and `-fixed/` (JS and/or `.py`)
7. `tests/rules/<rule-key>.test.ts`
8. `pnpm build && pnpm test:unit`

`scanner.ts` reads manifests automatically — do not edit it when adding rules.

## Adding a new provider (checklist)

1. `src/providers/<name>/manifest.ts` — detection signals + `rules[]`
2. `src/providers/<name>/rules/js/*.ts` — one file per JS/TS check
3. `src/providers/<name>/utils.ts` — shared AST helpers (if needed)
4. `src/providers/<name>/README.md` — rule catalog by category
5. Register manifest in `src/providers/index.ts`
6. Register JS rules in `src/plugin/index.ts`
7. Fixtures and tests under `tests/`
8. `tests/fixtures/<name>/docs-examples/` — verbatim official doc samples
9. `pnpm build && pnpm test` and `pnpm check:links`

## Rule implementation notes

- Use AST visitors, never regex over raw source text as the primary detector.
- JS: ESTree visitors (`CallExpression`, `ImportDeclaration`, `Program:exit`); track file-level state in `create()` closures.
- Python: `ast.parse` + `check(tree, path, source) -> list[Diagnostic]`; export `RULE_KEY`.
- Shared helpers: `utils.ts` / `utils.py` when two or more rules share a pattern.
- Reference: `src/providers/resend/rules/js/webhook-signature.ts` and `rules/python/api_key_hardcoded.py`
