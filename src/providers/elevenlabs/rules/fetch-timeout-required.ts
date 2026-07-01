/**
 * Flags fetch() calls to the ElevenLabs API that have no abort signal /
 * timeout configured, so a slow or unresponsive API hangs the request
 * indefinitely (Finding C).
 */
import { isElevenLabsUrlArg } from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Fetch calls to the ElevenLabs API must set an abort timeout',
      category: 'reliability',
      rationale:
        'Native fetch has no default timeout. If the ElevenLabs API becomes slow or hangs, a request with no AbortController/signal will wait indefinitely, tying up the request handler and starving the server of available connections.',
      docsUrl: 'https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-signed-url',
      recommended: true,
    },
    messages: {
      missingTimeout:
        'This fetch call to the ElevenLabs API has no abort signal/timeout — a slow or unresponsive API will hang the request indefinitely.',
    },
  },
  create(context: any) {
    function hasSignalOption(optionsArg: any): boolean {
      if (optionsArg?.type !== 'ObjectExpression') return false;
      return (optionsArg.properties ?? []).some((p: any) => {
        if (p.type === 'SpreadElement') return true; // be conservative: spread could carry a signal
        return p.type === 'Property' && p.key?.type === 'Identifier' && p.key.name === 'signal';
      });
    }

    return {
      CallExpression(node: any) {
        if (node.callee?.type !== 'Identifier' || node.callee.name !== 'fetch') return;
        if (!isElevenLabsUrlArg(node.arguments?.[0])) return;

        const optionsArg = node.arguments?.[1];
        if (hasSignalOption(optionsArg)) return;

        context.report({ node, messageId: 'missingTimeout' });
      },
    };
  },
};

export const elevenlabsFetchTimeoutRequiredRule = rule;
