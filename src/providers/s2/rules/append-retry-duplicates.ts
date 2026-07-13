/**
 * s2-append-retry-duplicates (reliability)
 *
 * With appendRetryPolicy "all", a unary stream.append() whose acknowledgement
 * is lost gets retried even though the write may have landed — duplicating
 * records. Flags unary appends in files that explicitly opt into "all" and
 * carry no matchSeqNum precondition. Producer / append-session writers are
 * exempt: they track matchSeqNum across batches, which is exactly why S2's
 * own Producer example sets "all" (a retried batch is rejected as a
 * precondition mismatch instead of duplicated).
 */
import { createS2FileTracker, findProperty, memberCallObject, unwrapExpr } from '../utils.js';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Unary stream.append with appendRetryPolicy "all" duplicates records on a lost acknowledgement',
      category: 'reliability',
      cwe: 'CWE-694',
      rationale:
        'If an append succeeds but the acknowledgement is lost to a network timeout, retrying creates duplicate records in the stream. The default and explicit "all" policy retries every failed append, so ledgers, event sourcing, and dedup-sensitive feeds silently corrupt. Unary appends under "all" need a matchSeqNum precondition, the "noSideEffects" policy, or a Producer/append session (which maintains matchSeqNum itself).',
      docsUrl: 'https://s2.dev/docs/sdk/retries-timeouts',
      recommended: true,
    },
    messages: {
      duplicateOnRetry:
        'Unary append under appendRetryPolicy "all" can write duplicate records when an ack is lost. Add a matchSeqNum precondition, switch to "noSideEffects", or use a Producer/append session.',
    },
    schema: [],
  },
  create(context: any) {
    const tracker = createS2FileTracker();
    let policyAllSeen = false;
    const unguardedAppends: any[] = [];

    /** True when any object argument (or an inner AppendInput.create options
     *  object) carries a matchSeqNum precondition. */
    function hasMatchSeqNum(callNode: any): boolean {
      const stack = [...(callNode?.arguments ?? [])];
      while (stack.length) {
        const arg = unwrapExpr(stack.pop());
        if (!arg) continue;
        if (arg.type === 'ObjectExpression' && findProperty(arg, 'matchSeqNum')) return true;
        if (arg.type === 'CallExpression') stack.push(...(arg.arguments ?? []));
      }
      return false;
    }

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },

      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      Property(node: any) {
        const isPolicyKey =
          (node?.key?.type === 'Identifier' && !node.computed && node.key.name === 'appendRetryPolicy') ||
          (node?.key?.type === 'Literal' && node.key.value === 'appendRetryPolicy');
        if (!isPolicyKey) return;
        const value = unwrapExpr(node.value);
        if (value?.type === 'Literal' && value.value === 'all') policyAllSeen = true;
      },

      CallExpression(node: any) {
        // Unary `<stream>.append(...)`; session/Producer writers go through
        // `.submit(...)` and are intentionally not matched here.
        if (!memberCallObject(node, 'append')) return;
        // DOM `parent.append(el)` takes element/string args; S2 appends take
        // an AppendInput (a call or identifier). Skip obvious non-S2 shapes.
        const first = unwrapExpr(node.arguments?.[0]);
        if (!first || (first.type === 'Literal' && typeof first.value === 'string')) return;
        if (!hasMatchSeqNum(node)) unguardedAppends.push(node);
      },

      'Program:exit'() {
        if (!tracker.isS2File() || !policyAllSeen) return;
        for (const node of unguardedAppends) {
          context.report({ node, messageId: 'duplicateOnRetry' });
        }
      },
    };
  },
};

export const s2AppendRetryDuplicatesRule = rule;
export default rule;
