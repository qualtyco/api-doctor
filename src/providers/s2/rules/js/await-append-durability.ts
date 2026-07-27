/**
 * s2-await-append-durability (reliability)
 *
 * `submit()` resolving means the batch was accepted into the session, not
 * that it is durable — durability is the ticket's `ack()`, and `close()`
 * flushes outstanding batches. Flags appendSession/Producer handles whose
 * submits are never followed by any ack() or a close() on that handle:
 * fire-and-forget writers that can exit before records are durable.
 */
import { createS2FileTracker, memberCallObject, unwrapExpr } from '../../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Awaiting submit() is not durability — await ack() and close the session',
      category: 'reliability',
      rationale:
        'A batch is only durable once acknowledged by S2; the ticket ack() resolves when the batch is fully durable on object storage. Treating submit() as "written" and exiting means in-flight batches can be lost, and skipping close() drops whatever the session had not flushed. Await ack() when durability matters and always await close(), ideally in a finally block.',
      docsUrl: 'https://s2.dev/docs/sdk/appending',
      recommended: true,
    },
    messages: {
      unackedSubmit:
        'Records submitted to this session are never confirmed durable — no ack() is awaited and the session is never close()d. Await the ticket ack() and close the session in a finally block.',
    },
    schema: [],
  },
  create(context: any) {
    const tracker = createS2FileTracker();
    /** session/Producer variable name → first submit call on it. */
    const firstSubmitByVar = new Map<string, any>();
    const writerVars = new Set<string>();
    const closedVars = new Set<string>();
    let ackSeen = false;

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },

      VariableDeclarator(node: any) {
        if (node?.id?.type !== 'Identifier') return;
        let init = unwrapExpr(node.init);
        if (init?.type === 'AwaitExpression') init = unwrapExpr(init.argument);
        if (init?.type === 'CallExpression' && memberCallObject(init, 'appendSession')) {
          writerVars.add(node.id.name);
        }
        if (init?.type === 'NewExpression') {
          const callee = unwrapExpr(init.callee);
          if (callee?.type === 'Identifier' && tracker.localNames('Producer').has(callee.name)) {
            writerVars.add(node.id.name);
          }
        }
      },

      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      CallExpression(node: any) {
        if (memberCallObject(node, 'ack')) {
          ackSeen = true;
          return;
        }
        const closeTarget = unwrapExpr(memberCallObject(node, 'close'));
        if (closeTarget?.type === 'Identifier') {
          closedVars.add(closeTarget.name);
          return;
        }
        const submitTarget = unwrapExpr(memberCallObject(node, 'submit'));
        if (submitTarget?.type === 'Identifier' && writerVars.has(submitTarget.name)) {
          if (!firstSubmitByVar.has(submitTarget.name)) {
            firstSubmitByVar.set(submitTarget.name, node);
          }
        }
      },

      'Program:exit'() {
        if (!tracker.isS2File() || ackSeen) return;
        for (const [varName, submitNode] of firstSubmitByVar) {
          if (!closedVars.has(varName)) {
            context.report({ node: submitNode, messageId: 'unackedSubmit' });
          }
        }
      },
    };
  },
};

export const s2AwaitAppendDurabilityRule = rule;
export default rule;
