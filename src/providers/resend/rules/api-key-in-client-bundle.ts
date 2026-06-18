/**
 * resend-api-key-in-client-bundle (security)
 *
 * The Resend SDK is server-only; importing it into client-bundled code risks
 * shipping the API key to the browser (Resend's docs say keys belong in
 * server env only). Flags a value import from `resend` when the file
 * is client code:
 *   - it carries a top-level "use client" directive, OR
 *   - it lives under a `components/` path and renders JSX.
 *
 * Type-only imports (`import type { ... } from 'resend'`) are erased at build
 * time and are not flagged.
 */

function isComponentsPath(filename: string): boolean {
  return /[\\/]components[\\/]/.test(filename);
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'The Resend SDK must not be imported into client-bundled code',
      category: 'security',
      cwe: 'CWE-200',
      owasp: 'API8:2023 Security Misconfiguration',
      rationale:
        'The Resend SDK is server-only and is initialized with your secret API key. Importing it into a "use client" component or other browser-bundled code ships that key to every visitor, where it can be read straight from the page source. Keeping Resend imports in server code (route handlers, server actions, server components) ensures the key never reaches the client.',
      docsUrl: 'https://resend.com/docs/send-with-nextjs',
      recommended: true,
    },
    messages: {
      clientBundleImport:
        'Resend is imported into client-bundled code. Keep Resend (and its API key) on the server.',
    },
    schema: [],
  },
  create(context: any) {
    let resendImportNode: any = null;
    let hasUseClient = false;
    let hasJsx = false;

    return {
      Program(node: any) {
        for (const stmt of node.body ?? []) {
          if (stmt?.type !== 'ExpressionStatement') continue;
          const directive =
            stmt.directive ??
            (stmt.expression?.type === 'Literal' ? stmt.expression.value : undefined);
          if (directive === 'use client') {
            hasUseClient = true;
            break;
          }
        }
      },

      ImportDeclaration(node: any) {
        if (node?.source?.value !== 'resend') return;
        // Skip type-only imports — they are stripped from the bundle.
        if (node.importKind === 'type') return;
        const allSpecifiersAreType =
          Array.isArray(node.specifiers) &&
          node.specifiers.length > 0 &&
          node.specifiers.every((s: any) => s.importKind === 'type');
        if (allSpecifiersAreType) return;
        resendImportNode = node;
      },

      JSXElement() {
        hasJsx = true;
      },
      JSXFragment() {
        hasJsx = true;
      },

      'Program:exit'() {
        if (!resendImportNode) return;
        const inClientBundle =
          hasUseClient || (isComponentsPath(String(context.filename ?? '')) && hasJsx);
        if (inClientBundle) {
          context.report({ node: resendImportNode, messageId: 'clientBundleImport' });
        }
      },
    };
  },
};

export const resendApiKeyInClientBundleRule = rule;
export default rule;
