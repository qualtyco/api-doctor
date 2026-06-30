import { someDescendant } from '../utils.js';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Firestore security rules contain a hard-coded expiry date that has already passed',
      category: 'security',
      cwe: 'CWE-284',
      owasp: 'A01:2021 Broken Access Control',
      rationale:
        'The Firebase "get started" rules template includes a timestamp.date() expiry. Once that date passes the condition permanently evaluates to false, denying every client read and write. Replace with proper auth-based rules scoped to the authenticated user.',
      docsUrl: 'https://firebase.google.com/docs/firestore/security/insecure-rules',
      recommended: true,
    },
    messages: {
      firestoreRulesExpired:
        'Firestore security rules contain a hard-coded expiry date that has already passed. All client reads and writes are permanently denied. Replace with proper auth-based rules.',
    },
    schema: [],
  },
  create(context: any) {
    const EXPIRED_YEAR = 2025;

    function checkStringForExpiredDate(value: string, reportNode: any) {
      const re = /timestamp\.date\(\s*(\d{4})\s*,/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(value)) !== null) {
        const year = parseInt(match[1], 10);
        if (year <= EXPIRED_YEAR) {
          context.report({ node: reportNode, messageId: 'firestoreRulesExpired' });
          return;
        }
      }
    }

    return {
      Literal(node: any) {
        if (typeof node.value !== 'string') return;
        checkStringForExpiredDate(node.value, node);
      },
      TemplateLiteral(node: any) {
        for (const quasi of node.quasis ?? []) {
          const cooked = quasi?.value?.cooked ?? quasi?.value?.raw ?? '';
          if (typeof cooked === 'string' && cooked.includes('timestamp.date(')) {
            checkStringForExpiredDate(cooked, node);
            return;
          }
        }
      },
    };
  },
};

export const firebaseFirestoreRulesExpiredRule = rule;
export default rule;
