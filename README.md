# api-doctor README

This directory is the entire runtime of api-doctor: CLI, scanner, provider detection, oxlint plugin, and reporting.

## Architecture

```
src/
├── cli.ts              Entry point — parses flags, runs scan, emits output, exits
├── scanner.ts          Walks files, detects providers, shells out to oxlint
├── detector.ts         package.json / import / URL-pattern heuristics
├── reporter/           Terminal, JSON, markdown, and file output
├── types.ts            Shared contracts (ScanResult, Report, Finding, manifests)
├── providers/          Per-SDK manifests (detection + rule metadata)     → see providers/README.md
└── plugin/             Oxlint JS plugin (AST rules)                     → see plugin/README.md
```

## Data flow

```
cli.ts
  └─ scan()                    scanner.ts
       ├─ detectProviders()     detector.ts + providers/*/manifest.ts
       ├─ buildOxlintConfig()   enable api-doctor/<key> rules per detected SDK
       ├─ oxlint --format json  plugin/rules/<provider>/*.ts
       └─ ScanResult[]
  └─ buildReport()             reporter/report-builder.ts
  └─ emitReport()              reporter/index.ts → terminal | json | markdown | file
```

**Detection** reads manifests only. **Linting** runs the plugin. **Reporting** merges oxlint diagnostics with manifest metadata (`message`, `fix`, `docsUrl`, `severity`) and rule docs (`category`, `rationale`, `cwe`, `owasp`) from `plugin/rule-registry.ts`.

## Layers


| Layer     | Path                | README                                                                |
| --------- | ------------------- | --------------------------------------------------------------------- |
| Providers | `src/providers/`    | [providers/README.md](providers/README.md) — how to add a new SDK     |
| Plugin    | `src/plugin/`       | [plugin/README.md](plugin/README.md) — oxlint rule architecture       |
| Rules     | `src/plugin/rules/` | [plugin/rules/README.md](plugin/rules/README.md) — one file per check |


### Supported providers


| Provider                             | Checks                                                     | Status                     |
| ------------------------------------ | ---------------------------------------------------------- | -------------------------- |
| [Resend](providers/resend/README.md) | 13 rules (security, correctness, reliability, integration) | Active                     |
| Stripe                               | —                                                          | Detect-only (no rules yet) |
| Supabase                             | —                                                          | Detect-only (no rules yet) |


## Tests

Tests live in `tests/` at the repo root (gitignored locally by default). Layout:

```
tests/
├── fixtures/<provider>/     broken + fixed source files per rule
├── rules/<rule>.test.ts     one vitest file per Resend rule
├── resend-webhook-signature.test.ts
├── scanner.test.ts          end-to-end scan()
├── reporter/                snippet, report-builder, cli-output
└── helpers/lint-rule.ts     shared oxlint harness for rule tests
```

See [providers/resend/README.md](providers/resend/README.md) for every Resend rule, fixture, and test grouped by category.

## Development

```bash
pnpm install
pnpm build    # dist/cli.mjs + dist/plugin.js
pnpm test     # vitest; globalSetup builds once before workers
```

Run against a fixture directory:

```bash
node dist/cli.mjs tests/fixtures/resend/resend-api-key-hardcoded-broken
```

