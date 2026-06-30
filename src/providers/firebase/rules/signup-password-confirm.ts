import { namedImportsFrom } from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'createUserWithEmailAndPassword called without verifying password matches confirmPassword',
      category: 'correctness',
      rationale:
        'If confirmPassword is collected but never compared to password before account creation, users who mistype their password will successfully create an account they cannot log in to. Always compare password === confirmPassword and bail early on mismatch.',
      docsUrl: 'https://firebase.google.com/docs/auth/web/password-auth',
      recommended: true,
    },
    messages: {
      passwordConfirmNotChecked:
        'createUserWithEmailAndPassword is called without verifying password === confirmPassword. Users who mistype their password will create an account they cannot log in to.',
    },
    schema: [],
  },
  create(context: any) {
    let createUserLocalName: string | undefined;
    let hasConfirmPasswordIdentifier = false;
    let hasPasswordComparison = false;
    const createUserCalls: any[] = [];

    return {
      ImportDeclaration(node: any) {
        const imports = namedImportsFrom(node, 'firebase/auth');
        if (imports.has('createUserWithEmailAndPassword')) {
          createUserLocalName = imports.get('createUserWithEmailAndPassword');
        }
      },

      Identifier(node: any) {
        if (node.name === 'confirmPassword') {
          hasConfirmPasswordIdentifier = true;
        }
      },

      BinaryExpression(node: any) {
        if (node.operator !== '===' && node.operator !== '==' && node.operator !== '!==' && node.operator !== '!=') return;
        const mentionsConfirm = (n: any) =>
          n?.type === 'Identifier' && n.name === 'confirmPassword';
        if (mentionsConfirm(node.left) || mentionsConfirm(node.right)) {
          hasPasswordComparison = true;
        }
      },

      CallExpression(node: any) {
        if (!createUserLocalName) return;
        if (node.callee?.type === 'Identifier' && node.callee.name === createUserLocalName) {
          createUserCalls.push(node);
        }
      },

      'Program:exit'() {
        if (!createUserLocalName) return;
        if (createUserCalls.length === 0) return;
        if (!hasConfirmPasswordIdentifier) return;
        if (hasPasswordComparison) return;
        for (const call of createUserCalls) {
          context.report({ node: call, messageId: 'passwordConfirmNotChecked' });
        }
      },
    };
  },
};

export const firebaseSignupPasswordConfirmRule = rule;
export default rule;
