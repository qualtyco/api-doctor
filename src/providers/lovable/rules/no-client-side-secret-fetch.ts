/**
 * Flags a direct `fetch()` to a known LLM provider host carrying an API key
 * read from `import.meta.env.VITE_*` — VITE_-prefixed values are inlined
 * into the browser bundle at build time, so the key ships to every visitor.
 */
import { containsKnownLlmHost } from '../utils.js';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'LLM provider calls must not run client-side with a VITE_-exposed API key',
      category: 'security',
      cwe: 'CWE-522',
      owasp: 'A02:2021 – Cryptographic Failures',
      rationale:
        'Anything read from import.meta.env.VITE_* is inlined into the production JS bundle at build time and is visible to every site visitor via the Network tab or by reading the bundle — no git access required. Lovable documents Edge Functions specifically so the provider key stays server-side in Secrets and the browser calls your own Edge Function instead of the provider directly.',
      docsUrl: 'https://docs.lovable.dev/features/security',
      recommended: true,
    },
    messages: {
      clientSideSecretFetch:
        'This fetch() calls an LLM provider directly with a key sourced from import.meta.env.VITE_* — that key ships into the browser bundle and is visible to every visitor.',
    },
  },
  create(context: any) {
    const viteVars = new Set<string>();

    function propName(node: any): string | undefined {
      if (!node) return undefined;
      if (node.type === 'Identifier') return node.name;
      if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
      return undefined;
    }

    function isImportMetaEnvViteAccess(node: any): boolean {
      if (node?.type !== 'MemberExpression' || node.computed) return false;
      const propertyName = node.property?.name;
      if (typeof propertyName !== 'string' || !propertyName.startsWith('VITE_')) return false;
      const envMember = node.object;
      if (envMember?.type !== 'MemberExpression' || envMember.computed) return false;
      if (envMember.property?.name !== 'env') return false;
      const metaProp = envMember.object;
      return (
        metaProp?.type === 'MetaProperty' &&
        metaProp.meta?.name === 'import' &&
        metaProp.property?.name === 'meta'
      );
    }

    function referencesViteSecret(node: any): boolean {
      if (!node) return false;
      if (isImportMetaEnvViteAccess(node)) return true;
      if (node.type === 'Identifier' && viteVars.has(node.name)) return true;
      if (node.type === 'TemplateLiteral') {
        return (node.expressions ?? []).some((e: any) => referencesViteSecret(e));
      }
      return false;
    }

    return {
      VariableDeclarator(node: any) {
        if (node.id?.type === 'Identifier' && isImportMetaEnvViteAccess(node.init)) {
          viteVars.add(node.id.name);
        }
      },

      CallExpression(node: any) {
        const callee = node.callee;
        if (callee?.type !== 'Identifier' || callee.name !== 'fetch') return;

        const urlArg = node.arguments?.[0];
        if (!containsKnownLlmHost(urlArg)) return;

        const optsArg = node.arguments?.[1];
        if (optsArg?.type !== 'ObjectExpression') return;

        const headersProp = (optsArg.properties ?? []).find(
          (p: any) => p?.type === 'Property' && propName(p.key) === 'headers',
        );
        if (!headersProp || headersProp.value?.type !== 'ObjectExpression') return;

        for (const hp of headersProp.value.properties ?? []) {
          if (hp?.type !== 'Property') continue;
          const keyName = propName(hp.key)?.toLowerCase();
          if (keyName !== 'x-api-key' && keyName !== 'authorization') continue;
          if (referencesViteSecret(hp.value)) {
            context.report({ node, messageId: 'clientSideSecretFetch' });
            return;
          }
        }
      },
    };
  },
};

export const lovableNoClientSideSecretFetchRule = rule;
