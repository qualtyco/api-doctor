/**
 * s2-tail-offset-clamp (reliability, advisory)
 *
 * On a stream shorter than N records, `tailOffset: N` refers to a position
 * before the stream's start and can error instead of clamping to seqNum 0.
 * Every runnable S2 example that uses a tail offset adds `clamp: true`;
 * the reading.md doc snippet omits it, so this rule is advisory by design
 * (it fires on the provider's own docs example, annotated as expected).
 * tailOffset: 0 is the tail itself — never before the start — and is skipped.
 */
import { createS2FileTracker, findProperty, unwrapExpr } from '../../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'tailOffset reads should set clamp: true for streams shorter than the offset',
      category: 'reliability',
      rationale:
        'A tail offset larger than the stream length points before the first record, which errors rather than clamping to the start. S2’s own runnable examples defensively pair every tailOffset with clamp: true. Without it, "read the last N records" works in testing and fails on fresh or trimmed streams.',
      docsUrl: 'https://s2.dev/docs/sdk/reading',
      recommended: true,
    },
    messages: {
      missingClamp:
        'tailOffset without clamp: true errors when the stream has fewer records than the offset. Use start: { from: { tailOffset: N }, clamp: true }.',
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

      ObjectExpression(node: any) {
        // The start object: { from: { tailOffset: N }, clamp: true }.
        const from = findProperty(node, 'from');
        if (!from) return;
        const fromValue = unwrapExpr(from.value);
        const tailOffset = findProperty(fromValue, 'tailOffset');
        if (!tailOffset) return;
        const offsetValue = unwrapExpr(tailOffset.value);
        // Offset 0 is the tail itself; it can never precede the stream start.
        if (offsetValue?.type === 'Literal' && offsetValue.value === 0) return;
        if (findProperty(node, 'clamp')) return;
        candidates.push(from);
      },

      'Program:exit'() {
        if (!tracker.isS2File()) return;
        for (const node of candidates) {
          context.report({ node, messageId: 'missingClamp' });
        }
      },
    };
  },
};

export const s2TailOffsetClampRule = rule;
