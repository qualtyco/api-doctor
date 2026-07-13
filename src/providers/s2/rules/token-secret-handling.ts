/**
 * s2-token-secret-handling (security)
 *
 * The secret returned by accessTokens.issue() is shown exactly once;
 * accessTokens.list() returns metadata only. Flags (a) the issued secret
 * written to console/log sinks — persisting a live bearer credential — and
 * (b) reading `.accessToken` off a list() element, a model error that
 * expects list() to "recover" secrets. Building a client from the issued
 * secret or returning a scoped token to its consumer is the documented
 * handoff and is not flagged.
 */
import { contains, createS2FileTracker, memberCallObject, memberPropName, startOffset, unwrapExpr } from '../utils.js';

const CONSOLE_METHODS = new Set(['log', 'info', 'warn', 'error', 'debug', 'dir', 'trace']);

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Treat issued token secrets as write-once; list() returns metadata, not secrets',
      category: 'security',
      cwe: 'CWE-532',
      rationale:
        'Logging issue().accessToken writes a live bearer credential into log storage, where it outlives rotation and is readable by anyone with log access. And list() never returns secrets — code that reads .accessToken from a listed token is relying on a field that does not exist. Store the secret in a secret manager at issue time; use list() for metadata and revoke({ id }) by id.',
      docsUrl: 'https://s2.dev/docs/sdk/access-tokens',
      recommended: true,
    },
    messages: {
      loggedSecret:
        'Issued access-token secret written to a log sink. The secret is shown once at issue time — store it in a secret manager, never in logs.',
      listHasNoSecret:
        'accessTokens.list() returns metadata only; this element has no usable .accessToken secret. Capture the secret at issue time or revoke and re-issue.',
    },
    schema: [],
  },
  create(context: any) {
    const tracker = createS2FileTracker();
    const issuedVars = new Set<string>();
    const secretIdents = new Set<string>();
    const listVars = new Set<string>();
    const listElemVars = new Set<string>();
    const consoleCalls: any[] = [];
    /** Start offsets of non-computed member `property` slots — those
     *  identifiers are field names, not references to a secret binding. */
    const memberPropPositions = new Set<number>();
    /** Test expressions (`cond ? a : b`, `if (cond)`) — a secret referenced
     *  there is a presence check, its value never reaches the sink. */
    const testExpressions: any[] = [];
    const reports: Array<{ node: any; messageId: string }> = [];

    function accessTokensCall(init: any, method: string): boolean {
      let n = unwrapExpr(init);
      if (n?.type === 'AwaitExpression') n = unwrapExpr(n.argument);
      const holder = unwrapExpr(memberCallObject(n, method));
      return memberPropName(holder) === 'accessTokens';
    }

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },

      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      VariableDeclarator(node: any) {
        if (!node?.init) return;
        if (accessTokensCall(node.init, 'issue')) {
          if (node.id?.type === 'Identifier') issuedVars.add(node.id.name);
          if (node.id?.type === 'ObjectPattern') {
            for (const p of node.id.properties ?? []) {
              if (
                p?.type === 'Property' &&
                p.key?.type === 'Identifier' &&
                p.key.name === 'accessToken' &&
                p.value?.type === 'Identifier'
              ) {
                secretIdents.add(p.value.name);
              }
            }
          }
        }
        if (accessTokensCall(node.init, 'list') && node.id?.type === 'Identifier') {
          listVars.add(node.id.name);
        }
      },

      ConditionalExpression(node: any) {
        if (node?.test) testExpressions.push(node.test);
      },

      IfStatement(node: any) {
        if (node?.test) testExpressions.push(node.test);
      },

      ForOfStatement(node: any) {
        const right = unwrapExpr(node?.right);
        if (right?.type !== 'MemberExpression') return;
        if (memberPropName(right) !== 'accessTokens') return;
        const base = unwrapExpr(right.object);
        if (base?.type !== 'Identifier' || !listVars.has(base.name)) return;
        const decl = node.left?.declarations?.[0]?.id ?? node.left;
        if (decl?.type === 'Identifier') listElemVars.add(decl.name);
      },

      CallExpression(node: any) {
        const callee = unwrapExpr(node?.callee);
        if (
          callee?.type === 'MemberExpression' &&
          unwrapExpr(callee.object)?.name === 'console' &&
          CONSOLE_METHODS.has(memberPropName(callee) ?? '')
        ) {
          consoleCalls.push(node);
        }
      },

      MemberExpression(node: any) {
        if (!node.computed && node.property) memberPropPositions.add(startOffset(node.property));
        if (memberPropName(node) !== 'accessToken') return;
        const base = unwrapExpr(node.object);
        if (base?.type !== 'Identifier') return;
        if (listElemVars.has(base.name)) {
          reports.push({ node, messageId: 'listHasNoSecret' });
          return;
        }
        if (issuedVars.has(base.name) && consoleCalls.some((c) => contains(c, node))) {
          reports.push({ node, messageId: 'loggedSecret' });
        }
      },

      Identifier(node: any) {
        if (secretIdents.size === 0 || !secretIdents.has(node?.name)) return;
        if (memberPropPositions.has(startOffset(node))) return;
        if (testExpressions.some((t) => contains(t, node))) return;
        if (consoleCalls.some((c) => contains(c, node))) {
          reports.push({ node, messageId: 'loggedSecret' });
        }
      },

      'Program:exit'() {
        if (!tracker.isS2File()) return;
        for (const r of reports) context.report(r);
      },
    };
  },
};

export const s2TokenSecretHandlingRule = rule;
export default rule;
