/**
 * Flags a function that calls responses.create() and treats "no tool calls
 * in the output" as a successful completion, without ever checking
 * response.status === 'incomplete' anywhere in that function — a
 * token-budget truncation can produce the same shape and be silently
 * misreported as a voluntary, successful finish.
 */
import { findResponsesCreateCall } from '../utils.js';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'A completion check must rule out response.status === "incomplete" before reporting success',
      category: 'reliability',
      rationale:
        'The Responses API can return status "incomplete" with zero visible message output when generation is cut off by the token budget — the same shape ("no computer_call, no message") a purely structural completion check treats as "the model voluntarily finished." Without checking response.status, a token-budget truncation can be silently reported as a successful task completion.',
      docsUrl: 'https://developers.openai.com/api/docs/guides/tools-computer-use',
      recommended: true,
    },
    messages: {
      missingIncompleteCheck:
        'This treats the absence of tool calls as a successful completion, but never checks response.status === "incomplete" — a token-budget truncation can be misreported as success.',
    },
  },
  create(context: any) {
    type FnState = { sawCreateCall: boolean; sawSuccessReturn: boolean; successNode: any; sawStatusCheck: boolean };
    const stack: any[] = [];
    const states = new Map<any, FnState>();

    function ensureState(fn: any): FnState {
      let s = states.get(fn);
      if (!s) {
        s = { sawCreateCall: false, sawSuccessReturn: false, successNode: null, sawStatusCheck: false };
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

    function isSuccessObjectLiteral(node: any): boolean {
      if (node?.type !== 'ObjectExpression') return false;
      return (node.properties ?? []).some((p: any) => {
        if (p?.type !== 'Property') return false;
        const keyName = propName(p.key);
        return (
          (keyName === 'success' || keyName === 'completed') &&
          p.value?.type === 'Literal' &&
          p.value.value === true
        );
      });
    }

    return {
      Program(node: any) {
        pushScope(node);
      },
      'Program:exit'() {
        for (const state of states.values()) {
          if (state.sawCreateCall && state.sawSuccessReturn && !state.sawStatusCheck) {
            context.report({ node: state.successNode, messageId: 'missingIncompleteCheck' });
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
        if (findResponsesCreateCall(node)) {
          const fn = top();
          if (fn) ensureState(fn).sawCreateCall = true;
        }
      },

      ObjectExpression(node: any) {
        if (isSuccessObjectLiteral(node)) {
          const fn = top();
          if (fn) {
            const state = ensureState(fn);
            if (!state.sawSuccessReturn) {
              state.sawSuccessReturn = true;
              state.successNode = node;
            }
          }
        }
      },

      BinaryExpression(node: any) {
        if (node.operator !== '===' && node.operator !== '==') return;
        const sides = [node.left, node.right];
        const statusSide = sides.find((s) => s?.type === 'MemberExpression' && propName(s.property) === 'status');
        const valueSide = sides.find((s) => s !== statusSide);
        if (statusSide && valueSide?.type === 'Literal' && valueSide.value === 'incomplete') {
          const fn = top();
          if (fn) ensureState(fn).sawStatusCheck = true;
        }
      },
    };
  },
};

export const openaiCuaCheckResponseStatusIncompleteRule = rule;
