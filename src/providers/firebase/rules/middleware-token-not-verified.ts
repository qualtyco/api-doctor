const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Next.js middleware reads auth cookie but never verifies it',
      category: 'security',
      cwe: 'CWE-345',
      owasp: 'A07:2021 Identification and Authentication Failures',
      rationale:
        'Checking only that an auth cookie is non-empty does not verify the token. An attacker who sets any non-empty cookie value will bypass the guard entirely. The middleware must call verifySessionCookie or verifyIdToken to confirm the token is valid and unexpired.',
      docsUrl: 'https://firebase.google.com/docs/auth/admin/manage-cookies#verify_session_cookies_and_check_permissions',
      recommended: true,
    },
    messages: {
      tokenNotVerified:
        'Middleware reads the auth cookie but never verifies it. Any non-empty cookie value bypasses the guard. Call adminAuth.verifySessionCookie() or verifyIdToken() before allowing access.',
    },
    schema: [],
  },
  create(context: any) {
    const AUTH_COOKIE_NAMES = /token|session/i;
    const VERIFY_METHOD_NAMES = new Set(['verifySessionCookie', 'verifyIdToken', 'verify']);

    let readsCookieWithAuthName = false;
    let hasVerifyCall = false;
    const cookieReadNodes: any[] = [];

    function isAuthCookieGet(node: any): boolean {
      // request.cookies.get("token") or similar
      if (node?.type !== 'CallExpression') return false;
      const callee = node.callee;
      if (callee?.type !== 'MemberExpression') return false;
      if (callee.property?.type !== 'Identifier' || callee.property.name !== 'get') return false;
      // First arg must be a string literal with a token-like name
      const arg = node.arguments?.[0];
      if (arg?.type !== 'Literal' || typeof arg.value !== 'string') return false;
      return AUTH_COOKIE_NAMES.test(arg.value);
    }

    return {
      CallExpression(node: any) {
        if (isAuthCookieGet(node)) {
          readsCookieWithAuthName = true;
          cookieReadNodes.push(node);
        }

        // Check for verify calls
        const callee = node.callee;
        if (callee?.type === 'Identifier' && VERIFY_METHOD_NAMES.has(callee.name)) {
          hasVerifyCall = true;
        }
        if (
          callee?.type === 'MemberExpression' &&
          callee.property?.type === 'Identifier' &&
          VERIFY_METHOD_NAMES.has(callee.property.name)
        ) {
          hasVerifyCall = true;
        }
      },

      'Program:exit'() {
        if (readsCookieWithAuthName && !hasVerifyCall) {
          for (const node of cookieReadNodes) {
            context.report({ node, messageId: 'tokenNotVerified' });
          }
        }
      },
    };
  },
};

export const firebaseMiddlewareTokenNotVerifiedRule = rule;
export default rule;
