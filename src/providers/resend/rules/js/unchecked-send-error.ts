/**
 * resend-unchecked-send-error (correctness)
 *
 * Resend's JS SDK resolves to `{ data, error }` on every path. Verified in
 * resend@6.17.2 `dist/index.mjs` (`fetchRequest`): non-2xx responses, bodies
 * that fail to parse, and even a `fetch` rejection caught by the outer
 * `catch {}` all return `{ data: null, error }`. There is no path on which a
 * send rejects, so `await`-ing one inside `try/catch` handles nothing — the
 * catch block is dead code for every Resend-side failure.
 *
 * Handled shapes that must NOT flag:
 *   - a destructured `error` binding (`const { error } = await ...`), under any
 *     local name (`const { error: sendError } = ...`)
 *   - a whole-result binding whose `.error` is read later (`const res = await ...;
 *     if (res.error) ...`, or `const { error } = res` afterwards)
 *   - a rest pattern (`const { data, ...rest } = await ...`) — `error` may be
 *     inside `rest`, so the read is unprovable rather than absent
 *   - `return`ing the result, explicitly or from a concise arrow body: the
 *     `{ data, error }` pair is handed to the caller, which is where the check
 *     then belongs. This is why the rule does not reach a thin transport
 *     wrapper — only its callers.
 *   - a `.then(...)` / `.catch(...)` chain: the result is being handled, and
 *     following it through callbacks is out of scope.
 *
 * Deliberately NOT an exemption: an enclosing `try`/`catch`. Catching around a
 * send is the single most common form of this bug, not a fix for it.
 */
import {
  destructuresKey,
  hasRestElement,
  isResendMutationCall,
} from '../../utils.js';

/** Unwraps `await x` to `x`; returns the node itself otherwise. */
function unwrapAwait(node: any): any {
  return node?.type === 'AwaitExpression' ? node.argument : node;
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Resend calls that mutate must check the returned error field',
      category: 'correctness',
      rationale:
        'The Resend SDK never throws: every failure — an invalid API key, an unverified domain, a rejected recipient, a network fault — resolves as { data: null, error }. Code that awaits a send and moves on, or destructures only data, therefore treats every failure as a success. The user is told to check an inbox that will never receive the mail, and any compensating cleanup in a surrounding catch block never runs because nothing was ever thrown. Reading error is the only way the failure becomes visible.',
      docsUrl: 'https://resend.com/docs/api-reference/errors',
      recommended: true,
    },
    messages: {
      uncheckedSendError:
        'This Resend call never checks error — the SDK does not throw, so failures will be silent.',
    },
    schema: [],
  },
  create(context: any) {
    // Whole-result bindings (`const res = await ...`) are only a problem if
    // `res.error` is never read — collect reads file-wide, decide at exit.
    const deferredBindings: Array<{ node: any; name: string }> = [];
    const errorReadNames = new Set<string>();

    function checkCall(node: any, pattern: any | undefined, init: any) {
      if (!isResendMutationCall(unwrapAwait(init))) return;
      if (!pattern) {
        context.report({ node, messageId: 'uncheckedSendError' });
        return;
      }
      if (pattern.type === 'Identifier') {
        deferredBindings.push({ node, name: pattern.name });
        return;
      }
      if (hasRestElement(pattern)) return;
      if (!destructuresKey(pattern, 'error')) {
        context.report({ node, messageId: 'uncheckedSendError' });
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
        // `await resend.emails.send(...)` — or the un-awaited floating promise,
        // which discards the result the same way and loses ordering besides.
        const expr = node.expression;
        const inner = unwrapAwait(expr);
        if (inner?.type !== 'CallExpression') return;
        checkCall(node, undefined, inner);
      },
      VariableDeclarator(node: any) {
        // `const { error } = res;` — result object destructured after the fact.
        if (node.init?.type === 'Identifier' && node.id?.type === 'ObjectPattern') {
          if (destructuresKey(node.id, 'error')) errorReadNames.add(node.init.name);
        }
        // Only the awaited form is decidable here: `const p = resend.emails
        // .send(...)` defers the result to whoever awaits `p`, which may be
        // another function entirely.
        if (node.init?.type !== 'AwaitExpression') return;
        checkCall(node, node.id, node.init);
      },
      AssignmentExpression(node: any) {
        if (node.right?.type !== 'AwaitExpression') return;
        // `this.last = await ...` / `arr[i] = await ...` park the result where
        // the `<name>.error` read tracking cannot follow it — stay quiet rather
        // than guess.
        const target = node.left?.type;
        if (target !== 'Identifier' && target !== 'ObjectPattern') return;
        checkCall(node, node.left, node.right);
      },
      'Program:exit'() {
        for (const { node, name } of deferredBindings) {
          if (!errorReadNames.has(name)) {
            context.report({ node, messageId: 'uncheckedSendError' });
          }
        }
      },
    };
  },
};

export const resendUncheckedSendErrorRule = rule;
export default rule;
