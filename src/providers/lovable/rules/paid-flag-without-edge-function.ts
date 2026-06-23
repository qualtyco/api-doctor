/**
 * Flags a function that sets a boolean "paid"/"premium"/"boosted"-style flag
 * via a direct Supabase `.update()` call, in a file that advertises a price,
 * with no payment-provider or Edge Function call anywhere in that function.
 */
const PRICE_PATTERN = /\$\s?\d/;
const FLAG_PROPERTY_PATTERN = /^is_[a-z0-9_]+$/i;
const FLAG_SUFFIX_PATTERN = /_(unlocked|active|enabled)$/i;

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A paid feature flag must not be set by a direct database update with no payment-provider call',
      category: 'security',
      cwe: 'CWE-840',
      owasp: 'A04:2021 – Insecure Design',
      rationale:
        'Lovable documents payment processing as Edge Function territory specifically so purchase/premium-access flags are only ever set after a payment provider confirms payment server-side. A handler that writes a paid-looking flag straight from the client with no payment call in between either never actually charges anyone, or — even if a charge happens elsewhere — leaves the flag itself freely settable by any caller with write access to the row.',
      docsUrl: 'https://docs.lovable.dev/features/cloud',
      recommended: true,
    },
    messages: {
      paidFlagWithoutPayment:
        'This sets a paid-looking flag via a direct database update, but nothing in this function calls a payment provider or Edge Function first — the flag can be set without anyone paying.',
    },
  },
  create(context: any) {
    type FnState = { sawFlagUpdate: boolean; updateNode: any; sawPaymentCall: boolean };
    const stack: any[] = [];
    const states = new Map<any, FnState>();
    let sawPriceLabel = false;

    function ensureState(fn: any): FnState {
      let s = states.get(fn);
      if (!s) {
        s = { sawFlagUpdate: false, updateNode: null, sawPaymentCall: false };
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

    function isBooleanFlagProperty(name: string | undefined): boolean {
      if (!name) return false;
      return FLAG_PROPERTY_PATTERN.test(name) || FLAG_SUFFIX_PATTERN.test(name);
    }

    function isSupabaseUpdateCall(node: any): boolean {
      if (node?.type !== 'CallExpression') return false;
      const callee = node.callee;
      return callee?.type === 'MemberExpression' && callee.property?.name === 'update';
    }

    function updateSetsBooleanFlag(node: any): boolean {
      const arg = node.arguments?.[0];
      if (arg?.type !== 'ObjectExpression') return false;
      return (arg.properties ?? []).some(
        (p: any) => p?.type === 'Property' && isBooleanFlagProperty(propName(p.key)),
      );
    }

    function memberChainNames(node: any, names: string[] = []): string[] {
      if (node?.type === 'MemberExpression') {
        memberChainNames(node.object, names);
        const n = propName(node.property);
        if (n) names.push(n);
      } else if (node?.type === 'Identifier') {
        names.push(node.name);
      } else if (node?.type === 'CallExpression') {
        memberChainNames(node.callee, names);
      }
      return names;
    }

    function isPaymentRelatedCall(node: any): boolean {
      if (node?.type !== 'CallExpression') return false;
      const chain = memberChainNames(node.callee).join('.').toLowerCase();
      if (/stripe|checkout|payment/.test(chain)) return true;
      if (chain.includes('functions') && chain.endsWith('.invoke')) return true;
      if (node.callee?.type === 'Identifier' && node.callee.name === 'fetch') {
        const urlArg = node.arguments?.[0];
        if (urlArg?.type === 'Literal' && typeof urlArg.value === 'string') {
          return urlArg.value.includes('/functions/');
        }
        if (urlArg?.type === 'TemplateLiteral') {
          return (urlArg.quasis ?? []).some((q: any) => (q.value?.raw ?? '').includes('/functions/'));
        }
      }
      return false;
    }

    return {
      Program(node: any) {
        pushScope(node);
      },
      'Program:exit'() {
        if (!sawPriceLabel) return;
        for (const state of states.values()) {
          if (state.sawFlagUpdate && !state.sawPaymentCall) {
            context.report({ node: state.updateNode, messageId: 'paidFlagWithoutPayment' });
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

      Literal(node: any) {
        if (typeof node.value === 'string' && PRICE_PATTERN.test(node.value)) sawPriceLabel = true;
      },
      JSXText(node: any) {
        if (typeof node.value === 'string' && PRICE_PATTERN.test(node.value)) sawPriceLabel = true;
      },
      TemplateElement(node: any) {
        if (PRICE_PATTERN.test(node.value?.raw ?? '')) sawPriceLabel = true;
      },

      CallExpression(node: any) {
        const fn = top();
        if (!fn) return;
        const state = ensureState(fn);

        if (isSupabaseUpdateCall(node) && updateSetsBooleanFlag(node) && !state.sawFlagUpdate) {
          state.sawFlagUpdate = true;
          state.updateNode = node;
        }

        if (isPaymentRelatedCall(node)) {
          state.sawPaymentCall = true;
        }
      },
    };
  },
};

export const lovablePaidFlagWithoutEdgeFunctionRule = rule;
