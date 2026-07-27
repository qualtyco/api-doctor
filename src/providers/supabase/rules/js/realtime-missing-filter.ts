/**
 * supabase-realtime-missing-filter (reliability)
 *
 * A Realtime `postgres_changes` subscription with no `filter` receives every
 * matching row change on the table for this client. That is often a mistake for
 * per-user feeds (fan-out cost), but can be intentional for admin/global views.
 * Reported as a warning so deliberate whole-table listens are not scored as errors.
 */
import { memberPropName } from '../../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer a filter on Realtime postgres_changes subscriptions (unless whole-table listen is intentional)',
      category: 'reliability',
      rationale:
        'Supabase Realtime postgres_changes lets clients subscribe to INSERT/UPDATE/DELETE on a table. Without filter, this client is notified for every change that RLS allows it to see — fine for a shared board or admin console, expensive for a per-user inbox (every connected user refetches on every write). Docs recommend filter like receiver_id=eq.{id} when the feed is user-scoped. Leave unfiltered only when whole-table listen is deliberate.',
      docsUrl: 'https://supabase.com/docs/guides/realtime/postgres-changes#filtering',
      recommended: true,
    },
    messages: {
      missingFilter:
        'This postgres_changes subscription has no filter — every table row change will notify this client. Add a filter for per-user feeds, or keep unfiltered only if whole-table listen is intentional.',
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
