import { namedImportsFrom } from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'initializeApp called without checking getApps() first — risk of duplicate-app crash',
      category: 'correctness',
      rationale:
        'Calling initializeApp() when the default app already exists throws "Firebase App named [DEFAULT] already exists". Always guard with getApps().length to make initialization idempotent across hot reloads and server-side rendering.',
      docsUrl: 'https://firebase.google.com/docs/projects/multiprojects',
      recommended: true,
    },
    messages: {
      duplicateInitializeApp:
        'initializeApp() called without checking getApps() first. Calling it twice throws "Firebase App already exists". Use: getApps().length ? getApp() : initializeApp(config)',
    },
    schema: [],
  },
  create(context: any) {
    let initializeAppLocalName: string | undefined;
    let hasGetAppsCall = false;
    const initializeAppCalls: any[] = [];

    const FIREBASE_APP_SOURCES = new Set(['firebase/app', 'firebase-admin/app', 'firebase-admin']);

    return {
      ImportDeclaration(node: any) {
        for (const src of FIREBASE_APP_SOURCES) {
          const imports = namedImportsFrom(node, src);
          if (imports.has('initializeApp')) {
            initializeAppLocalName = imports.get('initializeApp');
          }
        }
      },

      CallExpression(node: any) {
        const callee = node.callee;
        if (callee?.type !== 'Identifier') return;

        if (initializeAppLocalName && callee.name === initializeAppLocalName) {
          // initializeApp(config, 'name') creates a named secondary app — no collision with [DEFAULT]
          if ((node.arguments ?? []).length < 2) {
            initializeAppCalls.push(node);
          }
        }

        // getApp() inside try/catch is the other idempotency pattern — treat both as guards
        if (callee.name === 'getApps' || callee.name === 'getApp') {
          hasGetAppsCall = true;
        }
      },

      'Program:exit'() {
        if (hasGetAppsCall) return;
        for (const call of initializeAppCalls) {
          context.report({ node: call, messageId: 'duplicateInitializeApp' });
        }
      },
    };
  },
};

export const firebaseDuplicateInitializeAppRule = rule;
export default rule;
