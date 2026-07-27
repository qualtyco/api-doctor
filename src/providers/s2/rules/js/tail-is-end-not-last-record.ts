/**
 * s2-tail-is-end-not-last-record (correctness)
 *
 * The tail is the stream's end position, not the last existing record —
 * reading from `tailOffset: 0` means "start after all current records".
 * Flags bounded reads at the tail that expect existing data: a unary
 * read({ tailOffset: 0 }) without a wait, and a readSession at the tail
 * with `stop: { waitSecs: 0 }` (return once caught up — i.e. immediately,
 * empty). A tailOffset: 0 session with no stop is a legitimate live
 * follower and is not flagged.
 */
import { createS2FileTracker, findProperty, memberCallObject, unwrapExpr } from '../../utils.js';

/** Deep-search object-literal args for a property named `name`; returns it. */
function findPropertyDeep(root: any, name: string): any | undefined {
  const stack = [unwrapExpr(root)];
  while (stack.length) {
    const n = stack.pop();
    if (n?.type !== 'ObjectExpression') continue;
    const hit = findProperty(n, name);
    if (hit) return hit;
    for (const p of n.properties ?? []) {
      if (p?.type === 'Property') stack.push(unwrapExpr(p.value));
    }
  }
  return undefined;
}

function literalValue(prop: any): unknown {
  const v = prop ? unwrapExpr(prop.value) : undefined;
  return v?.type === 'Literal' ? v.value : undefined;
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Reading from the tail yields no existing records — the tail is the end position',
      category: 'correctness',
      rationale:
        'checkTail()/tailOffset: 0 point one past the last record, so a bounded read there returns nothing until new records arrive. To fetch the last N existing records use tailOffset: N with clamp: true; to receive future records use a follow session or a wait. Expecting "the latest record" at the tail is a silent empty result, not an error.',
      docsUrl: 'https://s2.dev/docs/sdk/reading',
      recommended: true,
    },
    messages: {
      tailIsEnd:
        'This bounded read starts at the tail (tailOffset: 0), which is *after* all existing records — it returns nothing. Use tailOffset: N (with clamp: true) for the last N records, or follow/wait for future ones.',
    },
    schema: [],
  },
  create(context: any) {
    const tracker = createS2FileTracker();
    const candidates: any[] = [];

    function startsAtTail(callNode: any): boolean {
      const arg = unwrapExpr(callNode.arguments?.[0]);
      if (arg?.type !== 'ObjectExpression') return false;
      const start = findProperty(arg, 'start');
      const from = start ? findPropertyDeep(start.value, 'from') : undefined;
      const tailOffset = from ? findProperty(unwrapExpr(from.value), 'tailOffset') : undefined;
      return tailOffset !== undefined && literalValue(tailOffset) === 0;
    }

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },

      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      CallExpression(node: any) {
        if (memberCallObject(node, 'read')) {
          if (!startsAtTail(node)) return;
          // A wait/waitSecs anywhere in the args is a long-poll for future
          // records — the documented correct use of reading at the tail.
          const waits = node.arguments?.some(
            (a: any) => findPropertyDeep(a, 'wait') || findPropertyDeep(a, 'waitSecs'),
          );
          if (!waits) candidates.push(node);
          return;
        }

        if (memberCallObject(node, 'readSession')) {
          if (!startsAtTail(node)) return;
          const arg = unwrapExpr(node.arguments?.[0]);
          const stop = arg?.type === 'ObjectExpression' ? findProperty(arg, 'stop') : undefined;
          if (!stop) return; // no stop → live follower, legitimate
          const waitSecs = findPropertyDeep(stop.value, 'waitSecs');
          if (waitSecs && literalValue(waitSecs) === 0) candidates.push(node);
        }
      },

      'Program:exit'() {
        if (!tracker.isS2File()) return;
        for (const node of candidates) {
          context.report({ node, messageId: 'tailIsEnd' });
        }
      },
    };
  },
};

export const s2TailIsEndNotLastRecordRule = rule;
export default rule;
