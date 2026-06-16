# Contributing to api-doctor

## Architecture

```
src/
├── cli.ts              Entry point — parses flags, runs scan, emits output, exits
├── scanner.ts          Walks files, detects providers, shells out to oxlint
├── detector.ts         package.json / import / URL-pattern heuristics
├── types.ts            Shared contracts (ScanResult, Report, Finding, manifests)
├── reporter/           Terminal, JSON, markdown, and file output
├── plugin/
│   ├── index.ts        Oxlint plugin entrypoint — flat rules map required by oxlint
│   └── rule-registry.ts  Maps rule keys → meta.docs (category, rationale, CWE/OWASP)
└── providers/
    ├── index.ts        Registers all provider manifests
    └── <name>/
        ├── manifest.ts   Detection signals + rule metadata for the CLI
        ├── utils.ts      Shared AST helpers (provider-specific)
        └── rules/        One .ts file per oxlint check
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

Detection reads **manifests only**. Linting runs the **plugin**. Reporting merges oxlint diagnostics with manifest metadata (`message`, `fix`, `docsUrl`, `severity`) and rule docs (`category`, `rationale`, `cwe`, `owasp`) from `plugin/rule-registry.ts`.

### Three names that must stay in sync

Every rule key appears in three places and must match exactly:

```
manifest oxlintRules[].key  →  resend-missing-idempotency-key
plugin/index.ts object key  →  resend-missing-idempotency-key
oxlint rule id              →  api-doctor/resend-missing-idempotency-key
```

---

## Adding a rule to an existing provider

1. **Create** `src/providers/<name>/rules/<check>.ts` (see anatomy below)
2. **Register** in `src/plugin/index.ts` — key must equal the manifest key
3. **Add** an entry to `src/providers/<name>/manifest.ts` → `oxlintRules[]`
4. **Add** a `getRuleDocsMeta` entry in `src/plugin/rule-registry.ts`
5. **Add fixtures** — `tests/fixtures/<name>/<rule-key>-broken/` (2+ files) and `tests/fixtures/<name>/<rule-key>-fixed/` (2+ files)
6. **Add test** — `tests/rules/<rule-key>.test.ts` (copy an existing Resend test)
7. Run `pnpm build && pnpm test`

`scanner.ts` reads manifests automatically — do not edit it when adding rules.

### Rule file anatomy

```ts
const rule = {
  meta: {
    type: 'problem',           // problem | suggestion
    docs: {
      description: 'One-line summary',
      category: 'security',    // security | correctness | reliability | integration
      rationale: '2–3 sentences on impact and why the fix matters',
      docsUrl: 'https://...',
      cwe: 'CWE-798',          // security rules only
      owasp: 'API8:2023 ...',  // security rules only
      recommended: true,
    },
    messages: { myMessageId: 'Lint message shown in diagnostics' },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) { /* visit AST nodes */ },
      'Program:exit'() { /* whole-file checks */ },
    };
  },
};

export const myRule = rule;
export default rule;
```

### Rule implementation guidelines

- **AST visitors only** — match nodes, not regex over raw source text. String literals inside `Literal` nodes are fine.
- **Track state in closures** — `let importsResend = false` at `create()` scope.
- **`Program:exit`** — for checks that need the whole file (webhook handlers, dedup signals).
- **Adversarial fixtures** — every rule needs fixed cases that look similar but must not flag.
- **Reference implementation** — `src/providers/resend/rules/webhook-signature.ts`

### Manifest field reference

| Field | Purpose |
|-------|---------|
| `name` | Internal id; used with `--provider <name>` |
| `displayName` | Shown in CLI output |
| `detect.packages` | npm names matched in package.json |
| `detect.imports` | import/require strings in source |
| `detect.urlPatterns` | API URL substrings in source |
| `oxlintRules[].key` | Plugin rule key → `api-doctor/<key>` |
| `oxlintRules[].resultRule` | Report id — `<provider>/<category>/<check>` |
| `oxlintRules[].message` | Issue title in CLI and reports |
| `oxlintRules[].fix` | Suggested fix text |
| `oxlintRules[].docsUrl` | Link shown in reports |
| `oxlintRules[].severity` | `error`, `warning`, or `info` |

### Rule categories

| Category | Use for |
|----------|---------|
| `security` | API keys in client code, missing webhook signature verification, secrets in source |
| `correctness` | Wrong API for the use case, deprecated usage, test domains in production |
| `reliability` | Idempotency, rate limits, batch limits, error-code mapping, webhook deduplication |
| `integration` | Logging, observability, friendly conventions, ecosystem wiring |

---

## Adding a new provider

### 1. Create the manifest

`src/providers/<name>/manifest.ts`:

```ts
import type { ProviderManifest } from '../../types.js';

