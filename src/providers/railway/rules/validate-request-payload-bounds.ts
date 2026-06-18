/**
 * railway-validate-request-payload-bounds (security)
 *
 * A write handler reads `request.json()` and type-checks the fields
 * (`typeof x === "string"`) but never bounds their length. Combined with
 * an open endpoint, a client can persist unbounded numbers of arbitrarily long
 * rows, growing Railway's metered Postgres volume indefinitely.
 *
 * Detection (AST), per exported mutating handler:
 *   - reads `request.json()`, AND
 *   - has a `typeof x === "string"` validation, AND
 *   - performs a write `.query(...)` (so unbounded data is actually persisted),
 *     AND
 *   - has no `.length` check anywhere in the handler.
 *
 * A handler that only reads (no write query) is not flagged.
 */
import {
  contains,
  getExportedHandlers,
  getQuerySql,
  isLengthMember,
  isQueryCall,
  isRequestJsonCall,
  isTypeofStringComparison,
  MUTATING_METHODS,
  sqlIsWrite,
  type Handler,
} from '../utils.js';

interface State extends Handler {
  readsJson: boolean;
  typeChecksString: boolean;
  hasWrite: boolean;
  hasLengthCheck: boolean;
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Persisted request payloads on Railway must enforce length bounds, not just type checks',
      category: 'security',
      cwe: 'CWE-770',
      owasp: 'API4:2023 Unrestricted Resource Consumption',
      docsUrl: 'https://docs.railway.com/guides/postgresql',
      rationale:
        'A handler that validates only the type of incoming fields (typeof === "string") but never their length lets a client persist arbitrarily large values. On Railway, Postgres storage is billed by volume size, so unbounded inserts grow cost indefinitely and a burst of abuse persists until an age-based cleanup eventually catches it. Enforce an explicit length cap before persisting.',
      recommended: true,
    },
    messages: {
      missingBounds:
        'This {{method}} handler type-checks the payload but never bounds its length before persisting. Add an explicit length cap (e.g. value.length > 200) to prevent unbounded Railway Postgres growth.',
    },
    schema: [],
  },
  create(context: any) {
    const handlers: State[] = [];

    function forEach(node: any, fn: (h: State) => void) {
      for (const h of handlers) if (contains(h.node, node)) fn(h);
    }

    return {
      ExportNamedDeclaration(node: any) {
        for (const h of getExportedHandlers(node)) {
          if (MUTATING_METHODS.has(h.name)) {
            handlers.push({
              ...h,
              readsJson: false,
              typeChecksString: false,
              hasWrite: false,
              hasLengthCheck: false,
            });
          }
        }
      },
      CallExpression(node: any) {
        if (isRequestJsonCall(node)) forEach(node, (h) => (h.readsJson = true));
        if (isQueryCall(node)) {
          const sql = getQuerySql(node);
          if (sql && sqlIsWrite(sql)) forEach(node, (h) => (h.hasWrite = true));
        }
      },
      BinaryExpression(node: any) {
        if (isTypeofStringComparison(node)) forEach(node, (h) => (h.typeChecksString = true));
      },
      MemberExpression(node: any) {
        if (isLengthMember(node)) forEach(node, (h) => (h.hasLengthCheck = true));
      },
      'Program:exit'() {
        for (const h of handlers) {
          if (h.readsJson && h.typeChecksString && h.hasWrite && !h.hasLengthCheck) {
            context.report({
              node: h.node,
              messageId: 'missingBounds',
              data: { method: h.name },
            });
          }
        }
      },
    };
  },
};

export const railwayValidateRequestPayloadBoundsRule = rule;
export default rule;
