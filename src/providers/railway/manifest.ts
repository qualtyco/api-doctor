import type { ProviderManifest } from '../../types.js';

/**
 * Railway has no app-facing npm SDK for this integration style, so detection
 * keys off the Postgres driver (`pg`) Railway apps commonly use plus
 * Railway-specific URL/host patterns.
 */
export const railwayManifest: ProviderManifest = {
  name: 'railway',
  displayName: 'Railway',
  detect: {
    packages: ['pg'],
    imports: ['pg'],
    urlPatterns: ['railway.app', 'railway.com', 'rlwy.net'],
  },
  oxlintRules: [
    {
      key: 'railway-cron-service-must-share-schema-bootstrap',
      resultRule: 'railway/correctness/cron-service-must-share-schema-bootstrap',
      message:
        'This script queries a table directly but never bootstraps the schema (e.g. ensureSchema()).',
      fix: 'Import and call the shared schema bootstrap (e.g. await ensureSchema()) before querying, so a cron service running before the web app has created the table does not crash on a missing relation.',
      docsUrl: 'https://docs.railway.com/guides/cron-jobs',
      severity: 'error',
    },
    {
      key: 'railway-no-unauthenticated-public-write-endpoint',
      resultRule: 'railway/security/no-unauthenticated-public-write-endpoint',
      message:
        'This write route handler persists request data without any authentication check.',
      fix: 'Gate the handler behind an auth check (token header, session, or origin) before persisting — a Railway public domain turns this into an open write API.',
      docsUrl: 'https://docs.railway.com/guides/public-networking',
      severity: 'error',
    },
    {
      key: 'railway-pg-pool-requires-error-handler',
      resultRule: 'railway/reliability/pg-pool-requires-error-handler',
      message: 'pg Pool created without a pool.on("error", ...) handler.',
      fix: 'Attach pool.on("error", (err) => ...) — an idle client backend error with no listener throws and crashes the Node process when Railway drops connections.',
      docsUrl: 'https://node-postgres.com/apis/pool#events',
      severity: 'error',
    },
    {
      key: 'railway-validate-request-payload-bounds',
      resultRule: 'railway/security/validate-request-payload-bounds',
      message: 'Persisted request payload is type-checked but has no length/size bound.',
      fix: 'Add an explicit length cap (e.g. expression.length > 200) before persisting, to prevent unbounded growth of Railway-metered Postgres storage.',
      docsUrl: 'https://docs.railway.com/guides/postgresql',
      severity: 'warning',
    },
    {
      key: 'railway-no-raw-error-logging-near-db-connection',
      resultRule: 'railway/security/no-raw-error-logging-near-db-connection',
      message: 'Raw error object logged in a database-connection context.',
      fix: 'Log err.message instead of the whole error — pg connection errors can carry the DATABASE_URL (with password) into Railway logs.',
      docsUrl: 'https://docs.railway.com/guides/logs',
      severity: 'warning',
    },
    {
      key: 'railway-no-ddl-in-request-handler',
      resultRule: 'railway/correctness/no-ddl-in-request-handler',
      message: 'Schema DDL (CREATE TABLE / ensureSchema) runs inside a request handler.',
      fix: 'Run schema creation once at deploy time (e.g. a preDeployCommand migration) rather than on the hot request path, where CREATE TABLE IF NOT EXISTS can race across replicas.',
      docsUrl: 'https://docs.railway.com/reference/config-as-code',
      severity: 'warning',
    },
  ],
};
