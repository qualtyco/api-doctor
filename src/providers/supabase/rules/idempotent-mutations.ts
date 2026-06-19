/**
 * supabase-idempotent-mutations (reliability)
 *
 * `.insert(...)` with no idempotency/dedupe key field is not safely
 * retryable: a flaky network retry, double-click, or browser replay creates
 * a duplicate row. `.upsert(..., { onConflict: ... })` is the documented
 * fix and is exempt — only plain `.insert()` calls are checked.
 */
import { chainObjectCall, memberPropName } from '../utils.js';

function objectHasIdempotencyKey(objectExpression: any): boolean {
  if (objectExpression?.type !== 'ObjectExpression') return false;
  return (objectExpression.properties ?? []).some((p: any) => {
    if (p?.type !== 'Property') return false;
    const name =
      p.key?.type === 'Identifier' ? p.key.name : p.key?.type === 'Literal' ? p.key.value : undefined;
    return typeof name === 'string' && /idempot|dedupe/i.test(name);
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
        'Nothing prevents a duplicate row if the client fetch behind an insert is retried (flaky network, double-click, browser replay) — there is no unique constraint or dedupe key visible in the payload, and no upsert semantics. Generate a client-side idempotency key per logical action and either include it as a field guarded by a unique constraint, or use .upsert(..., { onConflict: "<key column>" }).',
      docsUrl: 'https://supabase.com/docs/reference/javascript/upsert',
      recommended: true,
    },
    messages: {
      missingIdempotencyKey:
        'This insert has no idempotency/dedupe key field, so a retried request can create a duplicate row. Add one, or use .upsert(..., { onConflict: "<key column>" }).',
    },
    schema: [],
  },
  create(context: any) {
    return {
      CallExpression(node: any) {
        const prop = memberPropName(node);
        if (prop !== 'insert') return;

        const objCall = chainObjectCall(node);
        if (!objCall || memberPropName(objCall) !== 'from') return;

        const arg = node.arguments?.[0];
        if (!arg) return;
        if (insertPayloadHasIdempotencyKey(arg)) return;

        context.report({ node, messageId: 'missingIdempotencyKey' });
      },
    };
  },
};

export const supabaseIdempotentMutationsRule = rule;
export default rule;
