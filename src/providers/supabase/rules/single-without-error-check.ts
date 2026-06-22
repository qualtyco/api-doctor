/**
 * supabase-single-without-error-check (correctness)
 *
 * `.single()` returns `{ data, error }` — zero or multiple rows set `error`
 * (PGRST116) without throwing. Ignoring `error` leaves the UI stuck loading.
 */
import { chainHasMethod, destructuredNames, memberPropName } from '../utils.js';

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
        '.single() signals zero-or-one-row intent via the error field (PGRST116), not by leaving data undefined silently. Destructuring only data and never reading error produces infinite spinners on deleted rows, bad IDs, or RLS-denied reads. Prefer .maybeSingle() or branch on error before rendering.',
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
    function checkAwaitBinding(node: any, pattern: any, awaitExpr: any) {
      if (!isSingleSupabaseQuery(awaitExpr.argument)) return;
      const names = destructuredNames(pattern);
      if (names.has('error')) return;
      context.report({ node, messageId: 'missingErrorCheck' });
    }

    return {
      VariableDeclarator(node: any) {
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
        if (memberPropName(expr.argument) === 'single') {
          context.report({ node, messageId: 'missingErrorCheck' });
        }
      },
    };
  },
};

export const supabaseSingleWithoutErrorCheckRule = rule;
export default rule;
