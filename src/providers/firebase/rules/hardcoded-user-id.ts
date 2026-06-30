const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Hardcoded string used as userId in Firestore operations',
      category: 'security',
      cwe: 'CWE-284',
      owasp: 'A01:2021 Broken Access Control',
      rationale:
        'A hardcoded userId causes all users to share a single Firestore document. The last writer overwrites everyone else\'s data, and when security rules are tightened the writes are rejected. The userId must always come from the authenticated user object.',
      docsUrl: 'https://firebase.google.com/docs/auth/web/manage-users',
      recommended: true,
    },
    messages: {
      hardcodedUserId:
        'Hardcoded userId found. All users share this document. Read the userId from the authenticated user: const { user } = useAuth(); user?.uid',
    },
    schema: [],
  },
  create(context: any) {
    const USER_ID_NAMES = new Set(['userId', 'uid', 'userID', 'user_id']);

    return {
      VariableDeclarator(node: any) {
        if (node.id?.type !== 'Identifier') return;
        if (!USER_ID_NAMES.has(node.id.name)) return;
        const init = node.init;
        if (!init) return;
        // Flag when init is a plain string literal (not env access, not member expression)
        if (init.type === 'Literal' && typeof init.value === 'string' && init.value.length > 0) {
          context.report({ node, messageId: 'hardcodedUserId' });
        }
      },
    };
  },
};

export const firebaseHardcodedUserIdRule = rule;
export default rule;
