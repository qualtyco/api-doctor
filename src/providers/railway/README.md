# Railway rules

Railway has no app-facing npm SDK for this integration style, so detection
keys off the `pg` Postgres driver Railway apps commonly use plus Railway host
patterns.

Rules here cover risks specific to running a `pg`-backed app on Railway —
public-domain exposure, cron services that run before the web app has
created its schema, and connection-pool reliability under Railway's
maintenance/restart behavior. Only AST-detectable checks that live in
`.js`/`.ts` files are implemented; checks that would need to parse
`railway.json`, `railway.cron.json`, or `package.json` are out of scope for
this oxlint JS plugin (see below).

## Security

| Rule | Severity | Detects |
|------|----------|---------|
| `railway/security/no-unauthenticated-public-write-endpoint` | error | A mutating route handler (POST/PUT/PATCH/DELETE) that persists request data with no auth check, exposed by a Railway public domain. |
| `railway/security/validate-request-payload-bounds` | warning | A write handler that type-checks the payload but never bounds its length, enabling unbounded Railway-metered Postgres growth. |
| `railway/security/no-raw-error-logging-near-db-connection` | warning | `console.error(err)` of a raw error object in a DB-connection context, risking `DATABASE_URL` (password) leakage into Railway logs. |

## Correctness

| Rule | Severity | Detects |
|------|----------|---------|
| `railway/correctness/cron-service-must-share-schema-bootstrap` | error | A script (the kind a Railway cron service runs) that queries an app table without calling the shared `ensureSchema()` bootstrap. |
| `railway/correctness/no-ddl-in-request-handler` | warning | Schema DDL (`CREATE TABLE` / `ensureSchema()`) executed on the hot request path, which can race across Railway replicas. |

## Reliability

| Rule | Severity | Detects |
|------|----------|---------|
| `railway/reliability/pg-pool-requires-error-handler` | error | A `pg.Pool` created with no `pool.on('error', ...)` listener — an idle-client backend error crashes the process when Railway drops the connection. |

## Out of scope (not implementable as oxlint JS rules)

These would require parsing JSON config files or checking for file/service
existence rather than JS AST, so they're not implemented in this plugin:

- A builder-enum check against `railway.json` / `railway.cron.json`.
- A check that a custom config filename (e.g. a second `railway.*.json`) is
  actually bound to a Railway service — that binding lives in the dashboard,
  not in any file this plugin can see.
- A check that a cron/worker service overrides its build command in
  `railway.cron.json` rather than inheriting the full app build.
- A check that `package.json`'s start script falls back to a default port
  when `PORT` is unset.
