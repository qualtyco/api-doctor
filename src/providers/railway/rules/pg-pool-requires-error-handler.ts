/**
 * railway-pg-pool-requires-error-handler (reliability)
 *
 * A singleton `pg.Pool` is created with no `pool.on('error', ...)` listener.
 * node-postgres emits idle-client backend
 * errors as an `'error'` event on the pool; an EventEmitter with no `'error'`
 * listener throws, crashing the Node process. Railway-managed Postgres drops
 * idle connections during maintenance/restarts, so this is a real risk for a
 * long-running container.
 *
 * Detection (AST):
 *   - file uses `pg` (import/require), AND
 *   - creates a `new Pool(...)`, AND
 *   - never registers a `<x>.on('error', ...)` listener anywhere in the file.
 *
 * The pg gate means a `new Pool()` from an unrelated library is not flagged.
 */
import {
  importSourceOf,
  isNewPoolExpression,
  isOnErrorCall,
  isPgModule,
  requireSourceOf,
} from '../utils.js';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'A pg Pool on Railway must register a pool.on("error") handler',
      category: 'reliability',
      docsUrl: 'https://node-postgres.com/apis/pool#events',
      rationale:
        'node-postgres emits backend errors on idle clients as an "error" event on the Pool. A Node EventEmitter with no "error" listener rethrows, crashing the process. Railway-managed Postgres routinely drops idle connections during maintenance and restarts, so a long-running server container without pool.on("error", ...) will eventually crash on an event it could have absorbed.',
      recommended: true,
    },
    messages: {
      missingErrorHandler:
        'This pg Pool has no pool.on("error", ...) handler. An idle-client backend error with no listener will crash the process when Railway drops the connection.',
    },
    schema: [],
  },
  create(context: any) {
    let usesPg = false;
    let hasErrorHandler = false;
    const pools: any[] = [];

    return {
      ImportDeclaration(node: any) {
        if (isPgModule(importSourceOf(node))) usesPg = true;
      },
      CallExpression(node: any) {
        if (isPgModule(requireSourceOf(node))) usesPg = true;
        if (isOnErrorCall(node)) hasErrorHandler = true;
      },
      NewExpression(node: any) {
        if (isNewPoolExpression(node)) pools.push(node);
      },
      'Program:exit'() {
        if (!usesPg || hasErrorHandler) return;
        for (const pool of pools) {
          context.report({ node: pool, messageId: 'missingErrorHandler' });
        }
      },
    };
  },
};

export const railwayPgPoolRequiresErrorHandlerRule = rule;
export default rule;
