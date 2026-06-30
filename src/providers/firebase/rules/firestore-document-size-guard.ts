import { someDescendant } from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Firestore write includes editor.getJSON() without a document size guard',
      category: 'reliability',
      rationale:
        'Firestore documents have a 1 MiB limit. When a rich-text editor stores base64 images inline, a single paste can push the document over the limit. The write silently fails with INVALID_ARGUMENT. Always check document size before calling updateDoc/setDoc when the payload includes editor JSON.',
      docsUrl: 'https://firebase.google.com/docs/firestore/quotas#limits',
      recommended: true,
    },
    messages: {
      missingDocumentSizeGuard:
        'Firestore write includes editor.getJSON() without a document size check. Base64 images can exceed the 1 MiB Firestore limit, silently failing the write. Add a Blob size guard before calling updateDoc/setDoc.',
    },
    schema: [],
  },
  create(context: any) {
    const WRITE_FNS = new Set(['updateDoc', 'setDoc']);

    const flagCandidates: any[] = [];
    let hasBlobCheck = false;

    function containsGetJson(args: any[]): boolean {
      return args.some((arg) =>
        someDescendant(arg, (n) => {
          if (n?.type !== 'CallExpression') return false;
          const callee = n.callee;
          return (
            callee?.type === 'MemberExpression' &&
            callee.property?.type === 'Identifier' &&
            callee.property.name === 'getJSON'
          );
        }),
      );
    }

    return {
      CallExpression(node: any) {
        const callee = node.callee;
        if (callee?.type === 'Identifier' && WRITE_FNS.has(callee.name)) {
          if (containsGetJson(node.arguments ?? [])) {
            flagCandidates.push(node);
          }
        }
      },

      NewExpression(node: any) {
        if (node.callee?.type === 'Identifier' && node.callee.name === 'Blob') {
          hasBlobCheck = true;
        }
      },

      'Program:exit'() {
        if (hasBlobCheck) return;
        for (const node of flagCandidates) {
          context.report({ node, messageId: 'missingDocumentSizeGuard' });
        }
      },
    };
  },
};

export const firebaseFirestoreDocumentSizeGuardRule = rule;
export default rule;
