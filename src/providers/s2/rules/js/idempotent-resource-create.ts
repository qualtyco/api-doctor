/**
 * s2-idempotent-resource-create (reliability)
 *
 * Re-creating an existing basin/stream returns HTTP 409, so a bare
 * `await basin.streams.create(...)` throws on the second run or under a
 * concurrent creator — crashing startup or the request. Flags
 * `.streams.create(...)` / `.basins.create(...)` calls with no error
 * handling: neither a chained .catch()/.then(_, onError) nor an enclosing
 * try/catch. Every official S2 example that creates a resource swallows
 * the 409 and rethrows everything else.
 */
import { contains, createS2FileTracker, endOffset, memberCallObject, memberPropName, startOffset, unwrapExpr } from '../../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Basin/stream create calls need 409 (already exists) handling',
      category: 'reliability',
      rationale:
        'Creating a resource that already exists returns HTTP 409, so create-if-absent code that does not catch it works exactly once: the next deploy, restart, or concurrent creator crashes. Catch S2Error status 409 and rethrow anything else (or use the REST PUT ensure semantics) to make provisioning idempotent.',
      docsUrl: 'https://s2.dev/docs/sdk/stream-resources',
      recommended: true,
    },
    messages: {
      unhandled409:
        'This create throws HTTP 409 once the resource exists. Handle it, e.g. .catch(err => { if (!(err instanceof S2Error && err.status === 409)) throw err; }).',
    },
    schema: [],
  },
  create(context: any) {
    const tracker = createS2FileTracker();
    /** (start,end) keys of call expressions that have a .catch/.then handler chained. */
    const handledCallKeys = new Set<string>();
    const tryBlocks: any[] = [];
    const createCalls: any[] = [];

    function rangeKey(n: any): string {
      return `${startOffset(n)}:${endOffset(n)}`;
    }

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },

      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      TryStatement(node: any) {
        if (node?.handler && node.block) tryBlocks.push(node.block);
      },

      CallExpression(node: any) {
        const callee = unwrapExpr(node?.callee);
        const prop = memberPropName(callee);
        if (prop === 'catch' || (prop === 'then' && (node.arguments ?? []).length >= 2)) {
          const target = unwrapExpr(callee.object);
          if (target) handledCallKeys.add(rangeKey(target));
        }

        const holder = unwrapExpr(memberCallObject(node, 'create'));
        const holderProp = memberPropName(holder);
        if (holderProp === 'streams' || holderProp === 'basins') createCalls.push(node);
      },

      'Program:exit'() {
        if (!tracker.isS2File()) return;
        for (const node of createCalls) {
          if (handledCallKeys.has(rangeKey(node))) continue;
          if (tryBlocks.some((block) => contains(block, node))) continue;
          context.report({ node, messageId: 'unhandled409' });
        }
      },
    };
  },
};

export const s2IdempotentResourceCreateRule = rule;
export default rule;
