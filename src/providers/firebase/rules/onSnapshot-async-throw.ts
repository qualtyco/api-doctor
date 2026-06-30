import { someDescendant } from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'throw inside async onSnapshot callback creates an unhandled promise rejection',
      category: 'reliability',
      rationale:
        'onSnapshot does not handle Promise rejections from its callback. A throw inside an async callback becomes an unhandled rejection, silently terminating the listener and leaving the UI in a broken state with no error feedback.',
      docsUrl: 'https://firebase.google.com/docs/firestore/query-data/listen#handle_listen_errors',
      recommended: true,
    },
    messages: {
      asyncThrowInSnapshot:
        'throw inside an async onSnapshot callback creates an unhandled promise rejection. The listener silently stops. Use return with error logging or the onSnapshot error callback instead.',
    },
    schema: [],
  },
  create(context: any) {
    function isAsyncFn(node: any): boolean {
      return (
        (node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression') &&
        node.async === true
      );
    }

    function hasDirectThrow(fnNode: any): boolean {
      if (!fnNode?.body) return false;
      // Walk body but don't enter nested function boundaries
      function visit(n: any, depth: number): boolean {
        if (!n || typeof n !== 'object') return false;
        if (Array.isArray(n)) return n.some((item) => visit(item, depth));
        if (typeof n.type !== 'string') return false;
        // Don't descend into nested function definitions
        if (
          depth > 0 &&
          (n.type === 'FunctionDeclaration' ||
            n.type === 'FunctionExpression' ||
            n.type === 'ArrowFunctionExpression')
        ) {
          return false;
        }
        if (n.type === 'ThrowStatement') return true;
        for (const key of Object.keys(n)) {
          if (key === 'parent' || key === 'loc' || key === 'range' || key === 'type') continue;
          if (visit(n[key], depth + 1)) return true;
        }
        return false;
      }
      return visit(fnNode.body, 0);
    }

    return {
      CallExpression(node: any) {
        const callee = node.callee;
        if (callee?.type !== 'Identifier' || callee.name !== 'onSnapshot') return;

        for (const arg of node.arguments ?? []) {
          if (!isAsyncFn(arg)) continue;
          if (hasDirectThrow(arg)) {
            context.report({ node: arg, messageId: 'asyncThrowInSnapshot' });
          }
        }
      },
    };
  },
};

export const firebaseOnSnapshotAsyncThrowRule = rule;
export default rule;
