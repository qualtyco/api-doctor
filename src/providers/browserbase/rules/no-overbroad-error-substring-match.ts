/**
 * browserbase-no-overbroad-error-substring-match (reliability)
 *
 * Matching a caught error's message against a single generic word like
 * "session" — the name of the resource being polled — is nearly guaranteed
 * to match on any unrelated transient error (connection reset, SSL error,
 * timeout) too. A single coincidental match shouldn't be treated the same
 * as a confirmed 404/410, especially when the action taken is destructive
 * (tearing down a healthy session).
 */
import { memberPropName, someDescendant } from '../utils.js';

const OVERBROAD_TERMS = new Set(['session', 'context', 'browser', 'browserbase']);

function collectIncludesLiterals(test: any, literals: string[]): void {
  if (!test) return;
  if (test.type === 'LogicalExpression' && test.operator === '||') {
    collectIncludesLiterals(test.left, literals);
    collectIncludesLiterals(test.right, literals);
    return;
  }
  if (test.type === 'CallExpression' && memberPropName(test) === 'includes') {
    const arg = test.arguments?.[0];
    if (arg?.type === 'Literal' && typeof arg.value === 'string') literals.push(arg.value.toLowerCase());
  }
}

function isCleanupCall(node: any): boolean {
  if (node?.type !== 'CallExpression') return false;
  const callee = node.callee;
  const name = callee?.type === 'Identifier' ? callee.name : memberPropName(node);
  return !!name && /release|remove|cleanup|stop|teardown/i.test(name);
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Error-message checks must not OR in a single generic resource-name substring',
      category: 'reliability',
      rationale:
        'A condition like `err.includes("not found") || err.includes("404") || err.includes("session")` looks like it is narrowing to a confirmed session-ended error, but the last clause matches a single generic word — the name of the resource being polled. Virtually any exception raised from a sessions.* call (a connection reset, an SSL error, a generic timeout that echoes the request URL) is likely to contain that substring too. A coincidental match then triggers the same destructive cleanup as a real 404/410, tearing down a healthy session on a transient blip.',
      docsUrl: 'https://docs.browserbase.com/reference/api/session-live-urls',
      recommended: true,
    },
    messages: {
      overbroadMatch:
        'This OR-chain includes a generic substring check ("{{term}}") that matches almost any error from a sessions.* call, not just a confirmed session-ended response.',
    },
    schema: [],
  },
  create(context: any) {
    return {
      IfStatement(node: any) {
        const literals: string[] = [];
        collectIncludesLiterals(node.test, literals);
        if (literals.length < 2) return;

        const overbroad = literals.find((l) => OVERBROAD_TERMS.has(l));
        if (!overbroad) return;

        if (someDescendant(node.consequent, isCleanupCall)) {
          context.report({ node, messageId: 'overbroadMatch', data: { term: overbroad } });
        }
      },
    };
  },
};

export const browserbaseNoOverbroadErrorSubstringMatchRule = rule;
export default rule;
