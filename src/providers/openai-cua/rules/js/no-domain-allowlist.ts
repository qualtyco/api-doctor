/**
 * Flags a function that executes computer-use actions (click/type/goto/fill)
 * against the current page with no origin/domain allowlist check anywhere
 * in that function.
 */
const ACTION_METHOD_NAMES = new Set(['click', 'type', 'press', 'move', 'goto', 'fill', 'dblclick', 'dragAndDrop']);

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Computer-use action execution must check the page origin against an allowlist',
      category: 'security',
      cwe: 'CWE-284',
      owasp: 'A01:2021 – Broken Access Control',
      rationale:
        "OpenAI's Computer Use guide instructs integrators to \"keep an allow list of domains and actions your agent should use, and block everything else.\" Without an origin check before executing actions, a click that follows an off-domain redirect (phishing link, ad, malicious iframe) is executed exactly like any in-domain click — and a field-fill action has no origin awareness either, so credentials could be typed into a page the agent was never meant to reach.",
      docsUrl: 'https://developers.openai.com/api/docs/guides/tools-computer-use',
      recommended: true,
    },
    messages: {
      noOriginCheck:
        'This function executes computer-use actions on the current page with no origin/domain allowlist check anywhere in it.',
    },
  },
  create(context: any) {
    type FnState = { sawAction: boolean; actionNode: any; sawOriginCheck: boolean };
    const stack: any[] = [];
    const states = new Map<any, FnState>();

    function ensureState(fn: any): FnState {
      let s = states.get(fn);
      if (!s) {
        s = { sawAction: false, actionNode: null, sawOriginCheck: false };
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

    function memberChainNames(node: any, names: string[] = []): string[] {
      if (node?.type === 'MemberExpression') {
        memberChainNames(node.object, names);
        const n = propName(node.property);
        if (n) names.push(n);
      } else if (node?.type === 'Identifier') {
        names.push(node.name);
      }
      return names;
    }

    function isPageActionCall(node: any): boolean {
      if (node?.type !== 'CallExpression') return false;
      if (node.callee?.type !== 'MemberExpression') return false;
      const chain = memberChainNames(node.callee);
      if (chain.length === 0) return false;
      const last = chain[chain.length - 1];
      if (!ACTION_METHOD_NAMES.has(last)) return false;
      return chain.some((n) => /^page$/i.test(n) || /page$/i.test(n));
    }

    function markOriginCheckSeen() {
      const fn = top();
      if (fn) ensureState(fn).sawOriginCheck = true;
    }

    return {
      Program(node: any) {
        pushScope(node);
      },
      'Program:exit'() {
        for (const state of states.values()) {
          if (state.sawAction && !state.sawOriginCheck) {
            context.report({ node: state.actionNode, messageId: 'noOriginCheck' });
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
        if (isPageActionCall(node)) {
          const fn = top();
          if (fn) {
            const state = ensureState(fn);
            if (!state.sawAction) {
              state.sawAction = true;
              state.actionNode = node;
            }
          }
        }
      },

      NewExpression(node: any) {
        if (node.callee?.type === 'Identifier' && node.callee.name === 'URL') {
          markOriginCheckSeen();
        }
      },

      MemberExpression(node: any) {
        const name = propName(node.property);
        if (name === 'hostname' || name === 'origin') {
          markOriginCheckSeen();
        }
      },

      Identifier(node: any) {
        if (/allow.?list/i.test(node.name) || /allowed.?domain/i.test(node.name)) {
          markOriginCheckSeen();
        }
      },
    };
  },
};

export const openaiCuaNoDomainAllowlistRule = rule;
