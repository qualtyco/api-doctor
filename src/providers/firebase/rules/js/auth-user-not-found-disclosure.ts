const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'auth/user-not-found error code surfaced to the user enables email enumeration',
      category: 'security',
      cwe: 'CWE-204',
      owasp: 'A07:2021 Identification and Authentication Failures',
      rationale:
        'Displaying a distinct message for the auth/user-not-found error code reveals whether an email address is registered. Firebase email enumeration protection (default on since September 2023) stops returning this code — making this branch dead code while still being a security risk on older projects.',
      docsUrl: 'https://firebase.google.com/docs/auth/web/password-auth#enumeration-protection',
      recommended: true,
    },
    messages: {
      userNotFoundDisclosure:
        'Checking for auth/user-not-found exposes whether an email is registered (user enumeration). Show the same generic message for all auth errors.',
    },
    schema: [],
  },
  create(context: any) {
    function isErrorCode(n: any): boolean {
      return (
        n?.type === 'MemberExpression' &&
        !n.computed &&
        n.property?.type === 'Identifier' &&
        n.property.name === 'code'
      );
    }

    function isUserNotFoundLiteral(n: any): boolean {
      return n?.type === 'Literal' && n.value === 'auth/user-not-found';
    }

    return {
      BinaryExpression(node: any) {
        if (node.operator !== '===' && node.operator !== '==' && node.operator !== '!==' && node.operator !== '!=') return;
        if (
          (isErrorCode(node.left) && isUserNotFoundLiteral(node.right)) ||
          (isErrorCode(node.right) && isUserNotFoundLiteral(node.left))
        ) {
          context.report({ node, messageId: 'userNotFoundDisclosure' });
        }
      },

      SwitchCase(node: any) {
        if (isUserNotFoundLiteral(node.test)) {
          context.report({ node, messageId: 'userNotFoundDisclosure' });
        }
      },
    };
  },
};

export const firebaseAuthUserNotFoundDisclosureRule = rule;
export default rule;
