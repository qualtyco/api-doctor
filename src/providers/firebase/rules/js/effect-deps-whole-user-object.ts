/**
 * firebase-effect-deps-whole-user-object (reliability)
 *
 * Auth context providers typically re-publish the Firebase user on every
 * auth event — providers subscribed to `onIdTokenChanged` (or that clone
 * the user into state) hand out a new object reference on every token
 * refresh (roughly hourly) even when `uid` is unchanged. An effect that
 * only reads `user.uid` but depends on the whole `user` object tears down
 * and re-establishes its RTDB listener on every refresh.
 */
import { isUidMemberAccess, someDescendant } from '../../utils.js';

function isUseEffectCall(node: any): boolean {
  return node?.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'useEffect';
}

/** True for `<objName>.<prop>` / `<objName>?.<prop>` where prop is anything but `uid`. */
function isNonUidMemberAccess(node: any, objName: string): boolean {
  if (node?.type !== 'MemberExpression') return false;
  if (node.object?.type !== 'Identifier' || node.object.name !== objName) return false;
  if (node.computed) return true;
  return node.property?.type === 'Identifier' && node.property.name !== 'uid';
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'useEffect should depend on user?.uid, not the whole user object',
      category: 'reliability',
      rationale:
        "Auth context providers commonly hand out a new user object reference on every token refresh (roughly hourly) — providers subscribed to onIdTokenChanged, or ones that clone the user into React state, re-render with a fresh reference even when uid is unchanged. An effect that only reads user.uid but lists the whole user object in its dependency array tears down and re-establishes its RTDB listener on every refresh — an avoidable unsubscribe/resubscribe cycle that briefly clears local state.",
      docsUrl: 'https://firebase.google.com/docs/reference/js/auth.md#onauthstatechanged',
      recommended: true,
    },
    messages: {
      wholeUserObjectDep:
        'This effect only reads {{name}}.uid but depends on the whole {{name}} object, which can get a new reference on every token refresh. Depend on {{name}}?.uid instead.',
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
          if (!someDescendant(callback, (n) => isUidMemberAccess(n, name))) continue;
          // If the effect also reads other properties of the object, depending
          // on the whole object is correct — only flag uid-only usage.
          if (someDescendant(callback, (n) => isNonUidMemberAccess(n, name))) continue;
          context.report({ node, messageId: 'wholeUserObjectDep', data: { name } });
        }
      },
    };
  },
};

export const firebaseEffectDepsWholeUserObjectRule = rule;
