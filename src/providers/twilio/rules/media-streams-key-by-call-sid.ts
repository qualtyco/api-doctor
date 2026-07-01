/**
 * Flags a Media Streams interceptor/session map keyed by a phone-number-like
 * field (`from`/`customParameters.from`) instead of the unique `callSid`
 * Twilio provides on every `start` message (Finding F).
 */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Media Streams session maps must be keyed by callSid, not phone number',
      category: 'reliability',
      rationale:
        'A Map keyed on the caller\'s phone number breaks the moment the same number places two concurrent calls — a retry after a dropped call, two family members sharing a line, a misdial-and-redial. The second map.set() silently overwrites the first call\'s entry, and that first call\'s downstream events (reservation-accepted, outbound-leg wiring) end up pointed at the wrong session, crossing audio streams between two unrelated calls. Twilio provides a unique callSid on every start message specifically to avoid this collision.',
      docsUrl: 'https://www.twilio.com/docs/voice/media-streams/websocket-messages',
      recommended: true,
    },
    messages: {
      keyedByPhoneNumber:
        'This Map is keyed by "{{key}}" (a phone-number-like field) instead of callSid — two concurrent calls from the same number will silently overwrite each other\'s entry.',
    },
  },
  create(context: any) {
    function isFromLikeIdentifier(n: any): string | null {
      if (n?.type === 'Identifier' && n.name === 'from') return 'from';
      if (
        n?.type === 'MemberExpression' &&
        n.property?.type === 'Identifier' &&
        n.property.name === 'from' &&
        !n.computed
      ) {
        return 'from';
      }
      return null;
    }

    function isMapMutationCall(n: any, methodNames: Set<string>): boolean {
      if (n?.type !== 'CallExpression') return false;
      const callee = n.callee;
      if (callee?.type !== 'MemberExpression') return false;
      return callee.property?.type === 'Identifier' && methodNames.has(callee.property.name);
    }

    const SET_OR_GET = new Set(['set', 'get']);

    return {
      'Program:exit'(program: any) {
        // Only flag when callSid is available elsewhere in the file (e.g. on
        // the Media Streams `start` message) — i.e. the correct key existed
        // and was passed over, not just any unrelated Map<string, T>.
        let callSidAvailable = false;
        function scanForCallSid(n: any, depth = 0): void {
          if (callSidAvailable || !n || typeof n !== 'object' || depth > 60) return;
          if (Array.isArray(n)) {
            for (const item of n) scanForCallSid(item, depth + 1);
            return;
          }
          if (n.type === 'Identifier' && n.name === 'callSid') {
            callSidAvailable = true;
            return;
          }
          if (n.type === 'MemberExpression' && !n.computed && n.property?.type === 'Identifier' && n.property.name === 'callSid') {
            callSidAvailable = true;
            return;
          }
          for (const key of Object.keys(n)) {
            if (key === 'parent' || key === 'loc' || key === 'range') continue;
            const val = n[key];
            if (val && typeof val === 'object') scanForCallSid(val, depth + 1);
          }
        }
        scanForCallSid(program);
        if (!callSidAvailable) return;

        function walk(n: any, depth = 0): void {
          if (!n || typeof n !== 'object' || depth > 60) return;
          if (Array.isArray(n)) {
            for (const item of n) walk(item, depth + 1);
            return;
          }
          if (isMapMutationCall(n, SET_OR_GET)) {
            const firstArg = n.arguments?.[0];
            const key = isFromLikeIdentifier(firstArg);
            if (key) context.report({ node: n, messageId: 'keyedByPhoneNumber', data: { key } });
          }
          for (const k of Object.keys(n)) {
            if (k === 'parent' || k === 'loc' || k === 'range') continue;
            const val = n[k];
            if (val && typeof val === 'object') walk(val, depth + 1);
          }
        }
        walk(program);
      },
    };
  },
};

export const twilioMediaStreamsKeyByCallSidRule = rule;
