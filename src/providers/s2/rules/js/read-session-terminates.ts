/**
 * s2-read-session-terminates (reliability)
 *
 * A read session without a stop condition follows the stream indefinitely,
 * waiting for new records. Inside a request handler that is a hang: the
 * `for await` never completes and the response never returns. Flags
 * readSession(...) calls in HTTP handlers (Next.js route exports,
 * express-style `app.get('/path', handler)`) that have neither a `stop`
 * condition nor an abort `signal`. Top-level/long-lived followers are the
 * documented use of an unbounded session and are not flagged.
 */
import { contains, createS2FileTracker, findProperty, memberCallObject, memberPropName, unwrapExpr } from '../../utils.js';

const HTTP_EXPORTS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']);
const ROUTE_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'all', 'use']);

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Read sessions in request handlers need a stop condition or abort signal',
      category: 'reliability',
      rationale:
        'Sessions with no stop condition follow updates in real time and never terminate on their own. Copied into a request/response handler ("load history and return"), the for-await loop waits forever for the next record and the request hangs. Bounded reads want stop: { waitSecs: 0 } (or count/bytes/until); genuine followers should live outside the request cycle or carry an abort signal.',
      docsUrl: 'https://s2.dev/docs/sdk/reading',
      recommended: true,
    },
    messages: {
      unboundedInHandler:
        'This read session has no stop condition, so the request handler will follow the stream forever and never respond. Add stop: { waitSecs: 0 } for a bounded read, or wire an abort signal for an intentional follower.',
    },
    schema: [],
  },
  create(context: any) {
    const tracker = createS2FileTracker();
    const handlerRanges: any[] = [];
    const candidates: any[] = [];

    function pushFunction(fn: any) {
      if (
        fn?.type === 'FunctionDeclaration' ||
        fn?.type === 'FunctionExpression' ||
        fn?.type === 'ArrowFunctionExpression'
      ) {
        handlerRanges.push(fn);
      }
    }

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },

      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      ExportNamedDeclaration(node: any) {
        const decl = node?.declaration;
        if (decl?.type === 'FunctionDeclaration' && HTTP_EXPORTS.has(decl.id?.name)) {
          pushFunction(decl);
        }
        if (decl?.type === 'VariableDeclaration') {
          for (const d of decl.declarations ?? []) {
            if (d?.id?.type === 'Identifier' && HTTP_EXPORTS.has(d.id.name)) {
              pushFunction(unwrapExpr(d.init));
            }
          }
        }
      },

      CallExpression(node: any) {
        // express/fastify style: app.get('/path', handler) — the string
        // route path is the positive evidence this is an HTTP route.
        const callee = unwrapExpr(node?.callee);
        const method = memberPropName(callee);
        if (method && ROUTE_METHODS.has(method)) {
          const first = unwrapExpr(node.arguments?.[0]);
          if (first?.type === 'Literal' && typeof first.value === 'string' && first.value.startsWith('/')) {
            for (const arg of node.arguments.slice(1)) pushFunction(unwrapExpr(arg));
          }
        }

        if (!memberCallObject(node, 'readSession')) return;
        if (!handlerRanges.some((h) => contains(h, node))) return;

        const options = unwrapExpr(node.arguments?.[0]);
        if (options?.type === 'ObjectExpression' && findProperty(options, 'stop')) return;
        const second = unwrapExpr(node.arguments?.[1]);
        if (second?.type === 'ObjectExpression' && findProperty(second, 'signal')) return;

        candidates.push(node);
      },

      'Program:exit'() {
        if (!tracker.isS2File()) return;
        for (const node of candidates) {
          context.report({ node, messageId: 'unboundedInHandler' });
        }
      },
    };
  },
};

export const s2ReadSessionTerminatesRule = rule;
