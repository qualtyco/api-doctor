import { collectOpenAIRealtimeUrlVarNames, findProperty, isOpenAIRealtimeNewWebSocket } from '../utils.js';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'OpenAI Realtime connections must not pin to the deprecated beta interface',
      category: 'correctness',
      docsUrl: 'https://developers.openai.com/api/docs/guides/realtime',
      rationale:
        "OpenAI's current Realtime guide states that beta integrations must migrate to the GA interface before new work proceeds, and explicitly calls out removing the OpenAI-Beta: realtime=v1 header as a required step. Staying on the beta header keeps a connection locked to the legacy session shape and event names with no confirmed sunset date — a ticking liability rather than an active failure.",
      recommended: true,
    },
    messages: {
      betaHeaderPresent:
        "This OpenAI Realtime connection sends the deprecated 'OpenAI-Beta: realtime=v1' header instead of using the GA interface.",
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
        if (optionsArg?.type !== 'ObjectExpression') return;

        const headersProp = findProperty(optionsArg, 'headers');
        if (headersProp?.value?.type !== 'ObjectExpression') return;

        const betaProp = findProperty(headersProp.value, 'OpenAI-Beta');
        if (!betaProp) return;

        const value = betaProp.value;
        const isRealtimeV1 =
          value?.type === 'Literal' &&
          typeof value.value === 'string' &&
          value.value.includes('realtime=v1');
        if (!isRealtimeV1) return;

        context.report({ node: betaProp, messageId: 'betaHeaderPresent' });
      },
    };
  },
};

export const openaiRealtimeMigrateBetaToGaRule = rule;
