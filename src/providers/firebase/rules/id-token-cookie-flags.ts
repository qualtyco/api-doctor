function findProp(obj: any, name: string): any {
  if (obj?.type !== 'ObjectExpression') return undefined;
  return (obj.properties ?? []).find(
    (p: any) =>
      p?.type === 'Property' &&
      ((p.key?.type === 'Identifier' && p.key.name === name) ||
        (p.key?.type === 'Literal' && p.key.value === name)),
  );
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Firebase ID token stored in a cookie without httpOnly flag',
      category: 'security',
      cwe: 'CWE-1004',
      owasp: 'A02:2021 Cryptographic Failures',
      rationale:
        'Storing a Firebase ID token in a non-httpOnly cookie makes it readable by any JavaScript on the page. An XSS vulnerability can steal the token and impersonate the user. Use the Firebase Admin SDK createSessionCookie flow to issue a proper httpOnly session cookie instead.',
      docsUrl: 'https://firebase.google.com/docs/auth/admin/manage-cookies',
      recommended: true,
    },
    messages: {
      idTokenCookieMissingHttpOnly:
        'Firebase ID token stored in cookie without httpOnly: true. Any XSS vulnerability can steal the token. Use the Firebase Admin SDK createSessionCookie flow instead.',
    },
    schema: [],
  },
  create(context: any) {
    function isTokenName(val: string): boolean {
      return /token/i.test(val);
    }

    function hasHttpOnlyTrue(optsNode: any): boolean {
      if (optsNode?.type !== 'ObjectExpression') return false;
      const prop = findProp(optsNode, 'httpOnly');
      if (!prop) return false;
      return prop.value?.type === 'Literal' && prop.value.value === true;
    }

    return {
      CallExpression(node: any) {
        const callee = node.callee;
        const isCookieSet =
          callee?.type === 'Identifier' && callee.name === 'setCookie';

        if (!isCookieSet) return;

        const args = node.arguments ?? [];
        const nameArg = args[0];
        if (nameArg?.type !== 'Literal' || typeof nameArg.value !== 'string') return;
        if (!isTokenName(nameArg.value)) return;

        // Options is the 3rd arg for setCookie(name, value, opts)
        const optsArg = args.length >= 3 ? args[2] : null;

        if (!optsArg || optsArg.type !== 'ObjectExpression') {
          context.report({ node, messageId: 'idTokenCookieMissingHttpOnly' });
          return;
        }

        if (!hasHttpOnlyTrue(optsArg)) {
          context.report({ node, messageId: 'idTokenCookieMissingHttpOnly' });
        }
      },
    };
  },
};

export const firebaseIdTokenCookieFlagsRule = rule;
export default rule;
