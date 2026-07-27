/**
 * s2-token-expiry-and-least-privilege (security)
 *
 * Flags accessTokens.issue(...) calls that mint a standing account-wide
 * credential: no basins/streams narrowing combined with either no expiresAt
 * or write-capable operations. The documented multi-tenant pattern —
 * `basins: { prefix: "" }` *with* a streams prefix and limited opGroups —
 * is scope-narrowed and is not flagged.
 */
import { createS2FileTracker, findProperty, getObjectArg, memberPropName, unwrapExpr } from '../../utils.js';

const WRITE_OP = /append|create|delete|trim|fence|issue|revoke|write/i;

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Issued S2 access tokens should expire and carry a least-privilege scope',
      category: 'security',
      cwe: 'CWE-272',
      owasp: 'API1:2023 Broken Object Level Authorization',
      rationale:
        'A never-expiring token with read+write over all basins and streams is a standing account-wide credential — if it leaks, it is valid forever. Scope each token to the narrowest basins/streams match and the minimal opGroups or ops list, and always set expiresAt so a leak has a bounded blast radius.',
      docsUrl: 'https://s2.dev/docs/sdk/access-tokens',
      recommended: true,
    },
    messages: {
      standingCredential:
        'Token issued without expiresAt and without basins/streams narrowing — a standing account-wide credential. Set expiresAt and scope it down.',
      broadWriteScope:
        'Token grants write-capable operations over every basin and stream. Restrict scope.basins/scope.streams (or narrow opGroups/ops) to least privilege.',
    },
    schema: [],
  },
  create(context: any) {
    const tracker = createS2FileTracker();
    const reports: Array<{ node: any; messageId: string }> = [];

    /** True when scope.<part> actually narrows: `exact` or a non-empty prefix. */
    function narrows(scope: any, part: string): boolean {
      const prop = findProperty(scope, part);
      if (!prop) return false;
      const value = unwrapExpr(prop.value);
      if (value?.type !== 'ObjectExpression') return true; // non-literal → assume narrowed
      if (findProperty(value, 'exact')) return true;
      const prefix = findProperty(value, 'prefix');
      if (!prefix) return false;
      const prefixValue = unwrapExpr(prefix.value);
      // `prefix: ""` means "all" — documented-correct only when the *other*
      // part narrows, which the caller checks.
      return !(prefixValue?.type === 'Literal' && prefixValue.value === '');
    }

    /** True when the scope permits any write-capable operation. */
    function grantsWrite(scope: any): boolean {
      const opGroups = findProperty(scope, 'opGroups');
      const ops = findProperty(scope, 'ops');
      if (!opGroups && !ops) return true; // no op restriction at all

      if (opGroups) {
        const stack = [unwrapExpr(opGroups.value)];
        while (stack.length) {
          const n = stack.pop();
          if (n?.type !== 'ObjectExpression') continue;
          for (const p of n.properties ?? []) {
            if (p?.type !== 'Property') continue;
            const value = unwrapExpr(p.value);
            if (value?.type === 'ObjectExpression') {
              stack.push(value);
            } else if (
              p.key?.type === 'Identifier' &&
              p.key.name === 'write' &&
              value?.type === 'Literal' &&
              value.value === true
            ) {
              return true;
            }
          }
        }
      }

      const opsValue = ops ? unwrapExpr(ops.value) : undefined;
      if (opsValue?.type === 'ArrayExpression') {
        for (const el of opsValue.elements ?? []) {
          const v = unwrapExpr(el);
          if (v?.type === 'Literal' && typeof v.value === 'string' && WRITE_OP.test(v.value)) {
            return true;
          }
        }
      }
      return false;
    }

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },

      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      CallExpression(node: any) {
        const callee = unwrapExpr(node?.callee);
        if (memberPropName(callee) !== 'issue') return;
        const holder = unwrapExpr(callee?.object);
        if (memberPropName(holder) !== 'accessTokens') return;

        const config = getObjectArg(node, 0);
        if (!config) return;

        const hasExpiresAt = Boolean(findProperty(config, 'expiresAt'));
        const scopeProp = findProperty(config, 'scope');
        const scope = scopeProp ? unwrapExpr(scopeProp.value) : undefined;

        // Non-literal scope objects can't be inspected — assume narrowed.
        if (scopeProp && scope?.type !== 'ObjectExpression') return;

        const broad = !scope || (!narrows(scope, 'basins') && !narrows(scope, 'streams'));
        if (!broad) return;

        const write = !scope || grantsWrite(scope);
        if (!hasExpiresAt) {
          reports.push({ node, messageId: 'standingCredential' });
        } else if (write) {
          reports.push({ node, messageId: 'broadWriteScope' });
        }
      },

      'Program:exit'() {
        if (!tracker.isS2File()) return;
        for (const r of reports) context.report(r);
      },
    };
  },
};

export const s2TokenExpiryAndLeastPrivilegeRule = rule;
export default rule;
