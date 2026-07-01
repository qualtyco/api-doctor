/**
 * Flags fetch() calls to the ElevenLabs API that have no explicit API
 * version header, so a future breaking API change silently changes
 * behavior under the request (Finding G).
 */
import { isElevenLabsUrlArg } from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'ElevenLabs API requests should pin an explicit API version header',
      category: 'reliability',
      rationale:
        'The endpoint is hardcoded to /v1 in the URL path with no explicit version header. If ElevenLabs ships a v2 API and changes default response behavior for unversioned clients, requests with no version header silently pick up the new behavior instead of failing loudly or staying pinned.',
      docsUrl: 'https://elevenlabs.io/docs/eleven-api/resources/breaking-changes-policy',
      recommended: true,
    },
    messages: {
      missingVersionHeader:
        'This fetch call to the ElevenLabs API has no explicit API version header — a future API change could silently alter behavior.',
    },
  },
  create(context: any) {
    function hasVersionHeader(optionsArg: any): boolean {
      if (optionsArg?.type !== 'ObjectExpression') return false;
      const headersProp = (optionsArg.properties ?? []).find(
        (p: any) => p.type === 'Property' && p.key?.type === 'Identifier' && p.key.name === 'headers',
      );
      if (!headersProp) return false;
      if (headersProp.value?.type !== 'ObjectExpression') return true; // spread/computed headers — be conservative
      return (headersProp.value.properties ?? []).some((p: any) => {
        if (p.type === 'SpreadElement') return true;
        if (p.type !== 'Property') return false;
        const keyName = p.key?.type === 'Identifier' ? p.key.name : p.key?.type === 'Literal' ? p.key.value : null;
        return typeof keyName === 'string' && /version/i.test(keyName);
      });
    }

    return {
      CallExpression(node: any) {
        if (node.callee?.type !== 'Identifier' || node.callee.name !== 'fetch') return;
        if (!isElevenLabsUrlArg(node.arguments?.[0])) return;

        const optionsArg = node.arguments?.[1];
        if (hasVersionHeader(optionsArg)) return;

        context.report({ node, messageId: 'missingVersionHeader' });
      },
    };
  },
};

export const elevenlabsApiVersionPinningRule = rule;
