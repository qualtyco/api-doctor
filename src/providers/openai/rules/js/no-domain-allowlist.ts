/**
 * Flags a function that executes computer-use actions (click/type/goto/fill)
 * against the current page with no origin/domain allowlist check anywhere
 * in that function.
 *
 * Page-action calls (`page.click()`, `page.goto()`…) are Playwright's generic
 * API — every ordinary browser test uses them. Nothing is flagged unless the
 * file shows actual computer-use evidence: a `responses.create` call whose
 * arguments mention the computer-use tool/model, or handling of
 * `computer_call` output items.
 */
const ACTION_METHOD_NAMES = new Set(['click', 'type', 'press', 'move', 'goto', 'fill', 'dblclick', 'dragAndDrop']);

/** Model/tool spellings that identify OpenAI computer use. */
const CUA_TOKEN_RE = /computer[-_]?use/i;
/** Response output item types produced by the computer-use tool. */
const CUA_OUTPUT_ITEM_RE = /^computer_call(_output)?$/;

/** Depth-limited recursive search over an ESTree subtree. */
function subtreeHas(node: any, predicate: (n: any) => boolean, depth = 0): boolean {
  if (!node || typeof node !== 'object' || depth > 40) return false;
  if (Array.isArray(node)) {
    return node.some((n) => subtreeHas(n, predicate, depth + 1));
  }
  if (predicate(node)) return true;
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const val = node[key];
    if (val && typeof val === 'object' && subtreeHas(val, predicate, depth + 1)) return true;
  }
  return false;
}

/** True when the subtree mentions the computer-use model/tool or a `type: 'computer'` tool entry. */
function mentionsComputerUse(node: any): boolean {
  return subtreeHas(node, (n) => {
    if (n?.type === 'Literal' && typeof n.value === 'string' && CUA_TOKEN_RE.test(n.value)) return true;
    if (n?.type === 'TemplateElement') {
      const cooked = n.value?.cooked ?? n.value?.raw;
      if (typeof cooked === 'string' && CUA_TOKEN_RE.test(cooked)) return true;
    }
    if (
      n?.type === 'Property' &&
      ((n.key?.type === 'Identifier' && n.key.name === 'type') ||
        (n.key?.type === 'Literal' && n.key.value === 'type')) &&
      n.value?.type === 'Literal' &&
      n.value.value === 'computer'
    ) {
      return true;
    }
    return false;
  });
}

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
    let sawCuaEvidence = false;

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
        // Without computer-use evidence this is just ordinary Playwright
        // (or similar) automation code — never flag it.
        if (!sawCuaEvidence) return;
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
        // `responses.create(...)` whose arguments mention the computer-use
        // model/tool is positive evidence this file drives a CUA loop.
        if (node.callee?.type === 'MemberExpression') {
          const chain = memberChainNames(node.callee);
          if (
            chain.length >= 2 &&
            chain[chain.length - 1] === 'create' &&
            chain[chain.length - 2] === 'responses' &&
            mentionsComputerUse(node.arguments)
          ) {
            sawCuaEvidence = true;
          }
        }

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

      Literal(node: any) {
        if (typeof node.value !== 'string') return;
        // Handling of computer_call/computer_call_output items, or a
        // computer-use-preview model string, ties this file to CUA.
        if (CUA_OUTPUT_ITEM_RE.test(node.value) || /computer[-_]?use[-_]?preview/i.test(node.value)) {
          sawCuaEvidence = true;
        }
      },

      TemplateElement(node: any) {
        const cooked = node?.value?.cooked ?? node?.value?.raw;
        if (typeof cooked !== 'string') return;
        if (/computer[-_]?use[-_]?preview/i.test(cooked)) {
          sawCuaEvidence = true;
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

export const openaiNoDomainAllowlistRule = rule;
