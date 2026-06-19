/**
 * supabase-order-by-timestamp-not-identity (correctness)
 *
 * `.order("id", ...)` "works" only because a `bigint identity always` PK
 * happens to be monotonic with insert order today — a correctness smell
 * that breaks under any future bulk-insert/backfill/replication scenario.
 * When the same query already selects a purpose-built timestamp column
 * (e.g. `created_at`), that column — not the surrogate key — should drive
 * the ordering.
 *
 * Like scope-queries-by-tenant-column, this walks each query chain
 * bottom-up (`CallExpression:exit`) so the `.select()` that introduced the
 * candidate timestamp column(s) is already recorded by the time the
 * `.order()` built on top of it is visited.
 */
import { chainObjectCall, isTimestampColumnName, memberPropName, parseSelectColumns } from '../utils.js';

interface ChainState {
  timestampColumns: string[];
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Order by a selected timestamp column instead of the identity column',
      category: 'correctness',
      rationale:
        'Ordering by a bigint identity PK only produces correct chronological order because the PK happens to be monotonic with insert order today. That assumption breaks under bulk inserts, backfills, or replication where PK order and time order can diverge. When the query already selects a timestamp column built for this purpose, order by it instead of the surrogate key.',
      docsUrl: 'https://supabase.com/docs/reference/javascript/order',
      recommended: true,
    },
    messages: {
      orderByIdentity:
        'This query selects "{{column}}" but orders by "id" instead. Order by "{{column}}" so result order does not depend on PK/insert-order coincidence.',
    },
    schema: [],
  },
  create(context: any) {
    const chainStates = new Map<any, ChainState>();

    return {
      'CallExpression:exit'(node: any) {
        const prop = memberPropName(node);
        if (!prop) return;

        const objCall = chainObjectCall(node);

        if (prop === 'select' && objCall && memberPropName(objCall) === 'from') {
          const columns = parseSelectColumns(node.arguments?.[0]);
          const timestampColumns = columns.filter(isTimestampColumnName);
          chainStates.set(node, { timestampColumns });
          return;
        }

        const state = objCall ? chainStates.get(objCall) : undefined;
        if (!state) return;

        if (prop === 'order') {
          const colArg = node.arguments?.[0];
          const orderColumn = colArg?.type === 'Literal' ? colArg.value : undefined;
          if (
            typeof orderColumn === 'string' &&
            orderColumn.toLowerCase() === 'id' &&
            state.timestampColumns.length > 0
          ) {
            context.report({
              node,
              messageId: 'orderByIdentity',
              data: { column: state.timestampColumns[0] },
            });
          }
        }

        chainStates.set(node, state);
      },
    };
  },
};

export const supabaseOrderByTimestampNotIdentityRule = rule;
export default rule;
