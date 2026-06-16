/**
 * resend-request-id-not-logged (integration)
 *
 * From the prompt (not the audit): when handling a Resend error, logging the
 * request id makes support/debugging far easier. Flags an error-handling block
 * (a `catch` clause or an `if (error)` block) in a file that imports `resend`,
 * which references `<error>.message` but never references a request-id header
 * (`x-request-id` or `x-resend-request-id`). Advisory only (info).
 */
import { endOffset, startOffset } from '../../utils/resend.js';

const REQUEST_ID_HEADERS = new Set(['x-request-id', 'x-resend-request-id']);

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Log the Resend request id when handling errors',
      category: 'integration',
      rationale:
        'Every Resend API response carries a request id (x-request-id / x-resend-request-id) that uniquely identifies the call on their side. When something goes wrong, logging only error.message leaves you and Resend support with no way to find the exact failed request. Logging the request id alongside the message turns a vague "send failed" into a traceable incident that support can look up directly.',
      docsUrl: 'https://resend.com/docs/api-reference/errors',
      recommended: true,
    },
    messages: {
      requestIdNotLogged:
        'Error handler logs error.message but not the Resend request id (x-request-id / x-resend-request-id).',
    },
    schema: [],
  },
  create(context: any) {
    let importsResend = false;
    const scopes: { node: any; name: string; range: [number, number] }[] = [];
    const messageAccesses: { name: string; pos: number }[] = [];
    const requestIdPositions: number[] = [];

    function within(range: [number, number], pos: number): boolean {
      return pos >= range[0] && pos <= range[1];
    }

    return {
      ImportDeclaration(node: any) {
        if (node?.source?.value === 'resend') importsResend = true;
      },

      CatchClause(node: any) {
        const param = node.param;
        if (param?.type === 'Identifier' && node.body) {
          scopes.push({
            node,
            name: param.name,
            range: [startOffset(node.body), endOffset(node.body)],
          });
        }
      },

      IfStatement(node: any) {
        if (node.test?.type === 'Identifier' && node.consequent) {
          scopes.push({
            node,
            name: node.test.name,
            range: [startOffset(node.consequent), endOffset(node.consequent)],
          });
        }
      },

      MemberExpression(node: any) {
        // `<name>.message`
        if (
          node.property?.type === 'Identifier' &&
          node.property.name === 'message' &&
          node.object?.type === 'Identifier'
        ) {
          messageAccesses.push({ name: node.object.name, pos: startOffset(node) });
        }
      },

      Literal(node: any) {
        if (typeof node.value === 'string' && REQUEST_ID_HEADERS.has(node.value.toLowerCase())) {
          requestIdPositions.push(startOffset(node));
        }
      },

      'Program:exit'() {
        if (!importsResend) return;
        for (const scope of scopes) {
          const logsMessage = messageAccesses.some(
            (m) => m.name === scope.name && within(scope.range, m.pos),
          );
          if (!logsMessage) continue;
          const logsRequestId = requestIdPositions.some((pos) => within(scope.range, pos));
          if (!logsRequestId) {
            context.report({ node: scope.node, messageId: 'requestIdNotLogged' });
          }
        }
      },
    };
  },
};

export const resendRequestIdNotLoggedRule = rule;
export default rule;
