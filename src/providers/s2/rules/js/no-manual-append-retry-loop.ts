/**
 * s2-no-manual-append-retry-loop (reliability)
 *
 * The SDK already retries transient failures with exponential backoff and
 * classifies side effects via appendRetryPolicy. A hand-rolled retry —
 * re-appending in a catch block, or an append inside try/catch inside a
 * retry loop whose catch swallows the error — has no side-effect
 * classification and no matchSeqNum, so a lost ack duplicates records.
 * try/catch that *classifies* errors and rethrows (S2's own fencing and
 * timestamping examples) is not a retry and is not flagged.
 */
import { contains, createS2FileTracker, memberCallObject, unwrapExpr } from '../../utils.js';

/** Deep scan for a ThrowStatement anywhere under `node`. */
function containsThrow(node: any): boolean {
  if (!node || typeof node !== 'object') return false;
  if (node.type === 'ThrowStatement') return true;
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const value = (node as any)[key];
    if (Array.isArray(value)) {
      if (value.some((v) => containsThrow(v))) return true;
    } else if (value && typeof value === 'object' && typeof value.type === 'string') {
      if (containsThrow(value)) return true;
    }
  }
  return false;
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not hand-roll retry loops around stream.append; configure client retry instead',
      category: 'reliability',
      rationale:
        'A manual catch-and-append-again loop retries blindly: it cannot know whether the failed append actually landed, so a lost acknowledgement becomes a duplicate record, and it stacks its own backoff on top of the SDK’s built-in exponential backoff. Configure retry on the client (appendRetryPolicy), and use a matchSeqNum precondition or a Producer for exactly-once.',
      docsUrl: 'https://s2.dev/docs/sdk/retries-timeouts',
      recommended: true,
    },
    messages: {
      manualRetry:
        'Hand-rolled append retry duplicates records on a lost ack and double-applies backoff. Configure retry on the S2 client; use matchSeqNum or a Producer for exactly-once.',
    },
    schema: [],
  },
  create(context: any) {
    const tracker = createS2FileTracker();
    const catchBodies: any[] = [];
    const loops: any[] = [];
    /** try-blocks that sit inside a loop and whose catch swallows errors. */
    const retryTryBlocks: any[] = [];
    const candidates: any[] = [];

    function visitLoop(node: any) {
      loops.push(node);
    }

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },

      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      ForStatement: visitLoop,
      WhileStatement: visitLoop,
      DoWhileStatement: visitLoop,

      TryStatement(node: any) {
        if (!node?.handler || !node.block) return;
        if (!loops.some((loop) => contains(loop, node))) return;
        if (containsThrow(node.handler)) return;
        retryTryBlocks.push(node.block);
      },

      CatchClause(node: any) {
        if (node?.body) catchBodies.push(node.body);
      },

      CallExpression(node: any) {
        if (!memberCallObject(node, 'append')) return;
        const first = unwrapExpr(node.arguments?.[0]);
        if (!first || (first.type === 'Literal' && typeof first.value === 'string')) return;
        if (
          catchBodies.some((c) => contains(c, node)) ||
          retryTryBlocks.some((t) => contains(t, node))
        ) {
          candidates.push(node);
        }
      },

      'Program:exit'() {
        if (!tracker.isS2File()) return;
        for (const node of candidates) {
          context.report({ node, messageId: 'manualRetry' });
        }
      },
    };
  },
};

export const s2NoManualAppendRetryLoopRule = rule;
