/**
 * supabase-idempotent-mutations (reliability)
 *
 * `.insert(...)` with no idempotency/dedupe key field is not safely
 * retryable: a flaky network retry, double-click, or browser replay creates
 * a duplicate row. `.upsert(..., { onConflict: ... })` is the documented
 * fix and is exempt — only plain `.insert()` calls are checked.
 */
import { chainObjectCall, callPropName } from '../../utils.js';

function objectHasIdempotencyKey(objectExpression: any): boolean {
  if (objectExpression?.type !== 'ObjectExpression') return false;
  return (objectExpression.properties ?? []).some((p: any) => {
    if (p?.type !== 'Property') return false;
    const name =
      p.key?.type === 'Identifier' ? p.key.name : p.key?.type === 'Literal' ? p.key.value : undefined;
    if (typeof name !== 'string') return false;
    // A client-supplied `id`/`uuid` (or *_key/*_uuid field) is a dedupe key in
    // practice — a retry hits the unique/PK constraint instead of duplicating.
    // Deliberately not `_id$`: foreign keys like user_id are not dedupe keys.
    return /idempot|dedupe/i.test(name) || /^(id|uuid)$/i.test(name) || /_(key|uuid)$/i.test(name);
  });
}

function insertPayloadHasIdempotencyKey(arg: any): boolean {
  if (arg?.type === 'ObjectExpression') return objectHasIdempotencyKey(arg);
  if (arg?.type === 'ArrayExpression') {
    return (arg.elements ?? []).some((el: any) => objectHasIdempotencyKey(el));
  }
  return false;
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Supabase insert calls should be retry-safe via an idempotency key',
      category: 'reliability',
      rationale:
        'Nothing prevents a duplicate row if the client fetch behind an insert is retried (flaky network, double-click, browser replay) — no unique key is visible in the payload, and no upsert semantics. Include a client-generated unique key (an id, or a *_key field backed by a unique constraint), or use .upsert(..., { onConflict: "<key column>" }). This is general retry-safety practice rather than a documented Supabase requirement, hence info severity.',
      docsUrl: 'https://supabase.com/docs/reference/javascript/upsert',
      recommended: true,
    },
    messages: {
      missingIdempotencyKey:
        'This insert payload has no unique/idempotency key field, so a retried request can create a duplicate row. Include a client-generated key, or use .upsert(..., { onConflict: "<key column>" }).',
    },
    schema: [],
  },
  create(context: any) {
    return {
      CallExpression(node: any) {
        const prop = callPropName(node);
        if (prop !== 'insert') return;

        const objCall = chainObjectCall(node);
        if (!objCall || callPropName(objCall) !== 'from') return;

        const arg = node.arguments?.[0];
        if (!arg) return;
        if (insertPayloadHasIdempotencyKey(arg)) return;

        context.report({ node, messageId: 'missingIdempotencyKey' });
      },
    };
  },
};

export const supabaseIdempotentMutationsRule = rule;
