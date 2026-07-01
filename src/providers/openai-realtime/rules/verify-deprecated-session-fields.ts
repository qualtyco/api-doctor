import { findProperty } from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: "OpenAI Realtime session.update payloads should not rely on an unverified 'temperature' field",
      category: 'correctness',
      docsUrl: 'https://developers.openai.com/api/docs/api-reference/realtime-sessions',
      rationale:
        "Two independent fetches of the current Realtime sessions API reference did not surface 'temperature' as a documented session field. Sending an undocumented field is typically harmless (silently ignored), but code that depends on an assumed constraint (e.g. 'a hard floor of 0.6') for behavior like deterministic output is relying on a claim that is no longer traceable to any current, citable source.",
      recommended: true,
    },
    messages: {
      unverifiedTemperatureField:
        "This session.update payload sets 'temperature', a field not documented in the current GA Realtime sessions schema.",
    },
    schema: [],
  },
  create(context: any) {
    return {
      ObjectExpression(node: any) {
        const typeProp = findProperty(node, 'type');
        const typeValue = typeProp?.value;
        const isSessionUpdate =
          typeValue?.type === 'Literal' && typeof typeValue.value === 'string' && typeValue.value === 'session.update';
        if (!isSessionUpdate) return;

        const sessionProp = findProperty(node, 'session');
        if (sessionProp?.value?.type !== 'ObjectExpression') return;

        const temperatureProp = findProperty(sessionProp.value, 'temperature');
        if (!temperatureProp) return;

        context.report({ node: temperatureProp, messageId: 'unverifiedTemperatureField' });
      },
    };
  },
};

export const openaiRealtimeVerifyDeprecatedSessionFieldsRule = rule;
