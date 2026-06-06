# Contributing a provider

Every supported API/SDK is contributed as **two pieces in two folders**:

| Piece | Location | Purpose |
|-------|----------|---------|
| **Manifest** | `src/providers/<name>/manifest.ts` | How to detect the SDK + rule metadata for the CLI |
| **Rules** | `src/plugin/rules/<name>/*.ts` | Oxlint AST checks (one file per rule) |

A PR that adds a provider **must include both** — at least one rule with fixtures and tests. Detection-only manifests (no rules) are maintainer placeholders until checks land; they are not a contribution template.

## Folder layout

```
src/providers/
  resend/
    manifest.ts              ← detection + oxlintRules metadata
  stripe/
    manifest.ts              ← placeholder until rules exist
  index.ts                   ← register all manifests

src/plugin/
  index.ts                     ← register all rules (flat map for oxlint)
  rules/
    resend/
      webhook-signature.ts     ← AST rule implementation
    stripe/                    ← your rules go here when contributing Stripe
      webhook-signature.ts
      idempotency-key.ts
    acme/
      ...

tests/
  fixtures/
    resend/                    ← broken + ok fixtures per provider
      broken-no-verify.ts
      ok-verify-first.ts
  resend/
    webhook-signature.test.ts
```

**Why rules live under `src/plugin/rules/<provider>/`**

Oxlint requires a single plugin object with a flat `rules` map (`src/plugin/index.ts`). Rules are grouped by provider in subfolders so that as we add the top APIs — each with many checks — the tree stays navigable:

```
plugin/rules/resend/webhook-signature.ts
plugin/rules/resend/api-key-in-client.ts
plugin/rules/stripe/webhook-signature.ts
```

Manifests stay in `src/providers/<name>/` because the CLI reads them for **detection and reporting** without loading oxlint. The `key` in each manifest entry links to the rule registered in `plugin/index.ts`.

---

## How it runs

```
manifest (detect + oxlintRules)  →  scanner enables api-doctor/<key> rules
plugin/rules/<name>/*.ts         →  oxlint runs AST visitors
reporter                         →  uses manifest message/fix/docs for output
```

**Rule id format:** `api-doctor/<rule-key>` (`PLUGIN_NAME` in `src/constants.ts` + manifest `key`).

---

## Rule categories

Every rule should fit one of these categories. Tag rules in the manifest `resultRule` prefix (e.g. `resend/security/webhook-signature`) and in file comments.

### Security

API keys in client code, missing webhook signature verification, log injection on webhook payloads, secrets in env misuse, etc.

