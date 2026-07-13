/**
 * s2-single-read-is-capped (correctness)
 *
 * A single-batch read returns at most one batch: up to 1000 records or
 * 1 MiB. Flags unary `stream.read({ start: { from: { seqNum: 0 } } })` —
 * "read the whole stream from the beginning" — because everything past the
 * first batch is silently dropped. Reading from a runtime coordinate
 * (paging, ack read-back) or iterating a readSession is not flagged.
 * Advisory by design: it also fires on deliberately capped reads from 0,
 * nudging toward an explicit readSession for history.
 */
import { createS2FileTracker, findProperty, memberCallObject, unwrapExpr } from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'A single read returns at most one batch — not the whole stream',
      category: 'correctness',
      rationale:
        'Single-batch reads are capped at 1000 records / 1 MiB, so treating the result of one read from seqNum 0 as the full history silently drops everything past the first batch once the stream grows. Iterate a readSession (with stop: { waitSecs: 0 } for a bounded catch-up) or page by advancing start.from.seqNum.',
      docsUrl: 'https://s2.dev/docs/sdk/reading',
      recommended: true,
    },
    messages: {
      cappedRead:
        'This single read from seqNum 0 returns at most 1000 records / 1 MiB, not the whole stream. Iterate a readSession or page past the last returned record.',
    },
    schema: [],
  },
  create(context: any) {
    const tracker = createS2FileTracker();
    const candidates: any[] = [];

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },

      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      CallExpression(node: any) {
        if (!memberCallObject(node, 'read')) return;
        const arg = unwrapExpr(node.arguments?.[0]);
        if (arg?.type !== 'ObjectExpression') return;
        const start = findProperty(arg, 'start');
        const startValue = start ? unwrapExpr(start.value) : undefined;
        const from = startValue ? findProperty(startValue, 'from') : undefined;
        const seqNum = from ? findProperty(unwrapExpr(from.value), 'seqNum') : undefined;
        const seqValue = seqNum ? unwrapExpr(seqNum.value) : undefined;
        if (seqValue?.type === 'Literal' && seqValue.value === 0) candidates.push(node);
      },

      'Program:exit'() {
        if (!tracker.isS2File()) return;
        for (const node of candidates) {
          context.report({ node, messageId: 'cappedRead' });
        }
      },
    };
  },
};

export const s2SingleReadIsCappedRule = rule;
export default rule;
