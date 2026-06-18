[![npm version](https://img.shields.io/npm/v/@api-doctor/cli)](https://www.npmjs.com/package/@api-doctor/cli)
[![license](https://img.shields.io/npm/l/@api-doctor/cli)](https://github.com/qualtyco/api-doctor/blob/main/LICENSE)

# api-doctor

Oxlint-powered checks for AI-generated API integrations — catch silent bugs before they ship.

## Usage

```bash
npx @api-doctor/cli .
```

By default this prints the grouped terminal report and writes a structured
report to `.api-doctor/report.json` in the scanned directory.

### Options

| Flag | Description |
|------|-------------|
| `--quiet` | Print only the score and the report file path; suppress everything else. |
| `--verbose` | Print every finding inline with a code snippet (no aggregation). |
| `--format <json\|markdown\|sarif>` | Emit structured output to stdout instead of the human report. Suitable for piping. (`sarif` is not implemented yet.) |
| `--output <path>` | Write the report file to a custom path instead of `.api-doctor/report.json`. |
| `--no-report` | Do not write the report file. |
| `--max-warnings <n>` | Exit with code 1 if the warning count exceeds `n`. |
| `--provider <names>` | Comma-separated providers to scan (e.g. `resend`). |
| `--list-providers` | List supported providers and exit. |

### Exit codes

These follow the ESLint convention, so the tool drops into CI without extra wiring:

| Code | Meaning |
|------|---------|
| `0` | No errors, and warnings within the `--max-warnings` threshold. |
| `1` | Errors found, or warnings exceeded `--max-warnings`. |
| `2` | Tool-level failure (unreadable directory, oxlint crash, invalid flag). |

### Example workflows

Fail a CI build on any error or warning:

```bash
npx @api-doctor/cli . --max-warnings 0
```

Hand the findings to a coding agent:

```bash
npx @api-doctor/cli . --format markdown > issues.md
```

Pipe the report straight into an agent:

```bash
npx @api-doctor/cli . --format markdown | claude
```

Consume the structured findings programmatically (the JSON schema is versioned via `schemaVersion`):

```bash
npx @api-doctor/cli . --format json > issues.json
```

The `.api-doctor/` directory is gitignored automatically (a `.gitignore` with `*` is seeded on first write).

## How it works

1. **Detect** — scans the project for known API SDKs (package.json deps, imports, URL patterns)
2. **Enable rules** — turns on the matching oxlint rules from the bundled plugin
3. **Lint** — runs oxlint with AST-based rules (no string matching)
4. **Report** — prints a 0–100 score and grouped issues, and writes `.api-doctor/report.json`

You can also use the oxlint plugin directly:

```json
{
  "jsPlugins": ["@api-doctor/cli/plugin"],
  "rules": {
    "@api-doctor/cli/resend-webhook-signature": "error"
  }
}
```

## Supported providers

| Provider | Rules | Docs |
|----------|-------|------|
| [Resend](https://resend.com) | 13 rules — security, correctness, reliability, integration | [src/providers/resend/README.md](src/providers/resend/README.md) |

### Coming soon

| Provider | Status |
|----------|--------|
| Stripe | detect-only — rules in progress |
| Supabase | detect-only — rules in progress |

## Development

```bash
pnpm install
pnpm build
pnpm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) to add rules or new providers.

## License

MIT
