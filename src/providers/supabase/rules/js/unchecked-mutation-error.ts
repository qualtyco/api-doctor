/**
 * supabase-unchecked-mutation-error (correctness)
 *
 * Supabase insert/update/delete resolve to `{ data, error }` — RLS and
 * constraint failures land in `error`, not as thrown exceptions.
 *
 * Handled shapes that must NOT flag:
 *   - a destructured `error` binding (`const { error } = await ...`)
 *   - a whole-result binding whose `.error` is read later (`const res = await ...;
 *     if (res.error) ...`, or `const { error } = res` afterwards)
 *   - a chain ending in `.throwOnError()` (documented opt-in to exceptions)
 */
import { chainHasMethod, destructuresKey, isSupabaseMutationKind } from '../../utils.js';

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
        'Unlike fetch(), Supabase client mutations return { data, error } and resolve even when RLS denies the write or a constraint fails. Fire-and-forget awaits or destructuring only data lets optimistic UI state diverge from the database with no toast or rollback. Chains ending in .throwOnError() opt into exceptions instead and are exempt.',
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
    // Whole-result bindings (`const res = await ...`) are only a problem if
    // `res.error` is never read — collect reads file-wide, decide at exit.
    const deferredBindings: Array<{ node: any; name: string }> = [];
    const errorReadNames = new Set<string>();

    function checkMutationAwait(node: any, pattern: any | undefined, awaitExpr: any) {
      if (!isSupabaseMutationCall(awaitExpr.argument)) return;
      if (chainHasMethod(awaitExpr.argument, 'throwOnError')) return;
      if (!pattern) {
        context.report({ node, messageId: 'uncheckedMutation' });
        return;
      }
      if (pattern.type === 'Identifier') {
        deferredBindings.push({ node, name: pattern.name });
        return;
      }
      if (!destructuresKey(pattern, 'error')) {
        context.report({ node, messageId: 'uncheckedMutation' });
      }
    }

    return {
      MemberExpression(node: any) {
        if (
          !node.computed &&
          node.object?.type === 'Identifier' &&
          node.property?.type === 'Identifier' &&
          node.property.name === 'error'
        ) {
          errorReadNames.add(node.object.name);
        }
      },
      ExpressionStatement(node: any) {
        const expr = node.expression;
        if (expr?.type !== 'AwaitExpression') return;
        checkMutationAwait(node, undefined, expr);
      },
      VariableDeclarator(node: any) {
        // `const { error } = res;` — result object destructured after the fact
        if (node.init?.type === 'Identifier' && node.id?.type === 'ObjectPattern') {
          if (destructuresKey(node.id, 'error')) errorReadNames.add(node.init.name);
        }
        if (node.init?.type !== 'AwaitExpression') return;
        checkMutationAwait(node, node.id, node.init);
      },
      AssignmentExpression(node: any) {
        if (node.right?.type !== 'AwaitExpression') return;
        checkMutationAwait(node, node.left, node.right);
      },
      'Program:exit'() {
        for (const { node, name } of deferredBindings) {
          if (!errorReadNames.has(name)) {
            context.report({ node, messageId: 'uncheckedMutation' });
          }
        }
      },
    };
  },
};

export const supabaseUncheckedMutationErrorRule = rule;
export default rule;