export const acmeManifest: ProviderManifest = {
  name: 'acme',
  displayName: 'Acme API',
  detect: {
    packages: ['@acme/sdk'],
    imports: ['@acme/sdk'],
    urlPatterns: ['api.acme.com'],
  },
  oxlintRules: [
    {
      key: 'acme-webhook-signature',
      resultRule: 'acme/security/webhook-signature',
      message: 'Short description of the problem.',
      fix: 'What the developer should do.',
      docsUrl: 'https://docs.acme.com/webhooks',
      severity: 'error',
    },
  ],
};
```

Register in `src/providers/index.ts`.

### 2. Implement rules

One file per check in `src/providers/<name>/rules/`. See anatomy above.

### 3. Register in the plugin

`src/plugin/index.ts` — the object key must equal the manifest key:

```ts
import { acmeWebhookSignatureRule } from '../providers/acme/rules/webhook-signature.js';

// in the rules object:
'acme-webhook-signature': acmeWebhookSignatureRule,
```

### 4. Add tests

```
tests/fixtures/<name>/<rule-key>-broken/   2+ files that should flag
tests/fixtures/<name>/<rule-key>-fixed/    2+ files that should not flag
tests/rules/<rule-key>.test.ts             vitest via tests/helpers/lint-rule.ts
```

### Provider contribution checklist

- [ ] `src/providers/<name>/manifest.ts` with `detect` + `oxlintRules`
- [ ] `src/providers/<name>/README.md` — rules and tests by category
- [ ] Registered in `src/providers/index.ts`
- [ ] Rule files in `src/providers/<name>/rules/`
- [ ] Rules registered in `src/plugin/index.ts`
- [ ] `meta.docs.category` + `rationale` on every rule
- [ ] Fixtures under `tests/fixtures/<name>/`
- [ ] Tests under `tests/rules/`
- [ ] `pnpm build && pnpm test` pass

---

## Tests

```
tests/
├── fixtures/<provider>/<rule-key>-broken/   should flag (2+ files each)
├── fixtures/<provider>/<rule-key>-fixed/    should not flag
├── rules/<rule-key>.test.ts                 one vitest file per rule
├── scanner.test.ts                          end-to-end scan()
├── reporter/                                snippet, report-builder, cli-output
└── helpers/lint-rule.ts                     shared oxlint harness
```

The `tests/helpers/lint-rule.ts` harness exposes:
- `fixtureDir(ruleKey, 'broken' | 'fixed')` — resolves the fixture directory
- `lintFileForRule(ruleKey, filePath)` — runs oxlint with only that rule enabled

Fixture files may be named `*.test.ts` to exercise test-file detection; vitest excludes `tests/fixtures/**` to avoid running them as tests.

### Running tests

```bash
pnpm build && pnpm test                      # full suite (build runs once via globalSetup)
npx vitest run tests/rules/resend-api-key-hardcoded.test.ts  # single rule
node dist/cli.mjs tests/fixtures/resend/resend-api-key-hardcoded-broken  # end-to-end
```

---

## Using the plugin directly (without the CLI)

```json
{
  "jsPlugins": ["api-doctor/plugin"],
  "rules": {
    "api-doctor/resend-webhook-signature": "error",
    "api-doctor/resend-api-key-hardcoded": "warn"
  }
}
```

```bash
npx oxlint -c .oxlintrc.json .
```
