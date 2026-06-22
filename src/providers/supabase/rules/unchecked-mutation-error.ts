/**
 * supabase-unchecked-mutation-error (correctness)
 *
 * Supabase insert/update/delete resolve to `{ data, error }` — RLS and
 * constraint failures land in `error`, not as thrown exceptions.
 */
import { destructuredNames, isSupabaseMutationKind } from '../utils.js';

const MUTATIONS = ['insert', 'update', 'delete', 'upsert'] as const;

function isSupabaseMutationCall(node: any): boolean {
  return MUTATIONS.some((kind) => isSupabaseMutationKind(node, kind));
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Supabase mutations must check the returned error field',
      category: 'correctness',
      rationale:
        'Unlike fetch(), Supabase client mutations return { data, error } and resolve even when RLS denies the write or a constraint fails. Fire-and-forget awaits or destructuring only data lets optimistic UI state diverge from the database with no toast or rollback.',
      docsUrl: 'https://supabase.com/docs/reference/javascript/insert',
      recommended: true,
    },
    messages: {
      uncheckedMutation:
        'This Supabase mutation never checks error — RLS denials and constraint failures will be silent.',
    },
    schema: [],
  },
  create(context: any) {
    function checkMutationAwait(node: any, pattern: any | undefined, awaitExpr: any) {
      if (!isSupabaseMutationCall(awaitExpr.argument)) return;
      if (!pattern) {
        context.report({ node, messageId: 'uncheckedMutation' });
        return;
      }
      const names = destructuredNames(pattern);
      if (!names.has('error')) {
        context.report({ node, messageId: 'uncheckedMutation' });
      }
    }

    return {
      ExpressionStatement(node: any) {
        const expr = node.expression;
        if (expr?.type !== 'AwaitExpression') return;
        checkMutationAwait(node, undefined, expr);
      },
      VariableDeclarator(node: any) {
        if (node.init?.type !== 'AwaitExpression') return;
        checkMutationAwait(node, node.id, node.init);
      },
      AssignmentExpression(node: any) {
        if (node.right?.type !== 'AwaitExpression') return;
        checkMutationAwait(node, node.left, node.right);
      },
    };
  },
};

export const supabaseUncheckedMutationErrorRule = rule;
export default rule;
