/**
 * Flags a function that both (a) searches free text for a brace via
 * indexOf/lastIndexOf, and (b) calls JSON.parse on a slice/substring of
 * that text — manual brace-hunting JSON extraction instead of the
 * Responses API's structured tool/function output.
 */
const BRACE_SEARCH_METHODS = new Set(['indexOf', 'lastIndexOf']);
const SLICE_METHODS = new Set(['slice', 'substring', 'substr']);

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Step metadata must come from structured tool output, not brace-hunting in free text',
      category: 'correctness',
      rationale:
        'Manually locating a JSON object inside a free-text model message (via indexOf/lastIndexOf plus a slice) is fragile by construction: it breaks if the model adds trailing commentary, wraps the JSON in a markdown fence, or reorders fields. The Responses API supports function tools and structured output specifically so required metadata is schema-validated by the API instead of regex/brace-scraped out of arbitrary text.',
      docsUrl: 'https://developers.openai.com/api/docs/guides/tools-computer-use',
      recommended: true,
    },
    messages: {
      textJsonExtraction:
        'This function locates a JSON object in free text via indexOf/lastIndexOf and parses a slice of it — use a function tool or structured output instead of brace-hunting in the model\'s text message.',
    },
  },
  create(context: any) {
    type FnState = { sawBraceSearch: boolean; sawJsonParseOnSlice: boolean; reportNode: any };
    const stack: any[] = [];
    const states = new Map<any, FnState>();

    function ensureState(fn: any): FnState {
      let s = states.get(fn);
      if (!s) {
        s = { sawBraceSearch: false, sawJsonParseOnSlice: false, reportNode: null };
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

    function isBraceSearchCall(node: any): boolean {
      if (node?.type !== 'CallExpression') return false;
      const callee = node.callee;
      if (callee?.type !== 'MemberExpression') return false;
      if (!BRACE_SEARCH_METHODS.has(callee.property?.name)) return false;
      const arg = node.arguments?.[0];
      return arg?.type === 'Literal' && typeof arg.value === 'string' && arg.value.includes('{');
    }

    function isJsonParseOnSliceCall(node: any): boolean {
      if (node?.type !== 'CallExpression') return false;
      const callee = node.callee;
      if (callee?.type !== 'MemberExpression') return false;
      if (callee.object?.type !== 'Identifier' || callee.object.name !== 'JSON') return false;
      if (callee.property?.name !== 'parse') return false;
      const arg = node.arguments?.[0];
      if (arg?.type !== 'CallExpression') return false;
      const argCallee = arg.callee;
      return argCallee?.type === 'MemberExpression' && SLICE_METHODS.has(argCallee.property?.name);
    }

    return {
      Program(node: any) {
        pushScope(node);
      },
      'Program:exit'() {
        for (const state of states.values()) {
          if (state.sawBraceSearch && state.sawJsonParseOnSlice) {
            context.report({ node: state.reportNode, messageId: 'textJsonExtraction' });
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
        const fn = top();
        if (!fn) return;
        const state = ensureState(fn);

        if (isBraceSearchCall(node)) {
          state.sawBraceSearch = true;
          if (!state.reportNode) state.reportNode = node;
        }
        if (isJsonParseOnSliceCall(node)) {
          state.sawJsonParseOnSlice = true;
          if (!state.reportNode) state.reportNode = node;
        }
      },
    };
  },
};

export const openaiCuaStructuredStepMetadataNotTextJsonRule = rule;
