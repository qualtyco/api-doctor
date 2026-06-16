/**
 * resend-batch-size-not-enforced (reliability)
 *
 * Audit finding F [MEDIUM]: resend.batch.send accepts at most 100 emails per
 * call. Flags `batch.send(<variable>)` when the enclosing function has no
 * `<variable>.length` guard.
 *
 * To avoid false positives on chunking, calls inside a loop are skipped (the
 * loop typically slices the array into <=100-sized chunks). Calls with a
 * literal array argument are also skipped (size is statically known).
 */
import { contains, isResendBatchSendCall, startOffset } from '../utils.js';

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);
const LOOP_TYPES = new Set([
  'ForStatement',
  'ForOfStatement',
  'ForInStatement',
  'WhileStatement',
  'DoWhileStatement',
]);
const COMPARISON_OPERATORS = new Set(['>', '>=', '<', '<=', '===', '!==', '==', '!=']);

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce the 100-email batch limit before calling resend.batch.send',
      category: 'reliability',
      rationale:
        'resend.batch.send accepts at most 100 emails per call. Passing a user- or data-driven array without a length guard means the request fails outright once the list grows past 100, so an entire batch of notifications silently never sends. Guarding the array length (or chunking it into <=100-sized slices) keeps the send reliable as volume scales.',
      docsUrl: 'https://resend.com/docs/api-reference/emails/send-batch-emails',
      recommended: true,
    },
    messages: {
      batchSizeNotEnforced:
        'resend.batch.send has a 100-email limit. Guard the array length (e.g. if (items.length > 100)) before sending.',
    },
    schema: [],
  },
  create(context: any) {
    const functions: any[] = [];
    const loops: any[] = [];
    // name -> list of nodes where `<name>.length` is compared against a number.
    const lengthChecks = new Map<string, any[]>();
    const batchCalls: { node: any; argName: string }[] = [];

    function isLengthOfName(member: any): string | null {
      if (member?.type !== 'MemberExpression') return null;
      if (member.property?.type !== 'Identifier' || member.property.name !== 'length') return null;
      if (member.object?.type !== 'Identifier') return null;
      return member.object.name;
    }

    return {
      FunctionDeclaration(node: any) {
        functions.push(node);
      },
      FunctionExpression(node: any) {
        functions.push(node);
      },
      ArrowFunctionExpression(node: any) {
        functions.push(node);
      },
      ForStatement(node: any) {
        loops.push(node);
      },
      ForOfStatement(node: any) {
        loops.push(node);
      },
      ForInStatement(node: any) {
        loops.push(node);
      },
      WhileStatement(node: any) {
        loops.push(node);
      },
      DoWhileStatement(node: any) {
        loops.push(node);
      },

      BinaryExpression(node: any) {
        if (!COMPARISON_OPERATORS.has(node.operator)) return;
        // Look for `<id>.length <op> <number>` (either side).
        for (const side of [node.left, node.right]) {
          const name = isLengthOfName(side);
          if (name) {
            const list = lengthChecks.get(name) ?? [];
            list.push(node);
            lengthChecks.set(name, list);
          }
        }
      },

      CallExpression(node: any) {
        if (!isResendBatchSendCall(node)) return;
        const arg = node.arguments?.[0];
        if (arg?.type !== 'Identifier') return; // literal arrays / expressions: out of scope
        batchCalls.push({ node, argName: arg.name });
      },

      'Program:exit'() {
        for (const { node, argName } of batchCalls) {
          // Skip calls inside any loop (chunking pattern).
          if (loops.some((loop) => contains(loop, node))) continue;

          // Find the smallest enclosing function for the call.
          const enclosing = functions
            .filter((fn) => contains(fn, node))
            .sort((a, b) => startOffset(b) - startOffset(a))[0];

          // A length check on the same identifier inside the enclosing function counts.
          const checks = lengthChecks.get(argName) ?? [];
          const guarded = enclosing
            ? checks.some((chk) => contains(enclosing, chk))
            : checks.length > 0;

          if (!guarded) {
            context.report({ node, messageId: 'batchSizeNotEnforced' });
          }
        }
      },
    };
  },
};

export const resendBatchSizeNotEnforcedRule = rule;
export default rule;
