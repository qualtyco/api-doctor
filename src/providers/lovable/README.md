# Lovable

4 oxlint rules for Lovable-generated apps (React/Vite + Lovable Cloud/Supabase).

|                          |                                      |
| ------------------------ | ------------------------------------ |
| **Manifest**             | [manifest.ts](manifest.ts)           |
| **Rule implementations** | [rules/](rules/)                     |
| **Shared AST helpers**   | [utils.ts](utils.ts)                 |
| **Fixtures**             | `tests/fixtures/lovable/`            |
| **Rule tests**           | `tests/rules/lovable-*.test.ts`      |

Detection: `lovable-tagger` in package.json or imports, or `lovable.dev`/`lovable.app` in source.

These rules target the gap between what Lovable's docs say should be server-side (Edge Functions: secrets, payments, scheduled jobs) and what commonly ends up running client-side instead. Some related checks were intentionally **not** implemented because they don't fit this tool's single-file JS/TS-AST architecture:

| Pattern | Why it's out of scope |
| --- | --- |
| Postgres RLS policies missing column-level `WITH CHECK` scoping | Lives in `.sql` migration files — the scanner only walks `.ts/.tsx/.js/.jsx`; oxlint can't parse SQL. |
| Default/unreplaced social-preview (Open Graph) image and metadata | Lives in `index.html` meta tags — not a JS/TS file, not parsed at all. |
| No Supabase Edge Functions present despite client-side secrets/payment code | Requires a directory-absence check (`supabase/functions/` missing) cross-referenced with secrets found anywhere in the project — project-structure-level, not a single-file AST rule. |

## Rules

| Rule | Category | Severity |
| --- | --- | --- |
| `lovable-no-client-side-secret-fetch` | security | error |
| `lovable-paid-flag-without-edge-function` | security | error |
| `lovable-expiry-column-never-checked` | correctness | warning |
| `lovable-silent-catch-on-provider-call` | correctness | warning |

`expiry-column-never-checked` and `paid-flag-without-edge-function` only see one file at a time — a column written in one file and read/filtered in another (or never) won't be fully reconciled across the whole project.
