/**
 * browserbase-no-conditional-authz-on-anonymous-user (security)
 *
 * A route handler that returns a Browserbase live-debugger URL or session
 * recording must reject unauthenticated/unauthorized callers unconditionally.
 * Gating the ownership check behind `if (user) { ...check... }` with no
 * unconditional `if (!user) return` guard means an anonymous request simply
 * skips the whole block and falls through to the sensitive call.
 */
import { contains, endOffset, isSessionsCall, isSessionsRecordingCall, startOffset } from '../utils.js';

function isUserLikeExpr(node: any): boolean {
  if (node?.type === 'Identifier') return /user/i.test(node.name);
  if (node?.type === 'MemberExpression' && !node.computed && node.property?.type === 'Identifier') {
    return /user/i.test(node.property.name);
  }
  return false;
}

function isFalsyGuardTest(test: any): boolean {
  if (test?.type === 'UnaryExpression' && test.operator === '!') return isUserLikeExpr(test.argument);
  if (test?.type === 'BinaryExpression' && (test.operator === '===' || test.operator === '==')) {
    const sides = [test.left, test.right];
    const isNullish = (n: any) => (n?.type === 'Literal' && n.value === null) || (n?.type === 'Identifier' && n.name === 'undefined');
    const nullSide = sides.find(isNullish);
    const otherSide = sides.find((s: any) => s !== nullSide);
    return !!nullSide && isUserLikeExpr(otherSide);
  }
  return false;
}

function hasReturnOrThrow(stmt: any): boolean {
  if (!stmt) return false;
  if (stmt.type === 'ReturnStatement' || stmt.type === 'ThrowStatement') return true;
  if (stmt.type === 'BlockStatement') {
    return (stmt.body ?? []).some((s: any) => s.type === 'ReturnStatement' || s.type === 'ThrowStatement');
  }
  return false;
}

function isTruthyGateTest(test: any): boolean {
  if (isUserLikeExpr(test)) return true;
  if (test?.type === 'LogicalExpression' && test.operator === '&&') {
    return isTruthyGateTest(test.left) || isTruthyGateTest(test.right);
  }
  return false;
}

type Scope = { node: any; start: number; end: number; guardPos?: number };

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Sensitive Browserbase resources must be guarded by unconditional authorization',
      category: 'security',
      cwe: 'CWE-862',
      owasp: 'A01:2021 Broken Access Control',
      rationale:
        'bb.sessions.debug() and bb.sessions.recording.retrieve() return a live CDP debugger URL or a full rrweb session replay — high-value resources. Gating the ownership check behind `if (user) { ...check... }` with no unconditional `if (!user) return` guard means an anonymous caller (no credentials at all) simply skips the whole block and falls through to the sensitive call. Authorization must reject the unauthenticated case explicitly, not rely on a conditional that happens to be true for legitimate callers.',
      docsUrl: 'https://docs.browserbase.com/reference/api/session-live-urls',
      recommended: true,
    },
    messages: {
      conditionalAuthz:
        'This route returns a Browserbase live-view/recording resource gated only by `if (user) {...}` with no unconditional rejection for anonymous callers. Add an `if (!user) return ...` guard before this.',
    },
    schema: [],
  },
  create(context: any) {
    const scopes: Scope[] = [];
    const gates: Array<{ start: number; end: number }> = [];
    const sensitiveCalls: any[] = [];

    function registerScope(node: any) {
      scopes.push({ node, start: startOffset(node), end: endOffset(node) });
    }

    function innermostScope(pos: number): Scope | undefined {
      let best: Scope | undefined;
      for (const scope of scopes) {
        if (pos < scope.start || pos > scope.end) continue;
        if (!best || scope.end - scope.start < best.end - best.start) best = scope;
      }
      return best;
    }

    return {
      FunctionDeclaration(node: any) {
        registerScope(node);
      },
      FunctionExpression(node: any) {
        registerScope(node);
      },
      ArrowFunctionExpression(node: any) {
        registerScope(node);
      },
      IfStatement(node: any) {
        if (isFalsyGuardTest(node.test) && hasReturnOrThrow(node.consequent)) {
          const pos = startOffset(node);
          const scope = innermostScope(pos);
          if (scope && (scope.guardPos === undefined || pos < scope.guardPos)) scope.guardPos = pos;
          return;
        }
        if (isTruthyGateTest(node.test) && !node.alternate) {
          gates.push({ start: startOffset(node), end: endOffset(node) });
        }
      },
      CallExpression(node: any) {
        if (isSessionsCall(node, 'debug') || isSessionsRecordingCall(node, 'retrieve')) {
          sensitiveCalls.push(node);
        }
      },
      'Program:exit'() {
        for (const call of sensitiveCalls) {
          const gate = gates.find((g) => contains(g, call));
          if (!gate) continue;
          const scope = innermostScope(startOffset(call));
          const hasGuardBeforeGate = scope?.guardPos !== undefined && scope.guardPos < gate.start;
          if (!hasGuardBeforeGate) {
            context.report({ node: call, messageId: 'conditionalAuthz' });
          }
        }
      },
    };
  },
};

export const browserbaseNoConditionalAuthzOnAnonymousUserRule = rule;
export default rule;
