/**
 * resend-missing-idempotency-key (reliability)
 *
 * Send/batch calls should pass an idempotencyKey to prevent duplicate emails
 * on retries. Flags a Resend send call when no object
 * argument carries an `idempotencyKey` property. Checking every object argument
 * accepts the key whether it sits in the payload or a separate options arg.
 *
 * Suppressed inside a *generic transport wrapper*: a function that forwards a
 * caller-supplied subject and body straight to Resend. Such a function does not
 * know which logical operation it is performing, so it has no name to seed a
 * key with — `welcome/${userId}` has to be chosen where the intent is known.
 * Asking for a key there means adding a parameter and threading it through
 * every call site, which is an API design change rather than a bug fix, and
 * the finding is not defensible in review. Sends whose subject and body are
 * fixed in the function still fire: those name their own operation.
 */
import {
  contains,
  findProperty,
  getSendOptionObjects,
  isResendSendCall,
  startOffset,
} from '../../utils.js';

/** Properties that identify *which* message is being sent. */
const SUBJECT_KEYS = ['subject'];
const BODY_KEYS = ['html', 'text', 'react'];

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

/** Every simple binding name introduced by a function's parameter list. */
function parameterNames(fn: any): Set<string> {
  const names = new Set<string>();
  const visit = (n: any): void => {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'Identifier') {
      names.add(n.name);
      return;
    }
    if (n.type === 'ObjectPattern') {
      for (const p of n.properties ?? []) visit(p.type === 'RestElement' ? p.argument : p.value);
      return;
    }
    if (n.type === 'ArrayPattern') {
      for (const el of n.elements ?? []) visit(el);
      return;
    }
    if (n.type === 'AssignmentPattern') visit(n.left);
    if (n.type === 'RestElement') visit(n.argument);
  };
  for (const p of fn?.params ?? []) visit(p);
  return names;
}

/**
 * True when `value` is (or is built from) one of `params` rather than being
 * fixed in the source — `subject`, `opts.subject` and `` `Re: ${subject}` ``
 * all count as caller-supplied.
 */
function comesFromParams(value: any, params: Set<string>): boolean {
  if (!value || typeof value !== 'object') return false;
  if (value.type === 'Identifier') return params.has(value.name);
  if (value.type === 'MemberExpression') return comesFromParams(value.object, params);
  if (value.type === 'TemplateLiteral') {
    return (value.expressions ?? []).some((e: any) => comesFromParams(e, params));
  }
  if (value.type === 'CallExpression') {
    return (value.arguments ?? []).some((a: any) => comesFromParams(a, params));
  }
  if (value.type === 'ConditionalExpression') {
    return (
      comesFromParams(value.consequent, params) || comesFromParams(value.alternate, params)
    );
  }
  if (value.type === 'LogicalExpression' || value.type === 'BinaryExpression') {
    return comesFromParams(value.left, params) || comesFromParams(value.right, params);
  }
  return false;
}

/**
 * True when every payload of `node` takes both its subject and its body from
 * the enclosing function's parameters — the shape of a `sendEmail({ to,
 * subject, html })` transport helper.
 *
 * A payload that is not a literal object (a forwarded variable, a `.map()`
 * result) is not enough to judge, so it does not qualify: the rule keeps
 * firing rather than going quiet on something it cannot see.
 */
function isGenericTransportWrapper(node: any, fn: any): boolean {
  const params = parameterNames(fn);
  if (params.size === 0) return false;

  const payloads = getSendOptionObjects(node);
  if (payloads.length === 0) return false;

  return payloads.every((payload: any) => {
    const subject = SUBJECT_KEYS.map((k) => findProperty(payload, k)).find(Boolean);
    const body = BODY_KEYS.map((k) => findProperty(payload, k)).find(Boolean);
    if (!subject || !body) return false;
    return comesFromParams(subject.value, params) && comesFromParams(body.value, params);
  });
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Resend send/batch calls should include an idempotencyKey',
      category: 'reliability',
      rationale:
        'Without an idempotency key, if a network retry or webhook redelivery occurs, Resend will send the email multiple times. This causes duplicate charges, duplicate user notifications, and damaged sender reputation. Adding an idempotency key (a unique string per logical operation, like `welcome/${userId}`) makes the send safely retryable.',
      docsUrl: 'https://resend.com/docs/send-with-nextjs',
      recommended: true,
    },
    messages: {
      missingIdempotencyKey:
        'Resend send call has no idempotencyKey. Add one to prevent duplicate sends on retry.',
    },
    schema: [],
  },
  create(context: any) {
    const functions: any[] = [];
    const candidates: any[] = [];

    return {
      ...Object.fromEntries(
        [...FUNCTION_TYPES].map((type) => [type, (node: any) => functions.push(node)]),
      ),

      CallExpression(node: any) {
        if (!isResendSendCall(node)) return;
        const hasKey = (node.arguments ?? []).some(
          (arg: any) => arg?.type === 'ObjectExpression' && findProperty(arg, 'idempotencyKey'),
        );
        // Deferred to Program:exit: the enclosing function is not on the stack
        // yet for a send that appears before its own arrow wrapper is visited.
        if (!hasKey) candidates.push(node);
      },

      'Program:exit'() {
        for (const node of candidates) {
          // Innermost enclosing function = the latest-starting one containing it.
          const enclosing = functions
            .filter((fn) => contains(fn, node))
            .sort((a, b) => startOffset(b) - startOffset(a))[0];
          if (enclosing && isGenericTransportWrapper(node, enclosing)) continue;
          context.report({ node, messageId: 'missingIdempotencyKey' });
        }
      },
    };
  },
};

export const resendMissingIdempotencyKeyRule = rule;
export default rule;
