/**
 * railway-no-ddl-in-request-handler (correctness)
 *
 * `ensureSchema()` (a `CREATE TABLE IF NOT EXISTS` DDL) running on the hot
 * request path — called before every query in a handler. Besides the
 * per-request catalog round-trip, `CREATE TABLE IF NOT EXISTS` is
 * not fully race-proof: if Railway scales to >1 replica and two instances
 * cold-start at once, both can attempt the create and one can fail.
 *
 * Detection (AST), inside any exported App Router handler:
 *   - a schema-bootstrap call (ensureSchema() / migrate() / ...), OR
 *   - a `.query(sql)` whose SQL is DDL (CREATE/ALTER/DROP TABLE|INDEX|...).
 *
 * DDL at module top level (a one-time cold-start migration) is outside any
 * handler and is not flagged.
 */
import {
  contains,
  getExportedHandlers,
  getQuerySql,
  isQueryCall,
  isSchemaBootstrapCall,
  sqlIsDDL,
  type Handler,
} from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Schema DDL must not run inside a Railway request handler',
      category: 'correctness',
      docsUrl: 'https://docs.railway.com/reference/config-as-code',
      rationale:
        'Running CREATE TABLE IF NOT EXISTS (directly or via ensureSchema()) on every request adds a catalog round-trip to the hot path and is not race-proof: when Railway runs more than one replica, two cold-starting instances can attempt the create simultaneously and one can fail with a duplicate-relation error. Run schema creation once at deploy time (e.g. a preDeployCommand migration) instead.',
      recommended: true,
    },
    messages: {
      ddlInHandler:
        'Schema DDL runs inside the {{method}} request handler. Move schema creation to a one-time deploy step (e.g. preDeployCommand) — per-request CREATE TABLE can race across Railway replicas.',
    },
    schema: [],
  },
  create(context: any) {
    const handlers: Handler[] = [];
    const reported = new Set<any>();

    function reportInHandler(node: any) {
      for (const h of handlers) {
        if (contains(h.node, node) && !reported.has(h.node)) {
          reported.add(h.node);
          context.report({ node: h.node, messageId: 'ddlInHandler', data: { method: h.name } });
        }
      }
    }

    return {
      ExportNamedDeclaration(node: any) {
        for (const h of getExportedHandlers(node)) handlers.push(h);
      },
      CallExpression(node: any) {
        if (isSchemaBootstrapCall(node)) {
          reportInHandler(node);
          return;
        }
        if (isQueryCall(node)) {
          const sql = getQuerySql(node);
          if (sql && sqlIsDDL(sql)) reportInHandler(node);
        }
      },
    };
  },
};

export const railwayNoDdlInRequestHandlerRule = rule;
export default rule;
