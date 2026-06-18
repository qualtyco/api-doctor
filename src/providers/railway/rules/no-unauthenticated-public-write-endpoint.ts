/**
 * railway-no-unauthenticated-public-write-endpoint (security)
 *
 * An exported mutating route handler (POST/PUT/PATCH/DELETE) that persists
 * request data with no authentication, API key, or origin check. Generating a
 * Railway public domain for the service turns this into an open write API any
 * internet client can POST to.
 *
 * Detection (AST):
 *   - exported App Router handler whose method mutates (POST/PUT/PATCH/DELETE),
 *     AND
 *   - performs a write `.query(sql)` (INSERT/UPDATE/DELETE) inside the handler,
 *     AND
 *   - contains no auth signal inside the handler:
 *       * reads a request header (request.headers.get(...))
 *       * references an env secret (process.env.*TOKEN|SECRET|KEY|PASSWORD*)
 *       * calls an auth-shaped helper (auth/session/verify/authorize/require*)
 *
 * Read-only handlers (no write query) are not flagged.
 */
import {
  contains,
  getExportedHandlers,
  getQuerySql,
  isQueryCall,
  MUTATING_METHODS,
  sqlIsWrite,
  type Handler,
} from '../utils.js';

const ENV_SECRET = /(TOKEN|SECRET|KEY|PASSWORD|AUTH)/i;
const AUTH_FN = /^(auth|getAuth|getSession|getUser|getServerSession|verify|verifyAuth|authorize|authenticate|require\w*|checkAuth|isAuthorized|currentUser)$/;

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Mutating Railway route handlers must authenticate before persisting, since a public domain makes them internet-reachable',
      category: 'security',
      cwe: 'CWE-306',
      owasp: 'API2:2023 Broken Authentication',
      docsUrl: 'https://docs.railway.com/guides/public-networking',
      rationale:
        'Generating a public domain for a Railway service exposes its routes to the entire internet. A write handler that persists request data with no token, session, or origin check becomes an open write API: anyone can insert arbitrary rows, growing metered Postgres storage and corrupting application data. Authenticate the request before persisting.',
      recommended: true,
    },
    messages: {
      unauthenticatedWrite:
        'This {{method}} handler persists request data without an authentication check. Verify a token/session/origin before writing — a Railway public domain exposes it to the internet.',
    },
    schema: [],
  },
  create(context: any) {
    const handlers: Array<Handler & { hasWrite: boolean; hasAuth: boolean }> = [];

    function forEachHandlerContaining(node: any, fn: (h: (typeof handlers)[number]) => void) {
      for (const h of handlers) {
        if (contains(h.node, node)) fn(h);
      }
    }

    return {
      ExportNamedDeclaration(node: any) {
        for (const h of getExportedHandlers(node)) {
          if (MUTATING_METHODS.has(h.name)) {
            handlers.push({ ...h, hasWrite: false, hasAuth: false });
          }
        }
      },
      MemberExpression(node: any) {
        // request.headers... (an auth/header read) anywhere in the handler.
        if (node.property?.type === 'Identifier' && node.property.name === 'headers') {
          forEachHandlerContaining(node, (h) => {
            h.hasAuth = true;
          });
        }
        // process.env.<SECRET>
        if (
          node.property?.type === 'Identifier' &&
          ENV_SECRET.test(node.property.name) &&
          node.object?.type === 'MemberExpression' &&
          node.object.property?.type === 'Identifier' &&
          node.object.property.name === 'env'
        ) {
          forEachHandlerContaining(node, (h) => {
            h.hasAuth = true;
          });
        }
      },
      CallExpression(node: any) {
        // Write query inside the handler.
        if (isQueryCall(node)) {
          const sql = getQuerySql(node);
          if (sql && sqlIsWrite(sql)) {
            forEachHandlerContaining(node, (h) => {
              h.hasWrite = true;
            });
          }
        }
        // Auth-shaped helper call.
        const callee = node.callee;
        const name =
          callee?.type === 'Identifier'
            ? callee.name
            : callee?.type === 'MemberExpression' && callee.property?.type === 'Identifier'
              ? callee.property.name
              : null;
        if (name && AUTH_FN.test(name)) {
          forEachHandlerContaining(node, (h) => {
            h.hasAuth = true;
          });
        }
      },
      'Program:exit'() {
        for (const h of handlers) {
          if (h.hasWrite && !h.hasAuth) {
            context.report({
              node: h.node,
              messageId: 'unauthenticatedWrite',
              data: { method: h.name },
            });
          }
        }
      },
    };
  },
};

export const railwayNoUnauthenticatedPublicWriteEndpointRule = rule;
export default rule;
