# Oxlint plugin

api-doctor ships as an [oxlint](https://oxc.rs/docs/guide/usage/linter) JavaScript plugin. Rules are **AST-based** — they use ESLint-compatible visitors (`ImportDeclaration`, `CallExpression`, `Program:exit`, etc.), not string matching on raw source.

## Layout

```
plugin/
├── index.ts           Plugin entry — flat `rules` map required by oxlint
├── rule-registry.ts   Maps rule keys → meta.docs (category, rationale, CWE/OWASP)
├── utils/
│   └── resend.ts      Shared AST helpers for Resend rules
└── rules/
    └── <provider>/    One .ts file per check
        README.md      → plugin/rules/README.md
```

## How oxlint sees this

The scanner resolves `api-doctor/plugin` to `dist/plugin.js` and writes a temp config:

```json
{
  "jsPlugins": ["<path>/dist/plugin.js"],
  "rules": {
    "api-doctor/resend-webhook-signature": "error",
    "api-doctor/resend-api-key-hardcoded": "error"
  }
}
```

Only rules for **detected** providers are enabled. Diagnostics are filtered back to manifest entries by matching the rule key in `d.code`.

## Rule file anatomy

```ts
const rule = {
  meta: {
    type: 'problem',           // problem | suggestion
    docs: {
      description: 'One-line summary',
      category: 'security',    // security | correctness | reliability | integration
      rationale: '2–3 sentences on impact and why the fix matters',
      docsUrl: 'https://...',
      cwe: 'CWE-798',          // security rules
      owasp: 'API8:2023 ...',  // security rules
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

Register in [index.ts](index.ts):

```ts
rules: {
  'my-rule-key': myRule,   // must match providers/<name>/manifest.ts oxlintRules[].key
}
```

## rule-registry.ts

The CLI report builder reads `getRuleDocsMeta(ruleKey)` for `category`, `rationale`, `cwe`, and `owasp`. The manifest still owns `message`, `fix`, `docsUrl`, and `severity` (what the user sees in the terminal).

## Shared utilities

Provider-specific helpers live under `plugin/utils/<provider>.ts`. Resend rules import from [utils/resend.ts](utils/resend.ts):

- `isResendSendCall`, `isResendBatchSendCall` — detect SDK send calls
- `findProperty`, `getSendOptionObjects` — read object literals in send payloads
- `isInsideTestFile` — skip test paths where appropriate
- `contains`, `startOffset`, `endOffset` — scope helpers for function-body checks

Extract helpers when two or more rules share the same AST pattern.

## Using the plugin outside the CLI

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

## Adding a rule

1. Create `rules/<provider>/<check>.ts`
2. Register in [index.ts](index.ts)
3. Add manifest entry in `providers/<provider>/manifest.ts`
4. Add fixtures + test — see [providers/README.md](../providers/README.md)

**Rule implementations by provider:** [rules/README.md](rules/README.md)
