const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'new Date() used for Firestore timestamp instead of serverTimestamp()',
      category: 'correctness',
      rationale:
        'Firestore auto-converts Date objects to Timestamps on write, so new Date() and Timestamp.now() are equivalent — both use the client clock, which cannot be trusted (skewed or deliberately changed clocks produce wrong orderings). serverTimestamp() stamps the value on the server instead, and it is the only option that satisfies security rules comparing a field against request.time (e.g. createdAt == request.time), which reject both new Date() and Timestamp.now().',
      docsUrl: 'https://firebase.google.com/docs/reference/js/firestore_.timestamp',
      recommended: true,
    },
    messages: {
      useTimestampNow:
        'Use serverTimestamp() instead of new Date() for Firestore timestamp fields. new Date() uses the untrusted client clock and fails rules that compare against request.time.',
    },
    schema: [],
  },
  create(context: any) {
    let importsFromFirestore = false;

    return {
      ImportDeclaration(node: any) {
        const src = node.source?.value;
        if (typeof src === 'string' && (src.startsWith('firebase/firestore') || src === 'firebase-admin/firestore')) {
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
