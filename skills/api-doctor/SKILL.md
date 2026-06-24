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

Provider rule catalogs are listed in the [api-doctor GitHub repo](https://github.com/qualtyco/api-doctor/tree/main/src/providers) under `src/providers/<name>/README.md`.

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

## Fix findings — severity protocol

### `error` (always fix)

Errors indicate real bugs: data leakage, missing auth, silent failures, security
holes. Fix all errors before considering the task done. Do not mark the task
complete while any `error` finding remains.

### `warning` (judgment required — ask before restructuring)

Warnings indicate a real concern but may have legitimate exceptions. Before
fixing a warning, ask yourself:

**Is the fix a substantive change or a style change?**

- **Substantive** — the fix adds missing logic, changes behavior, prevents a
  real failure mode (e.g. adding a missing idempotency key, adding an env var
  check that didn't exist). Fix it without asking.

- **Style / restructuring** — the fix only reorganizes existing logic into a
  different shape without changing behavior (e.g. splitting one compound
  validation condition into multiple `if` blocks, reordering checks, renaming
  variables). **Do not silently apply style changes.** Instead, summarize the
  warning and ask the user:

  > "api-doctor flagged [finding]. The fix would restructure [X] into [Y]. The
  > logic is equivalent — this is a style preference, not a behavior change.
  > Want me to apply it?"

  Apply only if the user confirms.

This matters because api-doctor's AST detection sometimes can't parse certain
valid patterns (nested ternaries, complex conditionals), causing it to flag
correct code. Treat warnings as advisory, not as ground truth.

### `info` (suggestions only)

Informational findings are low-priority suggestions. Read them, consider
whether they're relevant to this project, and address them only if they
genuinely improve the integration. Do not restructure code to clear `info`
findings without explicit user direction.

Never treat clearing all `info` findings as a task requirement.

## Fix workflow

1. Read `.api-doctor/report.json` in full before making any changes.
2. Identify which findings are substantive vs. style.
3. Fix all `error` findings.
4. For each `warning`: apply substantive fixes; ask the user about style fixes.
5. Re-run `npx @api-doctor/cli .` and confirm errors are resolved.
6. If warnings remain after your fixes, explain which ones and why you left them.

Do not loop indefinitely trying to reach 100/100. A score of 85–100 with no
errors is a clean result. Residual warnings that would require style-only
changes are acceptable.

## Interpreting score vs. findings

The score drops more steeply for errors than warnings. A codebase with zero
errors and two style-only warnings may score 88/100. That is a good result —
do not treat it as incomplete work that requires further changes.

## Optional: markdown handoff

To paste findings into a chat or another agent:

```bash
npx @api-doctor/cli . --format markdown > issues.md
```