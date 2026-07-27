/**
 * Flags a Media Streams `mark.name` field set to a number instead of a
 * string (Finding K). Twilio's documented mark schema requires a string.
 */
const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Media Streams mark.name must be a string, not a number',
      category: 'correctness',
      rationale:
        'Twilio\'s documented Media Streams `mark` message schema and every example show `mark.name` as a string (e.g. "my label"). Setting it to a bare number — `Date.now()` is a common culprit — means JSON.stringify() serializes it as a numeric literal, not the documented string type, a latent type mismatch that surfaces once mark-based pacing actually depends on matching mark names.',
      docsUrl: 'https://www.twilio.com/docs/voice/media-streams/websocket-messages',
      recommended: true,
    },
    messages: {
      markNameNotString:
        'mark.name is set to a non-string value here — Twilio\'s documented schema requires mark.name to be a string (e.g. String(Date.now())).',
    },
  },
  create(context: any) {
    // Calls known to return a number — the common culprits for a bare,
    // unwrapped mark.name. Any other call (including string-returning
    // helpers like `someId.toString()` or a custom label generator) is left
    // alone since its return type can't be determined statically.
    const NUMERIC_CALLS = new Set(['Date.now', 'performance.now', 'Math.random', 'Math.floor', 'Math.round']);

    function isNumericLooking(n: any): boolean {
      if (!n) return false;
      if (n.type === 'Literal' && typeof n.value === 'number') return true;
      if (n.type === 'CallExpression') {
        const callee = n.callee;
        if (callee?.type === 'Identifier') return false;
        if (
          callee?.type === 'MemberExpression' &&
          callee.object?.type === 'Identifier' &&
          callee.property?.type === 'Identifier'
        ) {
          return NUMERIC_CALLS.has(`${callee.object.name}.${callee.property.name}`);
        }
        return false;
      }
      return false;
    }

    function findMarkNameProperty(markObjExpr: any): any {
      for (const p of markObjExpr.properties ?? []) {
        if (p.type !== 'Property') continue;
        const keyName = p.key?.type === 'Identifier' ? p.key.name : p.key?.type === 'Literal' ? p.key.value : null;
        if (keyName === 'name') return p;
      }
      return null;
    }

    return {
      Property(node: any) {
        const keyName = node.key?.type === 'Identifier' ? node.key.name : node.key?.type === 'Literal' ? node.key.value : null;
        if (keyName !== 'mark') return;
        if (node.value?.type !== 'ObjectExpression') return;

        const nameProp = findMarkNameProperty(node.value);
        if (!nameProp) return;
        if (!isNumericLooking(nameProp.value)) return;

        context.report({ node: nameProp, messageId: 'markNameNotString' });
      },
    };
  },
};

export const twilioMediaStreamsMarkNameStringRule = rule;
