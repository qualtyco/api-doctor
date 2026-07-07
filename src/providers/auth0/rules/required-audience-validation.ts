/**
 * Flags manual Auth0 JWT verification (jsonwebtoken + jwks-rsa, or express-jwt)
 * configured with RS256 + issuer but no unconditional `audience` check.
 *
 * Either verification path is accepted as equally valid — this rule does not
 * prefer middleware over direct verification or vice versa. Auth0's Node.js
 * guidance (https://auth0.com/docs/secure/tokens/json-web-tokens/validate-json-web-tokens)
 * covers both: calling `jwt.verify()` directly from `jsonwebtoken`, or using
 * `express-jwt` middleware (which wraps the same verification). Whichever
 * pattern a project uses, the only thing that matters is that `audience` is
 * always present, not just when some env var happens to be set.
 */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Auth0 JWT verification must require audience validation, not skip it when unconfigured',
      category: 'security',
      cwe: 'CWE-345',
      owasp: 'API2:2023 Broken Authentication',
      rationale:
        'Signature and issuer checks alone only prove a token was signed by the Auth0 tenant — they do not prove the token was issued for this API. Without a mandatory audience check, any validly signed token from the same tenant (including one issued for a completely different application) will authenticate successfully. If the audience check is only applied when a config value happens to be set, a misconfiguration silently disables it instead of failing closed.',
      docsUrl: 'https://auth0.com/docs/secure/tokens/json-web-tokens/validate-json-web-tokens',
      recommended: true,
    },
    messages: {
      missingAudience:
        'Auth0 JWT verification is configured without an audience check — any token signed by this tenant, regardless of which API it was issued for, will be accepted.',
      conditionalAudience:
        'Audience validation is only applied conditionally here — if the underlying config value is ever unset, the check silently disappears instead of failing closed.',
    },
  },
  create(context: any) {
    const jwtImportNames = new Set<string>();
    const expressJwtImportNames = new Set<string>();

    function isRS256Algorithms(node: any): boolean {
      if (node?.type !== 'ArrayExpression') return false;
      return (node.elements ?? []).some(
        (el: any) => el?.type === 'Literal' && el.value === 'RS256',
      );
    }

    function isAuth0StyleOptions(objectExpr: any): boolean {
      if (objectExpr?.type !== 'ObjectExpression') return false;
      let hasRS256 = false;
      let hasIssuer = false;
      for (const prop of objectExpr.properties ?? []) {
        if (prop?.type !== 'Property') continue;
        const keyName = prop.key?.type === 'Identifier' ? prop.key.name : prop.key?.value;
        if (keyName === 'algorithms' && isRS256Algorithms(prop.value)) hasRS256 = true;
        if (keyName === 'issuer') hasIssuer = true;
      }
      return hasRS256 && hasIssuer;
    }

    function checkAudience(objectExpr: any): 'ok' | 'missing' | 'conditional' {
      let sawAudienceProperty = false;
      let sawConditionalSpread = false;
      for (const prop of objectExpr.properties ?? []) {
        if (prop?.type === 'Property') {
          const keyName = prop.key?.type === 'Identifier' ? prop.key.name : prop.key?.value;
          if (keyName === 'audience') sawAudienceProperty = true;
        }
        if (prop?.type === 'SpreadElement' && prop.argument?.type === 'ConditionalExpression') {
          sawConditionalSpread = true;
        }
      }
      if (sawAudienceProperty) return 'ok';
      if (sawConditionalSpread) return 'conditional';
      return 'missing';
    }

    function reportIfBad(objectExpr: any, reportNode: any) {
      if (!isAuth0StyleOptions(objectExpr)) return;
      const result = checkAudience(objectExpr);
      if (result === 'missing') {
        context.report({ node: reportNode, messageId: 'missingAudience' });
      } else if (result === 'conditional') {
        context.report({ node: reportNode, messageId: 'conditionalAudience' });
      }
    }

    return {
      ImportDeclaration(node: any) {
        const importSource = node?.source?.value;
        if (importSource === 'jsonwebtoken') {
          for (const s of node.specifiers ?? []) {
            if (
              (s?.type === 'ImportDefaultSpecifier' || s?.type === 'ImportNamespaceSpecifier') &&
              s.local?.type === 'Identifier'
            ) {
              jwtImportNames.add(s.local.name);
            }
          }
        }
        if (importSource === 'express-jwt') {
          for (const s of node.specifiers ?? []) {
            if (s?.local?.type === 'Identifier') expressJwtImportNames.add(s.local.name);
          }
        }
      },

      CallExpression(node: any) {
        const callee = node?.callee;

        // Path 1: direct `jwt.verify(token, key, options)` from jsonwebtoken.
        // Accepted as a fully valid verification path in its own right — not
        // just a fallback for when middleware isn't used.
        if (
          callee?.type === 'MemberExpression' &&
          callee.property?.type === 'Identifier' &&
          callee.property.name === 'verify' &&
          callee.object?.type === 'Identifier' &&
          jwtImportNames.has(callee.object.name)
        ) {
          const optionsArg = node.arguments?.[2];
          if (optionsArg) reportIfBad(optionsArg, node);
          return;
        }

        // Path 2: `expressjwt({ ... })` / `jwt({ ... })` middleware imported
        // from express-jwt. Equally valid to Path 1 — same audience check
        // applies, just against the middleware's config object instead of
        // jwt.verify()'s options argument.
        if (callee?.type === 'Identifier' && expressJwtImportNames.has(callee.name)) {
          const optionsArg = node.arguments?.[0];
          if (optionsArg) reportIfBad(optionsArg, node);
        }
      },
    };
  },
};

export const auth0RequiredAudienceValidationRule = rule;
