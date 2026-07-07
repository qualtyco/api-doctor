function findProp(obj: any, name: string): any {
  if (obj?.type !== 'ObjectExpression') return undefined;
  return (obj.properties ?? []).find(
    (p: any) =>
      p?.type === 'Property' &&
      ((p.key?.type === 'Identifier' && p.key.name === name) ||
        (p.key?.type === 'Literal' && p.key.value === name)),
  );
}

const TOKEN_NAME = /token|session/i;

function isTokenLiteral(node: any): boolean {
  return node?.type === 'Literal' && typeof node.value === 'string' && TOKEN_NAME.test(node.value);
}

/** True when the `.set(...)` receiver is cookie-related: `Cookies.set`, `cookieStore.set`, `cookies().set`, `response.cookies.set`. */
function isCookieReceiver(obj: any): boolean {
  if (obj?.type === 'Identifier') return /cookie/i.test(obj.name);
  if (obj?.type === 'CallExpression' && obj.callee?.type === 'Identifier') return /^cookies$/i.test(obj.callee.name);
  if (obj?.type === 'MemberExpression' && !obj.computed && obj.property?.type === 'Identifier') {
    return /cookie/i.test(obj.property.name);
  }
  return false;
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Firebase ID token stored in a cookie without httpOnly flag',
      category: 'security',
      cwe: 'CWE-1004',
      owasp: 'A05:2021 Security Misconfiguration',
      rationale:
        'Storing a Firebase ID token in a non-httpOnly cookie makes it readable by any JavaScript on the page. An XSS vulnerability can steal the token and impersonate the user. Use the Firebase Admin SDK createSessionCookie flow to issue a proper httpOnly session cookie instead — note httpOnly can only be set from server-side code, never from client-side JavaScript.',
      docsUrl: 'https://firebase.google.com/docs/auth/admin/manage-cookies',
      recommended: true,
    },
    messages: {
      idTokenCookieMissingHttpOnly:
        'Auth token stored in cookie without httpOnly: true. Any XSS vulnerability can steal the token. Use the Firebase Admin SDK createSessionCookie flow instead.',
    },
    schema: [],
  },
  create(context: any) {
    function hasHttpOnlyTrue(optsNode: any): boolean {
      const prop = findProp(optsNode, 'httpOnly');
      return prop?.value?.type === 'Literal' && prop.value.value === true;
    }

    function checkNameValueOptsCall(node: any) {
      const args = node.arguments ?? [];

      // Object form: cookies().set({ name: 'token', value, httpOnly: true })
      if (args.length === 1 && args[0]?.type === 'ObjectExpression') {
        const nameProp = findProp(args[0], 'name');
        if (!isTokenLiteral(nameProp?.value)) return;
        if (!hasHttpOnlyTrue(args[0])) {
          context.report({ node, messageId: 'idTokenCookieMissingHttpOnly' });
        }
        return;
      }

      // Positional form: set(name, value, opts)
      if (!isTokenLiteral(args[0])) return;
      const optsArg = args.length >= 3 ? args[2] : null;
      if (!optsArg || optsArg.type !== 'ObjectExpression' || !hasHttpOnlyTrue(optsArg)) {
        context.report({ node, messageId: 'idTokenCookieMissingHttpOnly' });
      }
    }

    return {
      CallExpression(node: any) {
        const callee = node.callee;

        // setCookie('token', value, opts) — cookies-next and friends
        if (callee?.type === 'Identifier' && callee.name === 'setCookie') {
          checkNameValueOptsCall(node);
          return;
        }

        if (callee?.type !== 'MemberExpression' || callee.computed || callee.property?.type !== 'Identifier') return;

        // res.cookie('token', value, opts) — Express
        if (callee.property.name === 'cookie') {
          checkNameValueOptsCall(node);
          return;
        }

        // Cookies.set / cookies().set / response.cookies.set — js-cookie, Next.js
        if (callee.property.name === 'set' && isCookieReceiver(callee.object)) {
          checkNameValueOptsCall(node);
        }
      },

      // document.cookie = `token=${idToken}` — can never be httpOnly
      AssignmentExpression(node: any) {
        const left = node.left;
        const isDocumentCookie =
          left?.type === 'MemberExpression' &&
          !left.computed &&
          left.object?.type === 'Identifier' &&
          left.object.name === 'document' &&
          left.property?.type === 'Identifier' &&
          left.property.name === 'cookie';
        if (!isDocumentCookie) return;

        const right = node.right;
        const text =
          right?.type === 'Literal' && typeof right.value === 'string'
            ? right.value
            : right?.type === 'TemplateLiteral'
              ? (right.quasis ?? []).map((q: any) => q?.value?.cooked ?? '').join('')
              : '';
        if (/(?:^|;\s*)[^=;]*(?:token|session)[^=;]*=/i.test(text)) {
          context.report({ node, messageId: 'idTokenCookieMissingHttpOnly' });
        }
      },
    };
  },
};

export const firebaseIdTokenCookieFlagsRule = rule;
export default rule;
