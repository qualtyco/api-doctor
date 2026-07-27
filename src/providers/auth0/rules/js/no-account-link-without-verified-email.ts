/**
 * Flags account-linking lookups (findOne/findUnique/findFirst keyed on
 * `email`) fed by an unverified OIDC `email` claim, within a function that
 * never checks `email_verified` anywhere.
 */
const CLAIMS_LIKE_NAMES = new Set([
  'claims',
  'decoded',
  'payload',
  'profile',
  'userinfo',
  'userInfo',
  'idTokenClaims',
  'tokenClaims',
]);

const LOOKUP_METHODS = new Set(['findOne', 'findUnique', 'findFirst']);

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Account-linking lookups keyed on an email claim must verify email_verified first',
      category: 'security',
      cwe: 'CWE-290',
      owasp: 'API2:2023 Broken Authentication',
      rationale:
        'By default, Auth0 access tokens carry no email claim at all — the email most apps trust arrives via a custom namespaced claim or the /userinfo fallback, neither of which is cryptographically tied to proof of ownership the way `sub` is. Using that email to look up and re-link an existing account, without first checking `email_verified`, lets an attacker who controls (or can register) an Auth0 identity with an unverified or spoofed email silently take over any existing account that happens to share it.',
      docsUrl: 'https://auth0.com/docs/manage-users/user-accounts/user-account-linking',
      recommended: true,
    },
    messages: {
      unverifiedEmailLink:
        'This account lookup is keyed on an email claim, but nothing in this function checks email_verified first — an unverified or attacker-supplied email can silently take over an existing account.',
    },
  },
  create(context: any) {
    type FnState = { sawLookup: boolean; lookupNode: any; sawVerified: boolean };
    const stack: any[] = [];
    const states = new Map<any, FnState>();

    function ensureState(fn: any): FnState {
      let s = states.get(fn);
      if (!s) {
        s = { sawLookup: false, lookupNode: null, sawVerified: false };
        states.set(fn, s);
      }
      return s;
    }

    function top(): any {
      return stack[stack.length - 1];
    }

    function pushScope(node: any) {
      stack.push(node);
      ensureState(node);
    }

    function popScope() {
      stack.pop();
    }

    function propName(node: any): string | undefined {
      if (!node) return undefined;
      if (node.type === 'Identifier') return node.name;
      if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
      return undefined;
    }

    function isEmailFromClaims(node: any): boolean {
      if (node?.type !== 'MemberExpression') return false;
      const propertyName = node.computed ? propName(node.property) : node.property?.name;
      if (propertyName !== 'email') return false;
      const obj = node.object;
      return obj?.type === 'Identifier' && CLAIMS_LIKE_NAMES.has(obj.name);
    }

    function objectHasEmailFromClaims(objExpr: any): boolean {
      if (objExpr?.type !== 'ObjectExpression') return false;
      for (const prop of objExpr.properties ?? []) {
        if (prop?.type !== 'Property') continue;
        const keyName = propName(prop.key);
        if (keyName === 'email' && isEmailFromClaims(prop.value)) return true;
        if (keyName === 'where' && objectHasEmailFromClaims(prop.value)) return true;
      }
      return false;
    }

    function markVerifiedSeen(name: string | undefined) {
      if (!name || !name.includes('email_verified')) return;
      const fn = top();
      if (fn) ensureState(fn).sawVerified = true;
    }

    return {
      Program(node: any) {
        pushScope(node);
      },
      'Program:exit'() {
        for (const state of states.values()) {
          if (state.sawLookup && !state.sawVerified) {
            context.report({ node: state.lookupNode, messageId: 'unverifiedEmailLink' });
          }
        }
      },

      FunctionDeclaration(node: any) {
        pushScope(node);
      },
      'FunctionDeclaration:exit'() {
        popScope();
      },
      FunctionExpression(node: any) {
        pushScope(node);
      },
      'FunctionExpression:exit'() {
        popScope();
      },
      ArrowFunctionExpression(node: any) {
        pushScope(node);
      },
      'ArrowFunctionExpression:exit'() {
        popScope();
      },

      CallExpression(node: any) {
        const callee = node?.callee;
        if (callee?.type !== 'MemberExpression') return;
        const methodName = callee.property?.name;
        if (!methodName || !LOOKUP_METHODS.has(methodName)) return;
        const arg = node.arguments?.[0];
        if (!objectHasEmailFromClaims(arg)) return;
        const fn = top();
        if (!fn) return;
        const state = ensureState(fn);
        state.sawLookup = true;
        state.lookupNode = node;
      },

      MemberExpression(node: any) {
        const propertyName = node.computed ? propName(node.property) : node.property?.name;
        markVerifiedSeen(propertyName);
      },

      Literal(node: any) {
        if (typeof node.value === 'string') markVerifiedSeen(node.value);
      },
    };
  },
};

export const auth0NoAccountLinkWithoutVerifiedEmailRule = rule;
