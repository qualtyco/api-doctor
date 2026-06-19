/**
 * supabase-scope-queries-by-tenant-column (correctness)
 *
 * A `.from(table).select(...)` query that selects a tenant/ownership-style
 * column (e.g. `session_id`, `user_id`) but never filters by it (`.eq()`,
 * `.match()`, `.filter()`) reads every row across every tenant instead of
 * scoping to the caller's own data.
 *
 * Detection walks each query chain bottom-up (`CallExpression:exit`, so
 * inner calls are visited before the calls built on top of them) and
 * threads a shared chain-state object outward through `chainObjectCall`,
 * so a `.eq()` two links up the chain is still recorded against the
 * `.select()` that introduced the tenant column.
 */
import { chainObjectCall, isTenantColumnName, memberPropName, parseSelectColumns } from '../utils.js';

interface ChainState {
  selectNode: any;
  tenantColumns: string[];
  filteredColumns: Set<string>;
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Supabase queries that select a tenant column must filter by it',
      category: 'correctness',
      rationale:
        'A column like session_id or user_id existing in the schema (and being selected) signals intent to scope rows to one caller, but selecting it is not the same as filtering by it. Without an .eq()/.match()/.filter() on that column, the query returns every row for every tenant, turning a per-user feed into a single shared, cross-user one.',
      docsUrl: 'https://supabase.com/docs/reference/javascript/eq',
      recommended: true,
    },
    messages: {
      missingTenantFilter:
        'This query selects "{{column}}" but never filters by it. Add .eq("{{column}}", ...) (or .match()/.filter()) to scope results to the caller.',
    },
    schema: [],
  },
  create(context: any) {
    const chainStates = new Map<any, ChainState>();
    const selectStates: ChainState[] = [];

    function recordFilteredColumn(state: ChainState, name: unknown) {
      if (typeof name === 'string') state.filteredColumns.add(name);
      else state.filteredColumns.add('*');
    }

    return {
      'CallExpression:exit'(node: any) {
        const prop = memberPropName(node);
        if (!prop) return;

        const objCall = chainObjectCall(node);

        if (prop === 'select' && objCall && memberPropName(objCall) === 'from') {
          const columns = parseSelectColumns(node.arguments?.[0]);
          const tenantColumns = columns.filter(isTenantColumnName);
          if (tenantColumns.length === 0) return;
          const state: ChainState = { selectNode: node, tenantColumns, filteredColumns: new Set() };
          chainStates.set(node, state);
          selectStates.push(state);
          return;
        }

        const state = objCall ? chainStates.get(objCall) : undefined;
        if (!state) return;

        if (prop === 'eq' || prop === 'filter') {
          const colArg = node.arguments?.[0];
          recordFilteredColumn(state, colArg?.type === 'Literal' ? colArg.value : undefined);
        } else if (prop === 'match') {
          const objArg = node.arguments?.[0];
          if (objArg?.type === 'ObjectExpression') {
            for (const p of objArg.properties ?? []) {
              if (p?.type !== 'Property') continue;
              const name =
                p.key?.type === 'Identifier'
                  ? p.key.name
                  : p.key?.type === 'Literal'
                    ? p.key.value
                    : undefined;
              recordFilteredColumn(state, name);
            }
          } else {
            recordFilteredColumn(state, undefined);
          }
        }

        chainStates.set(node, state);
      },

      'Program:exit'() {
        for (const state of selectStates) {
          if (state.filteredColumns.has('*')) continue;
          const missing = state.tenantColumns.find((c) => !state.filteredColumns.has(c));
          if (missing) {
            context.report({
              node: state.selectNode,
              messageId: 'missingTenantFilter',
              data: { column: missing },
            });
          }
        }
      },
    };
  },
};

export const supabaseScopeQueriesByTenantColumnRule = rule;
export default rule;
