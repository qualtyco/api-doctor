/**
 * s2-append-session-for-streams (reliability)
 *
 * Firing unary stream.append() per element — via Promise.all(...map(...)),
 * forEach, or a for-of loop — makes each append independent: cross-batch
 * ordering is not guaranteed, and each client is limited to 200 append
 * batches per second (429 + Retry-After instead of backpressure). Flags
 * unary appends inside collection iteration; an appendSession()/Producer
 * (which pipelines via .submit) is the documented steady-stream writer.
 */
import { contains, createS2FileTracker, memberCallObject, memberPropName, unwrapExpr } from '../utils.js';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Steady streams of writes need an append session or Producer, not per-element unary appends',
      category: 'reliability',
      rationale:
        'Multiple concurrent single-batch appends are independent: the order in which they become durable is not guaranteed, which silently shuffles event streams. Each client is also limited to 200 append batches per second, so per-element appends turn bursts into 429 errors instead of backpressure. One appendSession() or Producer pipelines the batches, preserves order, and applies backpressure.',
      docsUrl: 'https://s2.dev/docs/sdk/appending',
      recommended: true,
    },
    messages: {
      useAppendSession:
        'Unary append per element loses cross-batch ordering and hits the 200 batches/sec limit. Open one appendSession() or Producer and submit records through it.',
    },
    schema: [],
  },
  create(context: any) {
    const tracker = createS2FileTracker();
    /** Ranges of collection-iteration containers (for-of/for-in bodies, map/forEach callbacks). */
    const containers: any[] = [];
    const candidates: any[] = [];

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },

      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      ForOfStatement(node: any) {
        if (node?.body) containers.push(node.body);
      },

      ForInStatement(node: any) {
        if (node?.body) containers.push(node.body);
      },

      CallExpression(node: any) {
        const callee = unwrapExpr(node?.callee);
        const prop = memberPropName(callee);
        if (prop === 'map' || prop === 'forEach' || prop === 'flatMap') {
          for (const arg of node.arguments ?? []) {
            const fn = unwrapExpr(arg);
            if (fn?.type === 'ArrowFunctionExpression' || fn?.type === 'FunctionExpression') {
              containers.push(fn);
            }
          }
          return;
        }

        if (!memberCallObject(node, 'append')) return;
        // Same non-S2-shape filter as append-retry-duplicates: DOM append
        // takes element/string args, S2 append takes an AppendInput.
        const first = unwrapExpr(node.arguments?.[0]);
        if (!first || (first.type === 'Literal' && typeof first.value === 'string')) return;
        if (containers.some((c) => contains(c, node))) candidates.push(node);
      },

      'Program:exit'() {
        if (!tracker.isS2File()) return;
        for (const node of candidates) {
          context.report({ node, messageId: 'useAppendSession' });
        }
      },
    };
  },
};

export const s2AppendSessionForStreamsRule = rule;
export default rule;
