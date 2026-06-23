/**
 * Flags `String(claims.foo_verified).includes('x')` / `claims.foo_verified.toString().includes('x')`
 * checks against a boolean OIDC claim — stringifying a boolean produces
 * only "true" or "false", so any substring check other than those two
 * literal strings can never match and the guard is dead code.
 */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A stringified boolean OIDC claim is checked with .includes() against a substring it can never contain',
      category: 'correctness',
      rationale:
        'Boolean OIDC claims like email_verified/phone_verified stringify to exactly "true" or "false". A .includes() check against any other substring is always false, so the guard this code appears to implement never runs — silently disabling whatever verification it was meant to perform.',
      docsUrl: 'https://auth0.com/docs/secure/tokens/json-web-tokens/json-web-token-claims',
      recommended: true,
    },
    messages: {
      deadVerificationCheck:
        'Stringifying this boolean claim only ever produces "true" or "false" — checking .includes("{{substring}}") against it is always false and never executes its guarded branch.',
    },
  },
  create(context: any) {
    function propName(node: any): string | undefined {
      if (!node) return undefined;
      if (node.type === 'Identifier') return node.name;
      if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
      return undefined;
    }

    function isBooleanClaimMember(node: any): boolean {
      if (node?.type !== 'MemberExpression') return false;
      const name = propName(node.property);
      return typeof name === 'string' && name.toLowerCase().endsWith('_verified');
    }

    // String(claims.email_verified) / String(claims.email_verified ?? '')
    function stringifiedClaimArg(callExpr: any): boolean {
      if (callExpr?.type !== 'CallExpression') return false;
      if (callExpr.callee?.type !== 'Identifier' || callExpr.callee.name !== 'String') return false;
      const arg = callExpr.arguments?.[0];
      if (isBooleanClaimMember(arg)) return true;
      // String(claims.email_verified ?? '')
      if (arg?.type === 'LogicalExpression' && arg.operator === '??') {
        return isBooleanClaimMember(arg.left);
      }
      return false;
    }

    // claims.email_verified.toString()
    function isClaimToStringCall(callExpr: any): boolean {
      if (callExpr?.type !== 'CallExpression') return false;
      const callee = callExpr.callee;
      if (callee?.type !== 'MemberExpression') return false;
      if (callee.property?.name !== 'toString') return false;
      return isBooleanClaimMember(callee.object);
    }

    return {
      CallExpression(node: any) {
        const callee = node?.callee;
        if (callee?.type !== 'MemberExpression') return;
        if (callee.property?.name !== 'includes') return;

        const subject = callee.object;
        const isDeadShape = stringifiedClaimArg(subject) || isClaimToStringCall(subject);
        if (!isDeadShape) return;

        const substringArg = node.arguments?.[0];
        if (substringArg?.type !== 'Literal' || typeof substringArg.value !== 'string') return;

        // "true"/"false" are the only strings a stringified boolean can ever
        // contain, so a check against exactly one of those is functional
        // (if unidiomatic), not dead.
        if (substringArg.value === 'true' || substringArg.value === 'false') return;

        context.report({
          node,
          messageId: 'deadVerificationCheck',
          data: { substring: substringArg.value },
        });
      },
    };
  },
};

export const auth0DeadClaimVerificationCheckRule = rule;
