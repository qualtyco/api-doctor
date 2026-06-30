/**
 * tiptap-dynamic-script-no-sri (security)
 *
 * Detects when a script element created with document.createElement('script')
 * is appended to the DOM without setting an integrity (SRI) attribute.
 *
 * Flags:
 *   const script = document.createElement('script');
 *   document.body.appendChild(script); // no integrity set
 *
 * Does NOT flag:
 *   script.setAttribute('integrity', 'sha384-...');
 *   document.body.appendChild(script); // integrity was set
 */

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Dynamically injected script elements must include an SRI integrity attribute',
      category: 'security',
      cwe: 'CWE-829',
      owasp: 'API8:2023 Security Misconfiguration',
      rationale:
        'A script element injected without an integrity attribute will execute whatever the CDN returns, including malicious content if the CDN is compromised. Adding a Subresource Integrity hash (script.setAttribute("integrity", "sha384-...")) lets the browser verify the fetched script matches the expected bytes before executing it.',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity',
      recommended: true,
    },
    messages: {
      missingIntegrity:
        'Dynamically created script element is appended without an integrity (SRI) attribute. Add script.setAttribute("integrity", "sha384-...") before appending.',
    },
    schema: [],
  },
  create(context: any) {
    // Map from variable name → { createNode, appendNode, hasIntegrity }
    const scriptVars = new Map<string, { createNode: any; appendNode: any | null; hasIntegrity: boolean }>();

    function isCreateScriptCall(node: any): string | null {
      // document.createElement('script') stored in a variable
      if (node?.type !== 'CallExpression') return null;
      const callee = node.callee;
      if (callee?.type !== 'MemberExpression') return null;
      if (callee.property?.name !== 'createElement') return null;
      const arg = node.arguments?.[0];
      if (arg?.type !== 'Literal' || arg.value !== 'script') return null;
      return 'script';
    }

    function getVarNameFromDeclarator(node: any): string | null {
      if (node?.type === 'VariableDeclarator' && node.id?.type === 'Identifier') {
        return node.id.name;
      }
      return null;
    }

    function isIntegritySet(node: any, varName: string): boolean {
      // script.setAttribute('integrity', ...) or script['setAttribute']('integrity', ...)
      if (node?.type === 'CallExpression') {
        const callee = node.callee;
        if (
          callee?.type === 'MemberExpression' &&
          callee.object?.type === 'Identifier' &&
          callee.object.name === varName &&
          (callee.property?.name === 'setAttribute' || callee.property?.value === 'setAttribute')
        ) {
          const firstArg = node.arguments?.[0];
          if (firstArg?.type === 'Literal' && firstArg.value === 'integrity') return true;
        }
      }
      // script.integrity = '...'
      if (
        node?.type === 'AssignmentExpression' &&
        node.left?.type === 'MemberExpression' &&
        node.left.object?.type === 'Identifier' &&
        node.left.object.name === varName &&
        node.left.property?.name === 'integrity'
      ) {
        return true;
      }
      return false;
    }

    function isAppendCall(node: any, varName: string): boolean {
      // *.appendChild(varName) or *.append(varName) or *.insertBefore(varName, ...)
      if (node?.type !== 'CallExpression') return false;
      const callee = node.callee;
      if (callee?.type !== 'MemberExpression') return false;
      const methodName = callee.property?.name;
      if (!['appendChild', 'append', 'insertBefore', 'prepend'].includes(methodName)) return false;
      const firstArg = node.arguments?.[0];
      return firstArg?.type === 'Identifier' && firstArg.name === varName;
    }

    return {
      VariableDeclarator(node: any) {
        if (node.init && isCreateScriptCall(node.init)) {
          const name = getVarNameFromDeclarator(node);
          if (name) {
            scriptVars.set(name, { createNode: node, appendNode: null, hasIntegrity: false });
          }
        }
      },

      ExpressionStatement(node: any) {
        const expr = node.expression;
        if (!expr) return;

        for (const [varName, info] of scriptVars) {
          if (isIntegritySet(expr, varName)) {
            info.hasIntegrity = true;
          }
          if (isAppendCall(expr, varName) && !info.appendNode) {
            info.appendNode = node;
          }
        }
      },

      // Also catch assignments: e.g. document.body.innerHTML won't appear here,
      // but handle AssignmentExpression for integrity
      AssignmentExpression(node: any) {
        for (const [varName, info] of scriptVars) {
          if (isIntegritySet(node, varName)) {
            info.hasIntegrity = true;
          }
        }
      },

      'Program:exit'() {
        for (const [, info] of scriptVars) {
          if (info.appendNode && !info.hasIntegrity) {
            context.report({ node: info.appendNode, messageId: 'missingIntegrity' });
          }
        }
      },
    };
  },
};

export const tiptapDynamicScriptNoSriRule = rule;
export default rule;
