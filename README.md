# api-doctor

Oxlint-powered checks for AI-generated API integrations — catch silent bugs before they ship.

## Usage

```bash
npx api-doctor .
```

Options:

- `--verbose` — show file paths for each issue
- `--provider resend` — limit scanning to specific providers
- `--list-providers` — list supported providers

## How it works

1. **Detect** — scans the project for known API SDKs (package.json deps, imports, URL patterns)
2. **Enable rules** — turns on the matching oxlint rules from the bundled plugin
3. **Lint** — runs oxlint with AST-based rules (no string matching for checks)
4. **Report** — prints a 0–100 score and grouped issues

You can also use the oxlint plugin directly:

```json
{
  "jsPlugins": ["api-doctor/plugin"],
  "rules": {
    "api-doctor/resend-webhook-signature": "error"
  }
}
```

## What it checks today

- **Resend** — webhook handlers that process Resend events without signature verification

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## License

MIT
