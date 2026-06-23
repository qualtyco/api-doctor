/**
 * firebase-unhandled-auth-popup-rejection (correctness)
 *
 * `signInWithPopup` rejects on common, expected, non-exceptional outcomes
 * (auth/popup-closed-by-user, auth/popup-blocked, auth/cancelled-popup-request).
 * A call with no try/catch and no chained .catch leaves the rejection
 * unhandled — loading state never clears and the user has no way to retry
 * without reloading the page.
 */
import { chainLinks, contains, isIdentifierCall, memberPropName, namedImportsFrom } from '../utils.js';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'signInWithPopup calls must handle rejection',
      category: 'correctness',
      rationale:
        'signInWithPopup rejects with auth/popup-closed-by-user, auth/popup-blocked, and auth/cancelled-popup-request — all common, expected outcomes, not edge cases. Without a try/catch (or a chained .catch), the rejection is unhandled: loading state set before the call never clears, and the user has no way to retry without reloading the page.',
      docsUrl: 'https://firebase.google.com/docs/auth/web/google-signin',
      recommended: true,
    },
    messages: {
      unhandledPopupRejection:
        'signInWithPopup is called with no try/catch and no chained .catch. Popup-closed and popup-blocked are expected rejections, not edge cases.',
    },
    schema: [],
  },
  create(context: any) {
    let signInLocalName: string | undefined;
    const calls: any[] = [];
    const tryBlocks: any[] = [];
    const caughtCalls = new Set<any>();

    return {
      ImportDeclaration(node: any) {
        const imports = namedImportsFrom(node, 'firebase/auth');
        if (imports.has('signInWithPopup')) signInLocalName = imports.get('signInWithPopup');
      },
      TryStatement(node: any) {
        if (node.block) tryBlocks.push(node.block);
      },
      CallExpression(node: any) {
        if (isIdentifierCall(node, signInLocalName)) {
          calls.push(node);
          return;
        }
        const prop = memberPropName(node);
        const isCatch = prop === 'catch';
        const isTwoArgThen = prop === 'then' && (node.arguments ?? []).length >= 2;
        if (!isCatch && !isTwoArgThen) return;
        for (const link of chainLinks(node)) {
          if (isIdentifierCall(link, signInLocalName)) caughtCalls.add(link);
        }
      },
      'Program:exit'() {
        for (const call of calls) {
          if (caughtCalls.has(call)) continue;
          if (tryBlocks.some((block) => contains(block, call))) continue;
          context.report({ node: call, messageId: 'unhandledPopupRejection' });
        }
      },
    };
  },
};

export const firebaseUnhandledAuthPopupRejectionRule = rule;
export default rule;
