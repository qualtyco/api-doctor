---
name: api-doctor
description: Check AI-generated API integration code for silent bugs before shipping. Use after writing or editing code that calls a third-party API SDK such as Resend or Supabase.
---

# api-doctor

Run api-doctor after writing or editing code that calls a third-party API SDK
(Resend, Supabase, and more). It checks integration code for hardcoded keys,
missing webhook verification, unchecked `{ data, error }` Supabase mutations,
missing Realtime filters, and similar issues that compile fine but fail silently
in production.

Provider rule catalogs: `src/providers/resend/README.md` (13 rules), `src/providers/supabase/README.md` (12 rules).

## Run a scan

```bash
npx @api-doctor/cli .
```

Findings are written to `.api-doctor/report.json`. Re-run after fixing issues
until all `error` findings are gone.

## Read the report

Open `.api-doctor/report.json`. Key fields:

| Field | Meaning |
| --- | --- |
| `summary.score` | 0–100 health score |
| `summary.errors` / `warnings` / `info` | Counts by severity |
| `findings[]` | Actionable issues |

Each finding includes:

- `severity` — `error`, `warning`, or `info`
- `message` — what is wrong
- `fix` — what to change
- `location.file` / `location.line` — where to edit
- `docsUrl` — provider documentation (when available)
- `codeSnippet` — surrounding source lines

## Fix findings

1. Process `error` findings first — do not treat the task as done until they are fixed.
2. Fix `warning` findings when the change is reasonable.
3. `info` findings are suggestions; address them when relevant.
4. Re-run `npx @api-doctor/cli .` and confirm the report is clean (or score improved).

## Optional: markdown handoff

To paste findings into a chat or another agent:

```bash
npx @api-doctor/cli . --format markdown > issues.md
```
