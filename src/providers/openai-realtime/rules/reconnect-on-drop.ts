import { collectOpenAIRealtimeSocketVarNames, isSocketOnCall } from '../utils.js';

const RECONNECT_NAME_PATTERN = /reconnect/i;

/** True when `subtree` contains a `new WebSocket(...)` or a call to something named like "reconnect". */
function hasReconnectAttempt(node: any, depth = 0): boolean {
  if (!node || typeof node !== 'object' || depth > 60) return false;
  if (Array.isArray(node)) {
    return node.some((n) => hasReconnectAttempt(n, depth + 1));
  }

  if (node.type === 'NewExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'WebSocket') {
    return true;
  }

  if (node.type === 'CallExpression') {
    const callee = node.callee;
    const calleeName =
      callee?.type === 'Identifier'
        ? callee.name
        : callee?.type === 'MemberExpression' && callee.property?.type === 'Identifier'
          ? callee.property.name
          : null;
    if (typeof calleeName === 'string' && RECONNECT_NAME_PATTERN.test(calleeName)) return true;
  }

  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const val = node[key];
    if (val && typeof val === 'object' && hasReconnectAttempt(val, depth + 1)) return true;
  }
  return false;
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'A dropped OpenAI Realtime connection must be retried, not just logged',
      category: 'reliability',
      docsUrl: 'https://developers.openai.com/api/docs/guides/realtime',
      rationale:
        "For a multi-minute phone call, a single transient OpenAI-side disconnect that is only logged on 'close' permanently kills translation/processing for the remainder of the call in that direction — the call itself stays connected and silently degraded, with neither party getting a signal that something stopped working.",
      recommended: true,
    },
    messages: {
      noReconnectAttempt:
        "This Realtime socket's close handler only logs and never attempts to reconnect.",
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
        if (!isSocketOnCall(node, socketVarNames, 'close')) return;

        const handler = node.arguments?.[1];
        if (handler?.type !== 'ArrowFunctionExpression' && handler?.type !== 'FunctionExpression') return;

        if (!hasReconnectAttempt(handler.body)) {
          context.report({ node, messageId: 'noReconnectAttempt' });
        }
      },
    };
  },
};

export const openaiRealtimeReconnectOnDropRule = rule;
