const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'new Date() used for Firestore timestamp instead of Timestamp.now() or serverTimestamp()',
      category: 'correctness',
      rationale:
        'While Firestore auto-converts Date objects on write, mixing new Date() with Timestamp.now() creates type inconsistencies. Firestore security rules that compare request.resource.data.createdAt against request.time expect a Timestamp on both sides; a bare Date object can cause silent rule evaluation failures.',
      docsUrl: 'https://firebase.google.com/docs/reference/js/firestore_.timestamp',
      recommended: true,
    },
    messages: {
      useTimestampNow:
        'Use Timestamp.now() or serverTimestamp() instead of new Date() for Firestore timestamp fields. new Date() creates type inconsistencies with security rules that compare against request.time.',
    },
    schema: [],
  },
  create(context: any) {
    let importsFromFirestore = false;

    return {
      ImportDeclaration(node: any) {
        const src = node.source?.value;
        if (typeof src === 'string' && (src.startsWith('firebase/') || src === 'firebase-admin/firestore')) {
          importsFromFirestore = true;
        }
      },

      NewExpression(node: any) {
        if (!importsFromFirestore) return;
        if (node.callee?.type !== 'Identifier' || node.callee.name !== 'Date') return;
        // Only flag new Date() with no arguments — new Date(value) is a conversion, not a "now" timestamp
        if ((node.arguments ?? []).length !== 0) return;
        context.report({ node, messageId: 'useTimestampNow' });
      },
    };
  },
};

export const firebaseUseTimestampNowRule = rule;
export default rule;
