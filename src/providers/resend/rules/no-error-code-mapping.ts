/**
 * resend-no-error-code-mapping (reliability)
 *
 * Audit finding G [MEDIUM]: returning HTTP 500 for every Resend error is wrong
 * — 400/401/403/422 are client errors that should not be retried as 500s.
 *
 * Flags `if (error) { return ...500... }` where `error` is destructured from a
 * Resend send call in the same function, and the branch returns a hardcoded
 * 500 via `NextResponse.json(..., { status: 500 })` or `res.status(500)`.
 */
import {
  contains,
  findProperty,
  isResendSendCall,
  startOffset,
} from '../utils.js';

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Resend errors should map to appropriate HTTP status codes, not a blanket 500',
      category: 'reliability',
      rationale:
        'Resend returns different error classes that callers must treat differently: 400/422 mean fix the params and do not retry, 401/403 mean fix the key or domain, and 429/500 mean retry with backoff. Collapsing all of them into a blanket HTTP 500 tells the client to retry errors that will never succeed and hides the real cause from logs and monitoring. Mapping the SDK error code to the right status makes the API honest and lets clients react correctly.',
      docsUrl: 'https://resend.com/docs/ai-onboarding',
      recommended: true,
    },
    messages: {
      noErrorCodeMapping:
        'Resend errors are returned as a blanket HTTP 500. Map 400/401/403/422 to non-500 statuses.',
    },
    schema: [],
  },
  create(context: any) {
    const functions: any[] = [];
    // `error` identifiers destructured from a Resend send call: { name, pos }.
    const resendErrorBindings: { name: string; pos: number }[] = [];
    // `if (<identifier>) {...}` statements with an Identifier test.
    const ifErrorStatements: { node: any; name: string; consequent: any }[] = [];
    // Positions of hardcoded-500 response expressions.
    const fiveHundredNodes: any[] = [];

    function initIsResendSend(init: any): boolean {
      if (!init) return false;
      const expr = init.type === 'AwaitExpression' ? init.argument : init;
      return isResendSendCall(expr);
    }

    function isNextResponse500(node: any): boolean {
      // <X>.json(body, { status: 500 })
      const callee = node.callee;
      if (callee?.type !== 'MemberExpression') return false;
      if (callee.property?.type !== 'Identifier' || callee.property.name !== 'json') return false;
      const opts = node.arguments?.[1];
      const statusProp = findProperty(opts, 'status');
      return statusProp?.value?.type === 'Literal' && statusProp.value.value === 500;
    }

    function isResStatus500(node: any): boolean {
      // res.status(500)
      const callee = node.callee;
      if (callee?.type !== 'MemberExpression') return false;
      if (callee.property?.type !== 'Identifier' || callee.property.name !== 'status') return false;
      const arg = node.arguments?.[0];
      return arg?.type === 'Literal' && arg.value === 500;
    }

    return {
      FunctionDeclaration(node: any) {
        functions.push(node);
      },
      FunctionExpression(node: any) {
        functions.push(node);
      },
      ArrowFunctionExpression(node: any) {
        functions.push(node);
      },

      VariableDeclarator(node: any) {
        if (!initIsResendSend(node.init)) return;
        if (node.id?.type !== 'ObjectPattern') return;
        const errorProp = (node.id.properties ?? []).find(
          (p: any) => p?.type === 'Property' && p.key?.type === 'Identifier' && p.key.name === 'error',
        );
        if (!errorProp) return;
        const localName =
          errorProp.value?.type === 'Identifier' ? errorProp.value.name : 'error';
        resendErrorBindings.push({ name: localName, pos: startOffset(node) });
      },

      IfStatement(node: any) {
        if (node.test?.type === 'Identifier') {
          ifErrorStatements.push({ node, name: node.test.name, consequent: node.consequent });
        }
      },

      CallExpression(node: any) {
        if (isNextResponse500(node) || isResStatus500(node)) {
          fiveHundredNodes.push(node);
        }
      },

      'Program:exit'() {
        for (const { node, name, consequent } of ifErrorStatements) {
          // The branch must return a hardcoded 500.
          const has500 = fiveHundredNodes.some((five) => contains(consequent, five));
          if (!has500) continue;

          // The `error` must be bound from a Resend send call in the same function.
          const enclosing = functions
            .filter((fn) => contains(fn, node))
            .sort((a, b) => startOffset(b) - startOffset(a))[0];
          const boundFromResend = resendErrorBindings.some(
            (b) => b.name === name && (enclosing ? contains(enclosing, { range: [b.pos, b.pos] }) : true),
          );
          if (boundFromResend) {
            context.report({ node, messageId: 'noErrorCodeMapping' });
          }
        }
      },
    };
  },
};

export const resendNoErrorCodeMappingRule = rule;
export default rule;