| Source | Use for |
|--------|---------|
| [OWASP API Security Top 10 (2023)](https://owasp.org/API-Security/editions/2023/en/0x11-t10/) | Foundation — map each security rule to one of the 10 categories |
| [CWE Top 25](https://cwe.mitre.org/top25/) | Cross-reference specific CWE numbers (e.g. CWE-798 hard-coded credentials) |
| [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org) | REST Security, Authentication, Logging cheat sheets |

**Resend example:** `webhook-signature.ts` — webhook payload processed before Svix/crypto verify (OWASP API4/API8, CWE-345).

### Correctness

Webhook idempotency, deprecated API usage, async handling mistakes, missing retry logic, wrong SDK method signatures.

| Source | Use for |
|--------|---------|
| Provider official docs | Expected usage patterns |
| Changelog / migration guides | Deprecated endpoints and breaking changes |
| Official SDK source code | How the SDK expects calls to be structured |

### Reliability

Rate-limit handling, bounce/suppression flows, dead-letter handling, timeout/retry on failed sends.

| Source | Use for |
|--------|---------|
| Rate-limit docs (e.g. [Resend rate limits](https://resend.com/docs/api-reference/introduction#rate-limit)) | What happens at 429, headers to respect |
| Webhook retry policy docs | Retry count, backoff, idempotency expectations |
| Provider status page (e.g. resend-status.com) | Failure modes users should plan for |

### Integration

Structured logging, error handling, observability hooks, ecosystem integrations (Sentry, Datadog, etc.).

| Source | Use for |
|--------|---------|
| Provider observability docs | Request ID logging, event tagging, error context |
| Ecosystem / integration docs | Recommended third-party wiring |

---

## Step-by-step: add a new provider

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
      key: 'acme-webhook-signature',              // → api-doctor/acme-webhook-signature
      resultRule: 'acme/security/webhook-signature', // category/provider/check
      message: 'Short description of the problem.',
      fix: 'What the developer should do.',
      docsUrl: 'https://docs.acme.com/webhooks',
      severity: 'error',
    },
    // add more entries as you add rule files
  ],
};
```

Register in `src/providers/index.ts`.

Detection order: **package.json → imports → URL patterns** (first match wins).

### 2. Implement rules (one file per check)

`src/plugin/rules/acme/webhook-signature.ts`:

```ts
/** Category: Security — OWASP API8, CWE-345 */
const rule = {
  meta: {
    type: 'problem',
    docs: { description: '...', recommended: true },
    messages: { missingVerification: '...' },
  },
  create(context) {
    return {
      ImportDeclaration(node) { /* AST */ },
      'Program:exit'() {
        context.report({ node, messageId: 'missingVerification' });
      },
    };
  },
};

export const acmeWebhookSignatureRule = rule;
```

Guidelines:

- **AST visitors only** — no string matching on raw source
- **One concern per file** — easier to test and enable individually
- Track state in closures; use `'Program:exit'` for whole-file checks
- Reference: `src/plugin/rules/resend/webhook-signature.ts`

Add more files under `src/plugin/rules/acme/` for each check listed in `oxlintRules`.

### 3. Register rules in the plugin

`src/plugin/index.ts`:

```ts
import { acmeWebhookSignatureRule } from './rules/acme/webhook-signature.js';

const plugin = {
  meta: { name: PLUGIN_NAME, version: '0.0.1' },
  rules: {
    'resend-webhook-signature': resendWebhookSignatureRule,
    'acme-webhook-signature': acmeWebhookSignatureRule, // key === manifest `key`
  },
} as const;
```

Three names must match:

```
manifest oxlintRules[].key  →  acme-webhook-signature
plugin rules object key     →  acme-webhook-signature
oxlint config rule id       →  api-doctor/acme-webhook-signature
```

Do **not** edit `scanner.ts` — it reads manifests automatically.

### 4. Add tests

**Fixtures** — `tests/fixtures/<name>/`:

- `broken-*.ts` — should flag (2–3 per rule)
- `ok-*.ts` — should not flag (include out-of-scope cases)

**Rule tests** — `tests/<name>/<rule>.test.ts` (copy `tests/resend-webhook-signature.test.ts`):

1. Point `jsPlugins` at `dist/plugin.js`
2. Enable `api-doctor/<rule-key>`
3. Filter diagnostics by rule key (ignore built-in oxlint rules like `no-unused-vars`)

**Scanner test** (optional) — extend `tests/scanner.test.ts` for end-to-end `scan()`.

```bash
pnpm build && pnpm test
node dist/cli.mjs tests/fixtures/<name>
```

---

## Manifest field reference

| Field | Purpose |
|-------|---------|
| `name` | Internal id; `--provider acme` |
| `displayName` | Shown in CLI |
| `detect.packages` | npm names in dependencies / devDependencies |
| `detect.imports` | `from 'pkg'` / `require('pkg')` in source |
| `detect.urlPatterns` | API URL substrings in source |
| `oxlintRules[].key` | Plugin rule key → `api-doctor/<key>` |
| `oxlintRules[].resultRule` | Report id — use `<provider>/<category>/<check>` |
| `oxlintRules[].message` | Issue title in CLI |
| `oxlintRules[].fix` | Suggested fix |
| `oxlintRules[].docsUrl` | Link (shown with `--verbose`) |
| `oxlintRules[].severity` | `'error'` (default) or `'warning'` |

---

## Contribution checklist

- [ ] `src/providers/<name>/manifest.ts` with `detect` + one or more `oxlintRules` entries
- [ ] Registered in `src/providers/index.ts`
- [ ] One rule file per check in `src/plugin/rules/<name>/`
- [ ] Each rule registered in `src/plugin/index.ts`
- [ ] Rule mapped to a category (Security / Correctness / Reliability / Integration)
- [ ] Sources cited in rule file comment (OWASP category, CWE, doc link)
- [ ] Fixtures under `tests/fixtures/<name>/`
- [ ] Test file(s) under `tests/<name>/`
- [ ] `pnpm build && pnpm test` pass

---

## Using rules outside the CLI

```json
{
  "jsPlugins": ["api-doctor/plugin"],
  "rules": {
    "api-doctor/resend-webhook-signature": "error"
  }
}
```

```bash
npx oxlint -c .oxlintrc.json .
```
