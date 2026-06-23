/**
 * firebase-rtdb-batch-write-not-atomic (correctness)
 *
 * `Promise.all(items.map((item) => { const ref = push(parent); return set(ref, item); }))`
 * fires N independent network writes. If item 7 of 14 fails mid-batch, 1-6
 * are already committed and 8-14 may or may not be — there is no atomicity.
 * One `update()` call against the parent ref with all keys as fields commits
 * atomically instead.
 */
import { isIdentifierCall, namedImportsFrom, someDescendant } from '../utils.js';

function isPromiseAllCall(node: any): boolean {
  return (
    node?.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.object?.type === 'Identifier' &&
    node.callee.object.name === 'Promise' &&
    node.callee.property?.type === 'Identifier' &&
    node.callee.property.name === 'all'
  );
}

function isMapCall(node: any): boolean {
  return (
    node?.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.property?.type === 'Identifier' &&
    node.callee.property.name === 'map'
  );
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Promise.all over per-item push+set is not atomic',
      category: 'correctness',
      rationale:
        'push() to generate a client-side unique key is correct, but firing one set() per item under Promise.all means N independent network writes. A partial failure mid-batch (permission revoked, connection drop) leaves some items committed and others not, with no atomicity. Building one update() call against the parent ref with all generated keys as fields commits the whole batch atomically instead.',
      docsUrl: 'https://firebase.google.com/docs/database/web/read-and-write',
      recommended: true,
    },
    messages: {
      batchWriteNotAtomic:
        'This batches per-item push()+set() calls under Promise.all, which is not atomic. Build one update() call against the parent ref instead.',
    },
    schema: [],
  },
  create(context: any) {
    let pushLocalName: string | undefined;
    let setLocalName: string | undefined;
    const mapCallsByVarName = new Map<string, any>();

    function isAtomicBatchMapCall(mapCallNode: any): boolean {
      if (!isMapCall(mapCallNode)) return false;
      const callback = mapCallNode.arguments?.[mapCallNode.arguments.length - 1];
      if (!callback) return false;
      const hasPush = someDescendant(callback, (n) => isIdentifierCall(n, pushLocalName));
      const hasSet = someDescendant(callback, (n) => isIdentifierCall(n, setLocalName));
      return hasPush && hasSet;
    }

    return {
      ImportDeclaration(node: any) {
        const imports = namedImportsFrom(node, 'firebase/database');
        if (imports.has('push')) pushLocalName = imports.get('push');
        if (imports.has('set')) setLocalName = imports.get('set');
      },
      VariableDeclarator(node: any) {
        if (node.id?.type === 'Identifier' && isMapCall(node.init)) {
          mapCallsByVarName.set(node.id.name, node.init);
        }
      },
      CallExpression(node: any) {
        if (!isPromiseAllCall(node)) return;
        const arg = node.arguments?.[0];

        // `Promise.all(items.map(...))` — inline.
        if (isAtomicBatchMapCall(arg)) {
          context.report({ node, messageId: 'batchWriteNotAtomic' });
          return;
        }

        // `const writes = items.map(...); Promise.all(writes)` — via a variable.
        if (arg?.type === 'Identifier') {
          const mapCall = mapCallsByVarName.get(arg.name);
          if (mapCall && isAtomicBatchMapCall(mapCall)) {
            context.report({ node, messageId: 'batchWriteNotAtomic' });
          }
        }
      },
    };
  },
};

export const firebaseRtdbBatchWriteNotAtomicRule = rule;
export default rule;
