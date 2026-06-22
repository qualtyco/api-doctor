/**
 * supabase-realtime-missing-filter (reliability)
 *
 * A Realtime `postgres_changes` subscription on a whole table (no `filter`)
 * refetches for every row change app-wide — O(active users) fan-out per write.
 */
import { memberPropName } from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Supabase Realtime postgres_changes subscriptions should use a filter',
      category: 'reliability',
      rationale:
        'Listening to postgres_changes on an entire table without a filter means every insert/update/delete by any user triggers the callback on every connected client. RLS still scopes the data, but the refetch storm scales with concurrent users and will degrade under real load. Scope subscriptions with the documented filter option (e.g. receiver_id=eq.{id}).',
      docsUrl: 'https://supabase.com/docs/guides/realtime/postgres-changes#filtering',
      recommended: true,
    },
    messages: {
      missingFilter:
        'This Realtime postgres_changes subscription has no filter and will fire on every row change in the table.',
    },
    schema: [],
  },
  create(context: any) {
    return {
      CallExpression(node: any) {
        if (memberPropName(node) !== 'on') return;
        const eventArg = node.arguments?.[0];
        if (eventArg?.type !== 'Literal' || eventArg.value !== 'postgres_changes') return;

        const options = node.arguments?.[1];
        if (options?.type !== 'ObjectExpression') return;

        const hasFilter = (options.properties ?? []).some((p: any) => {
          if (p?.type !== 'Property') return false;
          const key =
            p.key?.type === 'Identifier'
              ? p.key.name
              : p.key?.type === 'Literal'
                ? p.key.value
                : undefined;
          return key === 'filter';
        });

        if (!hasFilter) {
          context.report({ node, messageId: 'missingFilter' });
        }
      },
    };
  },
};

export const supabaseRealtimeMissingFilterRule = rule;
export default rule;
