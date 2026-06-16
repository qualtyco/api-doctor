# Providers

A **provider** is one API or SDK that api-doctor can detect in a target project. Each provider ships as two linked pieces:

| Piece | Location | Purpose |
|-------|----------|---------|
| **Manifest** | `src/providers/<name>/manifest.ts` | Detection signals + rule metadata for the CLI |
| **Rules** | `src/plugin/rules/<name>/*.ts` | Oxlint AST checks (one file per rule) |

A contribution **must include both** — at least one rule with fixtures and tests. Manifests without rules (Stripe, Supabase today) are detect-only placeholders until checks land.

## Registered providers

| Provider | Manifest | Rules README |
|----------|----------|--------------|
| Resend | [resend/manifest.ts](resend/manifest.ts) | [resend/README.md](resend/README.md) |
| Stripe | [stripe/manifest.ts](stripe/manifest.ts) | — |
| Supabase | [supabase/manifest.ts](supabase/manifest.ts) | — |

Register new manifests in [index.ts](index.ts).

## How detection works

`detector.ts` checks each manifest's `detect` block in order:

1. **package.json** — `dependencies` / `devDependencies` match `detect.packages`
2. **imports** — source files import `detect.imports`
3. **url-patterns** — source contains `detect.urlPatterns`

First match wins. The scanner then enables every `oxlintRules[].key` from matching manifests as `api-doctor/<key>` in a temporary oxlint config.

## Rule categories

Every rule fits one category. Use it in `resultRule` (`resend/security/...`) and in `meta.docs.category` inside the rule file.

### Security

API keys in client code, missing webhook signature verification, secrets in source, etc.

| Source | Use for |
|--------|---------|
| [OWASP API Security Top 10 (2023)](https://owasp.org/API-Security/editions/2023/en/0x11-t10/) | Map each rule to one of the 10 categories |
| [CWE Top 25](https://cwe.mitre.org/top25/) | Specific CWE numbers (e.g. CWE-798) |
| [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org) | REST Security, Authentication, Logging |

### Correctness

Wrong API for the use case, deprecated usage, missing compliance mechanisms, test domains in production.

| Source | Use for |
|--------|---------|
| Provider official docs | Expected usage patterns |
| Changelog / migration guides | Breaking changes |
| Official SDK source | How calls should be structured |

### Reliability

Idempotency, rate limits, batch limits, error-code mapping, webhook deduplication.

| Source | Use for |
|--------|---------|
| Rate-limit docs | 429 handling, headers |
| Webhook retry policy | Retry count, backoff, idempotency |
| Provider status page | Failure modes to plan for |

### Integration

Logging, observability, friendly conventions, ecosystem wiring.

| Source | Use for |
|--------|---------|
| Observability docs | Request IDs, event tagging |
| Ecosystem docs | Sentry, Datadog, etc. |

---

## Add a new provider

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

Register in [index.ts](index.ts). Add `src/providers/<name>/README.md` documenting every rule and test.

### 2. Implement rules

One file per check under `src/plugin/rules/<name>/`. See [plugin/rules/README.md](../plugin/rules/README.md).

Each rule's `meta.docs` should include:

- `category` — security | correctness | reliability | integration
- `description` — one sentence
- `rationale` — 2–3 sentences for markdown export / agent handoff
- `docsUrl` — provider doc link
- `cwe` / `owasp` — for security rules

### 3. Register in the plugin

`src/plugin/index.ts` — the object key must equal manifest `oxlintRules[].key`:

```
manifest key  →  acme-webhook-signature
plugin key    →  acme-webhook-signature
oxlint id     →  api-doctor/acme-webhook-signature
```

Do **not** edit `scanner.ts` — it reads manifests automatically.

### 4. Add tests

```
tests/fixtures/<name>/<rule-key>-broken/   2+ files that should flag
tests/fixtures/<name>/<rule-key>-fixed/    2+ files that should not flag
tests/rules/<rule-key>.test.ts             vitest via tests/helpers/lint-rule.ts
```

Copy an existing Resend test from `tests/rules/resend-*.test.ts`.

```bash
pnpm build && pnpm test
node dist/cli.mjs tests/fixtures/<name>/<rule-key>-broken
```

---

## Manifest field reference

| Field | Purpose |
|-------|---------|
| `name` | Internal id; `--provider acme` |
| `displayName` | Shown in CLI |
| `detect.packages` | npm names in package.json |
| `detect.imports` | import/require strings in source |
| `detect.urlPatterns` | API URL substrings in source |
| `oxlintRules[].key` | Plugin rule key → `api-doctor/<key>` |
| `oxlintRules[].resultRule` | Report id — `<provider>/<category>/<check>` |
| `oxlintRules[].message` | Issue title in CLI and reports |
| `oxlintRules[].fix` | Suggested fix |
| `oxlintRules[].docsUrl` | Link in reports |
| `oxlintRules[].severity` | `error` (default), `warning`, or `info` |

---

## Contribution checklist

- [ ] `src/providers/<name>/manifest.ts` with `detect` + `oxlintRules`
- [ ] `src/providers/<name>/README.md` — rules and tests by category
- [ ] Registered in `src/providers/index.ts`
- [ ] Rule files in `src/plugin/rules/<name>/`
- [ ] Rules registered in `src/plugin/index.ts`
- [ ] `meta.docs.category` + `rationale` on every rule
- [ ] Fixtures under `tests/fixtures/<name>/`
- [ ] Tests under `tests/rules/`
- [ ] `pnpm build && pnpm test` pass
