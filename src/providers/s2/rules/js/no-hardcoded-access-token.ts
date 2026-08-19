/**
 * s2-no-hardcoded-access-token (security)
 *
 * Flags string literals supplied as an S2 `accessToken` — directly in the
 * property or via a const initialized from a literal. Tokens must come from
 * process.env.S2_ACCESS_TOKEN or a secret store. Inspects AST string values
 * only, so token-looking text in comments is never matched; member
 * expressions (e.g. `issued.accessToken`) and env reads are accepted.
 */
import { createS2FileTracker, unwrapExpr } from '../../utils.js';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'S2 access tokens must not be hardcoded; load them from the environment',
      category: 'security',
      cwe: 'CWE-798',
      owasp: 'API8:2023 Security Misconfiguration',
      rationale:
        'A literal token in new S2({ accessToken: "..." }) gets committed to source control and lives in git history forever. S2 tokens are bearer credentials scoped to whatever the issuer granted — often the whole account — so a leaked literal can read, write, and delete streams. Reading process.env.S2_ACCESS_TOKEN keeps the secret out of source and lets you rotate it without a redeploy.',
      docsUrl: 'https://s2.dev/docs/sdk/access-tokens',
      recommended: true,
    },
    messages: {
      hardcodedToken:
        'Hardcoded S2 access token. Read it from process.env.S2_ACCESS_TOKEN (or a secret store) and throw if unset.',
    },
    schema: [],
  },
  create(context: any) {
    const tracker = createS2FileTracker();
    /** const name → true when initialized from a string literal. */
    const stringConsts = new Set<string>();
    const candidates: any[] = [];

    function isStringLiteralish(n: any): boolean {
      const v = unwrapExpr(n);
      if (v?.type === 'Literal' && typeof v.value === 'string' && v.value.length > 0) return true;
      // Template with no interpolation is still a fixed secret.
      return v?.type === 'TemplateLiteral' && (v.expressions ?? []).length === 0;
    }

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },

      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      VariableDeclarator(node: any) {
        if (node?.id?.type === 'Identifier' && isStringLiteralish(node.init)) {
          stringConsts.add(node.id.name);
        }
      },

      Property(node: any) {
        const isTokenKey =
          (node?.key?.type === 'Identifier' && !node.computed && node.key.name === 'accessToken') ||
          (node?.key?.type === 'Literal' && node.key.value === 'accessToken');
        if (!isTokenKey || node.shorthand) return;
        const value = unwrapExpr(node.value);
        if (isStringLiteralish(value)) {
          candidates.push(node);
          return;
        }
        if (value?.type === 'Identifier' && stringConsts.has(value.name)) {
          candidates.push(node);
        }
      },

      'Program:exit'() {
        if (!tracker.isS2File()) return;
        for (const node of candidates) {
          context.report({ node, messageId: 'hardcodedToken' });
        }
      },
    };
  },
};

export const s2NoHardcodedAccessTokenRule = rule;
