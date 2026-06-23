/**
 * firebase-missing-app-check (security)
 *
 * A file that initializes the Firebase app (`initializeApp(...)`) but never
 * calls `initializeAppCheck` anywhere in the same file is flagged. The
 * Firebase web API key is public by design — Security Rules and App Check
 * are the only things gating access, so an app-init file with no App Check
 * call leaves the project open to any client presenting a valid project
 * config, not just this app.
 */
import { isIdentifierCall, isInsideTestFile, isNamespaceMemberCall, namedImportsFrom, namespaceImportFrom } from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Firebase app initialization should configure App Check',
      category: 'security',
      cwe: 'CWE-285',
      owasp: 'A04:2021 Insecure Design',
      rationale:
        'Firebase web API keys are public by design and only identify the project to Google\'s backend — they are not a secret. The only things standing between an attacker who clones the client config and your database/auth quota are Security Rules and App Check. A file that calls initializeApp but never initializeAppCheck leaves App Check unconfigured, so any client presenting a valid project config (not necessarily yours) can reach Firebase Auth and, subject to rules, the database.',
      docsUrl: 'https://firebase.google.com/docs/database/web/start',
      recommended: true,
    },
    messages: {
      missingAppCheck:
        'This file initializes the Firebase app but never calls initializeAppCheck. Without App Check, only Security Rules gate access to a publicly-knowable project config.',
    },
    schema: [],
  },
  create(context: any) {
    if (isInsideTestFile(String(context.filename ?? ''))) {
      return {};
    }

    let initializeAppLocalName: string | undefined;
    let initializeAppCheckLocalName: string | undefined;
    let appCheckNamespace: string | undefined;
    let initializeAppCallNode: any | undefined;
    let sawAppCheckCall = false;

    return {
      ImportDeclaration(node: any) {
        const appImports = namedImportsFrom(node, 'firebase/app');
        if (appImports.has('initializeApp')) initializeAppLocalName = appImports.get('initializeApp');

        const appCheckImports = namedImportsFrom(node, 'firebase/app-check');
        if (appCheckImports.has('initializeAppCheck')) {
          initializeAppCheckLocalName = appCheckImports.get('initializeAppCheck');
        }
        const ns = namespaceImportFrom(node, 'firebase/app-check');
        if (ns) appCheckNamespace = ns;
      },
      CallExpression(node: any) {
        if (!initializeAppCallNode && isIdentifierCall(node, initializeAppLocalName)) {
          initializeAppCallNode = node;
        }
        if (isIdentifierCall(node, initializeAppCheckLocalName)) sawAppCheckCall = true;
        if (isNamespaceMemberCall(node, appCheckNamespace, 'initializeAppCheck')) sawAppCheckCall = true;
      },
      'Program:exit'() {
        if (initializeAppCallNode && !sawAppCheckCall) {
          context.report({ node: initializeAppCallNode, messageId: 'missingAppCheck' });
        }
      },
    };
  },
};

export const firebaseMissingAppCheckRule = rule;
export default rule;
