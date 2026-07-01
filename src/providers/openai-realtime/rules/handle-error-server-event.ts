import { collectOpenAIRealtimeSocketVarNames, isSocketOnCall } from '../utils.js';

function isTypeMemberExpression(node: any): boolean {
  return node?.type === 'MemberExpression' && node.property?.type === 'Identifier' && node.property.name === 'type';
}

/**
 * Recursively collects every string literal compared against a `.type`
 * member expression — covers `if (x.type === 'foo')` and `switch (x.type) { case 'foo': }`.
 */
function collectTypeComparisonLiterals(node: any, out: Set<string>, depth = 0): void {
  if (!node || typeof node !== 'object' || depth > 60) return;
  if (Array.isArray(node)) {
    for (const n of node) collectTypeComparisonLiterals(n, out, depth + 1);
    return;
  }

  if (node.type === 'BinaryExpression' && (node.operator === '===' || node.operator === '==')) {
    if (isTypeMemberExpression(node.left) && node.right?.type === 'Literal' && typeof node.right.value === 'string') {
      out.add(node.right.value);
    }
    if (isTypeMemberExpression(node.right) && node.left?.type === 'Literal' && typeof node.left.value === 'string') {
      out.add(node.left.value);
    }
  }

  if (node.type === 'SwitchStatement' && isTypeMemberExpression(node.discriminant)) {
    for (const c of node.cases ?? []) {
      if (c?.test?.type === 'Literal' && typeof c.test.value === 'string') out.add(c.test.value);
    }
  }

  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const val = node[key];
    if (val && typeof val === 'object') collectTypeComparisonLiterals(val, out, depth + 1);
  }
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'OpenAI Realtime message handlers must check for the API-level "error" server event',
      category: 'reliability',
      docsUrl: 'https://developers.openai.com/api/docs/api-reference/realtime_server_events',
      rationale:
        "The Realtime API's own error server event — distinct from the WebSocket transport-level error event — covers rate limits, invalid session.update payloads, content-moderation blocks, and retired/invalid model ids. A message handler that branches on event types but never checks for 'error' lets the call continue silently with translation/processing permanently dead for that leg, with no operator-visible signal of why.",
      recommended: true,
    },
    messages: {
      missingErrorBranch:
        "This Realtime message handler branches on event types but never checks for message.type === 'error'.",
    },
    schema: [],
  },
  create(context: any) {
    let socketVarNames = new Set<string>();

    return {
      Program(node: any) {
        socketVarNames = collectOpenAIRealtimeSocketVarNames(node);
      },

      CallExpression(node: any) {
        if (socketVarNames.size === 0) return;
        if (!isSocketOnCall(node, socketVarNames, 'message')) return;

        const handler = node.arguments?.[1];
        if (handler?.type !== 'ArrowFunctionExpression' && handler?.type !== 'FunctionExpression') return;

        const literals = new Set<string>();
        collectTypeComparisonLiterals(handler.body, literals);

        // No type-dispatch pattern at all — not the shape this rule targets.
        if (literals.size === 0) return;

        if (!literals.has('error')) {
          context.report({ node, messageId: 'missingErrorBranch' });
        }
      },
    };
  },
};

export const openaiRealtimeHandleErrorServerEventRule = rule;
