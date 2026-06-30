/**
 * tiptap-script-src-hardcoded-api-key (security)
 *
 * Detects when script.src is assigned a string literal (plain or template)
 * that contains `apiKey=` with a hardcoded value instead of an env variable.
 *
 * Flags:
 *   script.src = "https://cdn.example.com/calc.js?apiKey=abc123";
 *   script.src = `https://cdn.example.com/calc.js?apiKey=${LITERAL}`;
 *
 * Does NOT flag:
 *   script.src = `https://cdn.example.com/calc.js?apiKey=${process.env.KEY}`;
 */

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'script.src must not contain a hardcoded API key',
      category: 'security',
      cwe: 'CWE-798',
      owasp: 'API8:2023 Security Misconfiguration',
      rationale:
        'Hardcoding an API key directly in a script URL string commits the credential to version control and ships it in the client bundle. The key is trivially visible to anyone who views the page source. Read the key from an environment variable at runtime so it can be rotated without a code change and kept out of the repository.',
      docsUrl: 'https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views',
      recommended: true,
    },
    messages: {
      hardcodedApiKey:
        'script.src contains a hardcoded API key. Read the key from an environment variable instead.',
    },
    schema: [],
  },
  create(context: any) {
    function isSrcAssignment(node: any): boolean {
      return (
        node?.type === 'AssignmentExpression' &&
        node.left?.type === 'MemberExpression' &&
        node.left.property?.type === 'Identifier' &&
        node.left.property.name === 'src'
      );
    }

    function isEnvAccess(node: any): boolean {
      // process.env.SOMETHING or process.env['SOMETHING']
      if (node?.type !== 'MemberExpression') return false;
      const obj = node.object;
      return (
        obj?.type === 'MemberExpression' &&
        obj.object?.type === 'Identifier' &&
        obj.object.name === 'process' &&
        obj.property?.type === 'Identifier' &&
        obj.property.name === 'env'
      );
    }

    return {
      AssignmentExpression(node: any) {
        if (!isSrcAssignment(node)) return;
        const right = node.right;

        // Plain string literal with apiKey= in it
        if (right?.type === 'Literal' && typeof right.value === 'string') {
          if (right.value.includes('apiKey=')) {
            context.report({ node, messageId: 'hardcodedApiKey' });
          }
          return;
        }

        // Template literal: `...apiKey=...` where the value after apiKey= is a literal expression
        if (right?.type === 'TemplateLiteral') {
          const quasis: any[] = right.quasis ?? [];
          const expressions: any[] = right.expressions ?? [];

          for (let i = 0; i < quasis.length; i++) {
            const cooked: string = quasis[i]?.value?.cooked ?? '';
            if (cooked.includes('apiKey=')) {
              // The key follows this quasi — check if the next expression is env access
              const nextExpr = expressions[i];
              if (!nextExpr) {
                // apiKey= is in a tail quasi with no following expression → hardcoded
                context.report({ node, messageId: 'hardcodedApiKey' });
                return;
              }
              if (!isEnvAccess(nextExpr)) {
                // Expression after apiKey= is not process.env.* → hardcoded
                context.report({ node, messageId: 'hardcodedApiKey' });
                return;
              }
            }
          }
        }
      },
    };
  },
};

export const tiptapScriptSrcHardcodedApiKeyRule = rule;
export default rule;
