const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'onSnapshot called without an error callback — Firestore permission errors silently stop the listener',
      category: 'reliability',
      rationale:
        'When Firestore denies a read, the listener silently stops emitting snapshots with no error state set or user feedback. Always provide a third argument error callback to onSnapshot so permission denials and connection drops are surfaced.',
      docsUrl: 'https://firebase.google.com/docs/firestore/query-data/listen#handle_listen_errors',
      recommended: true,
    },
    messages: {
      missingErrorCallback:
        'onSnapshot called without an error callback. Firestore permission errors will silently stop the listener with no user feedback. Add an error callback: onSnapshot(ref, successFn, errorFn).',
    },
    schema: [],
  },
  create(context: any) {
    function isFunctionNode(n: any): boolean {
      return n?.type === 'ArrowFunctionExpression' || n?.type === 'FunctionExpression';
    }

    function isOptionsObject(n: any): boolean {
      return n?.type === 'ObjectExpression';
    }

    return {
      CallExpression(node: any) {
        const callee = node.callee;
        if (callee?.type !== 'Identifier' || callee.name !== 'onSnapshot') return;

        const args = node.arguments ?? [];

        // onSnapshot(ref, callback) — exactly 2 args, second is a function
        if (args.length === 2 && isFunctionNode(args[1])) {
          context.report({ node, messageId: 'missingErrorCallback' });
          return;
        }

        // onSnapshot(ref, options, callback) — 3 args, 2nd is options object, 3rd is a function but no 4th error cb
        if (args.length === 3 && isOptionsObject(args[1]) && isFunctionNode(args[2])) {
          context.report({ node, messageId: 'missingErrorCallback' });
        }
      },
    };
  },
};

export const firebaseOnSnapshotMissingErrorCallbackRule = rule;
export default rule;
