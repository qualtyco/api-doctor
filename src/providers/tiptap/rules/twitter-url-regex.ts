/**
 * tiptap-twitter-url-regex (integration)
 *
 * Detects regex literals that match `x.com` tweet URLs but omit `twitter.com`.
 * Legacy twitter.com URLs are still valid and resolve correctly.
 */

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Twitter/X URL regex must match both x.com and twitter.com',
      category: 'integration',
      rationale:
        'Twitter rebranded to X but twitter.com URLs still resolve and embed correctly. A regex that only matches x.com silently rejects all legacy twitter.com links pasted by users. Update the pattern to (x\\.com|twitter\\.com) so both domains are handled.',
      docsUrl: 'https://tiptap.dev/docs/editor/extensions/nodes',
      recommended: true,
    },
    messages: {
      twitterRegexMissingLegacyDomain:
        'This regex matches x.com but not twitter.com. Legacy twitter.com URLs are still valid and should be supported. Add (x\\.com|twitter\\.com) to the pattern.',
    },
    schema: [],
  },
  create(context: any) {
    function checkPattern(pattern: string, node: any): void {
      if (!pattern.includes('x\\.com') && !pattern.includes('x.com')) return;
      if (pattern.includes('twitter\\.com') || pattern.includes('twitter.com')) return;
      context.report({ node, messageId: 'twitterRegexMissingLegacyDomain' });
    }

    return {
      Literal(node: any) {
        // Regex literal
        if (node.regex?.pattern) {
          checkPattern(node.regex.pattern, node);
        }
      },

      NewExpression(node: any) {
        // new RegExp('pattern')
        if (
          node.callee?.type === 'Identifier' &&
          node.callee.name === 'RegExp'
        ) {
          const firstArg = node.arguments?.[0];
          if (firstArg?.type === 'Literal' && typeof firstArg.value === 'string') {
            checkPattern(firstArg.value, node);
          }
        }
      },
    };
  },
};

export const tiptapTwitterUrlRegexRule = rule;
export default rule;
