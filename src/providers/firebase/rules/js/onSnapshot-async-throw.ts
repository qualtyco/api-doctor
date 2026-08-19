const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'throw inside async onSnapshot callback creates an unhandled promise rejection',
      category: 'reliability',
      rationale:
        'onSnapshot ignores the promise returned by an async callback, so a throw inside one becomes an unhandled promise rejection: the error never reaches the UI or the onSnapshot error callback (which only fires for stream errors), and in Node it can crash the process. The listener keeps delivering snapshots, but every one that hits the throw fails invisibly.',
      docsUrl: 'https://firebase.google.com/docs/firestore/query-data/listen#handle_listen_errors',
      recommended: true,
    },
    messages: {
      asyncThrowInSnapshot:
        'throw inside an async onSnapshot callback creates an unhandled promise rejection — the error surfaces nowhere. Catch it in the callback and set error state instead of throwing.',
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
