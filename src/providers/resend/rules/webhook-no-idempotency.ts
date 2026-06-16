/**
 * resend-webhook-no-idempotency (reliability)
 *
 * Not from the audit — from the v1 plan. Resend retries failed webhooks for up
 * to 24 hours, so handlers must deduplicate events. A file is treated as a
 * Resend webhook handler only when it imports `svix` (Resend's webhook
 * verification library) and exports a POST handler. The handler is flagged when
 * it contains no deduplication signal:
 *   - new Map() / new Set()
 *   - a call on a store-like object (redis, kv, db, prisma, supabase, cache)
 *   - a dedup method (has/add/sadd/sismember/exists/findUnique/findFirst/upsert)
 *   - a reference to an event id (e.g. event.data.email_id)
 */
import { endOffset, startOffset } from '../utils.js';

const DEDUP_OBJECTS = new Set(['redis', 'kv', 'db', 'prisma', 'supabase', 'cache', 'store']);
const DEDUP_METHODS = new Set([
  'has',
  'add',
  'sadd',
  'sismember',
  'exists',
  'findUnique',
  'findFirst',
  'upsert',
]);
const EVENT_ID_PROPS = new Set(['email_id', 'eventId', 'event_id']);

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Resend webhook handlers should deduplicate retried events',
      category: 'reliability',
      rationale:
        'Resend retries failed webhook deliveries for up to 24 hours, so the same event can legitimately arrive more than once. A handler that acts on every delivery without deduplication will double-process events — sending duplicate downstream notifications, double-counting metrics, or corrupting state. Tracking processed event ids (e.g. event.data.email_id) in a store or set and skipping ones already seen makes the handler safely idempotent.',
      docsUrl: 'https://resend.com/docs/dashboard/webhooks/introduction',
      recommended: true,
    },
    messages: {
      noIdempotency:
        'Resend webhook handler has no deduplication. Resend retries for 24h; track processed event ids.',
    },
    schema: [],
  },
  create(context: any) {
    let importsSvix = false;
    const postHandlers: any[] = [];
    const dedupSignals: any[] = [];

    function collectPostHandler(decl: any): void {
      if (!decl) return;
      if (decl.type === 'FunctionDeclaration' && decl.id?.name === 'POST') {
        postHandlers.push(decl);
        return;
      }
      if (decl.type === 'VariableDeclaration') {
        for (const d of decl.declarations ?? []) {
          if (
            d?.id?.type === 'Identifier' &&
            d.id.name === 'POST' &&
            (d.init?.type === 'ArrowFunctionExpression' || d.init?.type === 'FunctionExpression')
          ) {
            postHandlers.push(d.init);
          }
        }
      }
    }

    return {
      ImportDeclaration(node: any) {
        if (node?.source?.value === 'svix') importsSvix = true;
      },

      ExportNamedDeclaration(node: any) {
        collectPostHandler(node.declaration);
      },

      NewExpression(node: any) {
        if (node.callee?.type === 'Identifier' && (node.callee.name === 'Map' || node.callee.name === 'Set')) {
          dedupSignals.push(node);
        }
      },

      CallExpression(node: any) {
        const callee = node.callee;
        if (callee?.type !== 'MemberExpression') return;
        const objName =
          callee.object?.type === 'Identifier' ? callee.object.name : undefined;
        const methodName = callee.property?.type === 'Identifier' ? callee.property.name : undefined;
        if ((objName && DEDUP_OBJECTS.has(objName)) || (methodName && DEDUP_METHODS.has(methodName))) {
          dedupSignals.push(node);
        }
      },

      MemberExpression(node: any) {
        if (node.property?.type === 'Identifier' && EVENT_ID_PROPS.has(node.property.name)) {
          dedupSignals.push(node);
        }
      },

      'Program:exit'() {
        if (!importsSvix) return;
        for (const handler of postHandlers) {
          const hasDedup = dedupSignals.some(
            (sig) => startOffset(sig) >= startOffset(handler) && endOffset(sig) <= endOffset(handler),
          );
          if (!hasDedup) {
            context.report({ node: handler, messageId: 'noIdempotency' });
          }
        }
      },
    };
  },
};

export const resendWebhookNoIdempotencyRule = rule;
export default rule;
