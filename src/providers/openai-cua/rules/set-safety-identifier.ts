/**
 * Flags a `responses.create()` call with no `safety_identifier` (or the
 * older `user`) parameter — without one, OpenAI attributes policy
 * violations to the whole shared API key rather than a single end user.
 */
import { isResponsesCreateCall } from '../utils.js';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'responses.create() must set safety_identifier for per-end-user policy attribution',
      category: 'integration',
      rationale:
        'OpenAI documents that a stable per-end-user safety_identifier lets policy violations be attributed and acted on per end user. Without one on a multi-tenant integration routing many customers through a single shared API key, a single customer triggering a high-confidence policy-violation heuristic can result in access being temporarily revoked for the entire organization, not just the offending identifier.',
      docsUrl: 'https://help.openai.com/en/articles/5428082-how-to-incorporate-a-safety-identifier',
      recommended: true,
    },
    messages: {
      missingSafetyIdentifier:
        'This responses.create() call sets no safety_identifier (or user) — a policy violation here could be attributed to the entire shared API key instead of one end user.',
    },
  },
  create(context: any) {
    function propName(node: any): string | undefined {
      if (!node) return undefined;
      if (node.type === 'Identifier') return node.name;
      if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
      return undefined;
    }

    return {
      CallExpression(node: any) {
        if (!isResponsesCreateCall(node)) return;

        const optionsArg = node.arguments?.[0];
        if (optionsArg?.type !== 'ObjectExpression') return;

        const hasIdentifier = (optionsArg.properties ?? []).some((p: any) => {
          if (p?.type !== 'Property') return false;
          const keyName = propName(p.key);
          return keyName === 'safety_identifier' || keyName === 'user';
        });

        if (!hasIdentifier) {
          context.report({ node, messageId: 'missingSafetyIdentifier' });
        }
      },
    };
  },
};

export const openaiCuaSetSafetyIdentifierRule = rule;
