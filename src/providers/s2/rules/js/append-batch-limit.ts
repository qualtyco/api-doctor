/**
 * s2-append-batch-limit (correctness)
 *
 * A batch can contain at most 1000 records or 1 MiB of data; each append
 * writes exactly one batch, so an oversized AppendInput.create(...) is
 * rejected by the service. Flags statically-knowable oversized batches:
 * array literals over 1000 elements, Array.from({ length: N }) and
 * new Array(N) (plus .fill/.map chains) with N > 1000. Runtime-built arrays
 * are not statically sizable and are left alone.
 */
import { createS2FileTracker, findProperty, memberPropName, unwrapExpr } from '../../utils.js';

const MAX_BATCH_RECORDS = 1000;

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'AppendInput.create batches must stay within 1000 records / 1 MiB',
      category: 'correctness',
      rationale:
        'S2 rejects append batches over 1000 records or 1 MiB, so mapping an unbounded array straight into one AppendInput.create call fails at runtime. Chunk into compliant batches, or use a Producer — its BatchTransform defaults (maxBatchRecords 1000, maxBatchBytes 1 MiB) exist precisely so callers never exceed the limit.',
      docsUrl: 'https://s2.dev/docs/sdk/appending',
      recommended: true,
    },
    messages: {
      batchTooLarge:
        'This batch exceeds the 1000-record limit for a single append. Chunk to <=1000 records / 1 MiB, or use a Producer which batches to the limits automatically.',
    },
    schema: [],
  },
  create(context: any) {
    const tracker = createS2FileTracker();
    const candidates: any[] = [];

    /** Statically-known element count of an array-producing expression, else null. */
    function staticArraySize(expr: any): number | null {
      const n = unwrapExpr(expr);
      if (!n) return null;
      if (n.type === 'ArrayExpression') {
        const elements = n.elements ?? [];
        if (elements.some((el: any) => el?.type === 'SpreadElement')) return null;
        return elements.length;
      }
      if (n.type === 'NewExpression' || n.type === 'CallExpression') {
        const callee = unwrapExpr(n.callee);
        // new Array(N) / Array(N)
        if (callee?.type === 'Identifier' && callee.name === 'Array') {
          const arg = unwrapExpr(n.arguments?.[0]);
          if (n.arguments?.length === 1 && arg?.type === 'Literal' && typeof arg.value === 'number') {
            return arg.value;
          }
          return null;
        }
        if (callee?.type === 'MemberExpression') {
          const prop = memberPropName(callee);
          // Array.from({ length: N }, ...)
          if (prop === 'from' && unwrapExpr(callee.object)?.name === 'Array') {
            const src = unwrapExpr(n.arguments?.[0]);
            const len = src?.type === 'ObjectExpression' ? findProperty(src, 'length') : undefined;
            const lenValue = len ? unwrapExpr(len.value) : undefined;
            if (lenValue?.type === 'Literal' && typeof lenValue.value === 'number') {
              return lenValue.value;
            }
            return null;
          }
          // Size-preserving chain links: new Array(N).fill(x).map(fn)
          if (prop === 'fill' || prop === 'map') return staticArraySize(callee.object);
        }
      }
      return null;
    }

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },

      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      CallExpression(node: any) {
        const callee = unwrapExpr(node?.callee);
        if (callee?.type !== 'MemberExpression' || memberPropName(callee) !== 'create') return;
        const obj = unwrapExpr(callee.object);
        if (obj?.type !== 'Identifier' || !tracker.localNames('AppendInput').has(obj.name)) return;
        const size = staticArraySize(node.arguments?.[0]);
        if (size !== null && size > MAX_BATCH_RECORDS) candidates.push(node);
      },

      'Program:exit'() {
        if (!tracker.isS2File()) return;
        for (const node of candidates) {
          context.report({ node, messageId: 'batchTooLarge' });
        }
      },
    };
  },
};

export const s2AppendBatchLimitRule = rule;
