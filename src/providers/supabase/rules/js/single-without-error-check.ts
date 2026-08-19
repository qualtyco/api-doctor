/**
 * supabase-single-without-error-check (correctness)
 *
 * `.single()` returns `{ data, error }` — zero or multiple rows set `error`
 * (PGRST116) without throwing. Ignoring `error` leaves the UI stuck loading.
 *
 * Handled shapes that must NOT flag: a destructured `error` binding, a
 * whole-result binding whose `.error` is read later, and chains ending in
 * `.throwOnError()` (documented opt-in to exceptions).
 */
import { chainHasMethod, destructuresKey, callPropName } from '../../utils.js';

function isSingleSupabaseQuery(awaitArg: any): boolean {
  return awaitArg?.type === 'CallExpression' && chainHasMethod(awaitArg, 'single');
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Supabase .single() calls must inspect the returned error field',
      category: 'correctness',
      rationale:
        '.single() signals zero-or-one-row intent via the error field (PGRST116), not by leaving data undefined silently. Destructuring only data and never reading error produces infinite spinners on deleted rows, bad IDs, or RLS-denied reads. Prefer .maybeSingle() or branch on error before rendering. Chains ending in .throwOnError() opt into exceptions instead and are exempt.',
      docsUrl: 'https://supabase.com/docs/reference/javascript/single',
      recommended: true,
    },
    messages: {
      missingErrorCheck:
        'This .single() result ignores error — a missing or denied row will look like a perpetual load. Destructure error or use .maybeSingle().',
    },
    schema: [],
  },
  create(context: any) {
    // Whole-result bindings (`const result = await ...single()`) are only a
    // problem if `result.error` is never read — collect reads, decide at exit.
    const deferredBindings: Array<{ node: any; name: string }> = [];
    const errorReadNames = new Set<string>();

    function checkAwaitBinding(node: any, pattern: any, awaitExpr: any) {
      if (!isSingleSupabaseQuery(awaitExpr.argument)) return;
      if (chainHasMethod(awaitExpr.argument, 'throwOnError')) return;
      if (pattern?.type === 'Identifier') {
        deferredBindings.push({ node, name: pattern.name });
        return;
      }
      if (destructuresKey(pattern, 'error')) return;
      context.report({ node, messageId: 'missingErrorCheck' });
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
      VariableDeclarator(node: any) {
        // `const { error } = result;` — result object destructured after the fact
        if (node.init?.type === 'Identifier' && node.id?.type === 'ObjectPattern') {
          if (destructuresKey(node.id, 'error')) errorReadNames.add(node.init.name);
        }
        if (node.init?.type !== 'AwaitExpression') return;
        checkAwaitBinding(node, node.id, node.init);
      },
      AssignmentExpression(node: any) {
        if (node.right?.type !== 'AwaitExpression') return;
        checkAwaitBinding(node, node.left, node.right);
      },
      ExpressionStatement(node: any) {
        const expr = node.expression;
        if (expr?.type !== 'AwaitExpression') return;
        if (!isSingleSupabaseQuery(expr.argument)) return;
        if (chainHasMethod(expr.argument, 'throwOnError')) return;
        if (callPropName(expr.argument) === 'single') {
          context.report({ node, messageId: 'missingErrorCheck' });
        }
      },
      'Program:exit'() {
        for (const { node, name } of deferredBindings) {
          if (!errorReadNames.has(name)) {
            context.report({ node, messageId: 'missingErrorCheck' });
          }
        }
      },
    };
  },
};

export const supabaseSingleWithoutErrorCheckRule = rule;
