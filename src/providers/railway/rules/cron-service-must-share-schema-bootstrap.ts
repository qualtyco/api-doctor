/**
 * railway-cron-service-must-share-schema-bootstrap (correctness)
 *
 * A standalone script (the kind a Railway cron service runs) that queries an
 * application table directly but never bootstraps the schema. When a table is
 * created lazily by an `ensureSchema()` called only from the web app's route
 * handler, a cron job whose first run fires before any request has hit the
 * web app gets a `relation "<table>" does not exist` error, exits non-zero,
 * and Railway does not retry until the next scheduled run (24h later).
 *
 * Detection (AST):
 *   - file uses `pg` (import/require), AND
 *   - issues a `.query(sql)` whose SQL touches a named table (DML/SELECT FROM),
 *     AND
 *   - never calls a schema-bootstrap function (ensureSchema(), migrate(), ...),
 *     AND
 *   - never runs DDL itself (no CREATE TABLE anywhere in the file).
 *
 * Route handlers that call `ensureSchema()` and `lib/db` modules that contain
 * the `CREATE TABLE` themselves are therefore not flagged.
 */
import {
  getQuerySql,
  importSourceOf,
  isPgModule,
  isQueryCall,
  isSchemaBootstrapCall,
  requireSourceOf,
  sqlIsDDL,
  sqlTouchesTable,
} from '../utils.js';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A Railway cron/worker script must bootstrap the DB schema before querying tables the web app creates lazily',
      category: 'correctness',
      docsUrl: 'https://docs.railway.com/guides/cron-jobs',
      rationale:
        'When the table is created lazily by the web app and the cron script queries it directly, the very first scheduled cron run after a fresh deploy can hit the table before any request has created it, throwing "relation does not exist". Railway does not retry a failed cron run before its next schedule, so the job silently stays broken. The script must call the same ensureSchema() bootstrap (or create the table itself) before querying.',
      recommended: true,
    },
    messages: {
      missingSchemaBootstrap:
        'This script queries a table without bootstrapping the schema first. Call the shared ensureSchema() (or create the table) before querying, or the first Railway cron run can fail on a missing relation.',
    },
    schema: [],
  },
  create(context: any) {
    let usesPg = false;
    let bootstrapsSchema = false;
    let firstTableQuery: any = null;

    return {
      ImportDeclaration(node: any) {
        if (isPgModule(importSourceOf(node))) usesPg = true;
      },
      CallExpression(node: any) {
        if (isPgModule(requireSourceOf(node))) usesPg = true;
        if (isSchemaBootstrapCall(node)) bootstrapsSchema = true;

        if (isQueryCall(node)) {
          const sql = getQuerySql(node);
          if (sql && sqlIsDDL(sql)) bootstrapsSchema = true; // file creates the table itself
          if (sql && sqlTouchesTable(sql) && !firstTableQuery) firstTableQuery = node;
        }
      },
      'Program:exit'() {
        if (!usesPg) return;
        if (bootstrapsSchema) return;
        if (firstTableQuery) {
          context.report({ node: firstTableQuery, messageId: 'missingSchemaBootstrap' });
        }
      },
    };
  },
};

export const railwayCronServiceMustShareSchemaBootstrapRule = rule;
export default rule;
