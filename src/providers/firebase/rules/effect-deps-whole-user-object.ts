/**
 * firebase-effect-deps-whole-user-object (reliability)
 *
 * `onAuthStateChanged` delivers a new `user` object reference on every
 * internal token refresh (roughly hourly), even when `uid` is unchanged.
 * An effect that only reads `user.uid` but depends on the whole `user`
 * object tears down and re-establishes its RTDB listener on every refresh.
 */
import { isUidMemberAccess, someDescendant } from '../utils.js';

function isUseEffectCall(node: any): boolean {
  return node?.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'useEffect';
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'useEffect should depend on user?.uid, not the whole user object',
      category: 'reliability',
      rationale:
        "onAuthStateChanged delivers a new user object reference on every internal token refresh (roughly hourly) even when uid is unchanged. An effect that only reads user.uid but lists the whole user object in its dependency array tears down and re-establishes its RTDB listener on every refresh — an avoidable unsubscribe/resubscribe cycle that briefly clears local state.",
      docsUrl: 'https://firebase.google.com/docs/reference/js/auth.md#onauthstatechanged',
      recommended: true,
    },
    messages: {
      wholeUserObjectDep:
        'This effect only reads {{name}}.uid but depends on the whole {{name}} object, which gets a new reference on every token refresh. Depend on {{name}}?.uid instead.',
    },
    schema: [],
  },
  create(context: any) {
    return {
      CallExpression(node: any) {
        if (!isUseEffectCall(node)) return;
        const [callback, depsArg] = node.arguments ?? [];
        if (!callback || depsArg?.type !== 'ArrayExpression') return;

        for (const el of depsArg.elements ?? []) {
          if (el?.type !== 'Identifier') continue;
          const name = el.name;
          if (someDescendant(callback, (n) => isUidMemberAccess(n, name))) {
            context.report({ node, messageId: 'wholeUserObjectDep', data: { name } });
          }
        }
      },
    };
  },
};

export const firebaseEffectDepsWholeUserObjectRule = rule;
export default rule;
