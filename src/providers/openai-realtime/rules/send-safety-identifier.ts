import { collectOpenAIRealtimeUrlVarNames, findProperty, isOpenAIRealtimeNewWebSocket } from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'OpenAI Realtime connections should send an OpenAI-Safety-Identifier header',
      category: 'security',
      docsUrl: 'https://developers.openai.com/api/docs/guides/realtime',
      rationale:
        "OpenAI's Realtime guidance recommends including an OpenAI-Safety-Identifier header with a stable, privacy-preserving value (e.g. a hashed user/account id) on Realtime connections, to support OpenAI's abuse/safety monitoring for voice content. A connection that omits it gives OpenAI no way to correlate abusive sessions back to an account without per-connection metadata.",
      recommended: true,
    },
    messages: {
      missingSafetyIdentifier:
        'This OpenAI Realtime WebSocket connection does not send an OpenAI-Safety-Identifier header.',
    },
    schema: [],
  },
  create(context: any) {
    let urlVarNames = new Set<string>();

    return {
      Program(node: any) {
        urlVarNames = collectOpenAIRealtimeUrlVarNames(node);
      },

      NewExpression(node: any) {
        if (!isOpenAIRealtimeNewWebSocket(node, urlVarNames)) return;

        const optionsArg = node.arguments?.[1];
        const headersProp = optionsArg?.type === 'ObjectExpression' ? findProperty(optionsArg, 'headers') : null;
        const headersObj = headersProp?.value?.type === 'ObjectExpression' ? headersProp.value : null;

        const safetyIdProp = headersObj ? findProperty(headersObj, 'OpenAI-Safety-Identifier') : null;
        if (safetyIdProp) return;

        context.report({ node: headersObj ?? optionsArg ?? node, messageId: 'missingSafetyIdentifier' });
      },
    };
  },
};

export const openaiRealtimeSendSafetyIdentifierRule = rule;
