/**
 * Flags a function that both (a) searches free text for a brace via
 * indexOf/lastIndexOf, and (b) calls JSON.parse on a slice/substring of
 * that text — manual brace-hunting JSON extraction instead of the
 * Responses API's structured tool/function output.
 *
 * indexOf('{') + slice + JSON.parse is a universal "extract JSON from a
 * string" idiom (log parsing, config munging…), so the sliced string must
 * verifiably trace to a CUA response before anything is flagged: the parse
 * receiver either mentions `output_text`/a `responses.create` result
 * directly, or is a variable derived (transitively) from one.
 */
const BRACE_SEARCH_METHODS = new Set(['indexOf', 'lastIndexOf']);
const SLICE_METHODS = new Set(['slice', 'substring', 'substr']);

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

/** True when the subtree contains a `<...>.responses.create(...)` call. */
function hasResponsesCreateCall(node: any): boolean {
  return subtreeHas(node, (n) => {
    if (n?.type !== 'CallExpression' || n.callee?.type !== 'MemberExpression') return false;
    const callee = n.callee;
    if (callee.property?.type !== 'Identifier' || callee.property.name !== 'create') return false;
    const obj = callee.object;
    if (obj?.type === 'MemberExpression') {
      return obj.property?.type === 'Identifier' && obj.property.name === 'responses';
    }
    return obj?.type === 'Identifier' && obj.name === 'responses';
  });
}

/** True when the subtree accesses the Responses API text output (`output_text`). */
function hasOutputTextAccess(node: any): boolean {
  return subtreeHas(node, (n) => {
    if (n?.type === 'MemberExpression' && n.property?.type === 'Identifier' && n.property.name === 'output_text') {
      return true;
    }
    if (n?.type === 'Property' && n.key?.type === 'Identifier' && n.key.name === 'output_text') return true;
    return false;
  });
}

/**
 * True when the subtree references any of `names` as a value — walks value
 * positions only, so non-computed member property names and object keys
 * (e.g. the `text` in `foo.text`) never count as references.
 */
function referencesAny(node: any, names: Set<string>, depth = 0): boolean {
  if (!node || typeof node !== 'object' || names.size === 0 || depth > 40) return false;
  if (Array.isArray(node)) {
    return node.some((n) => referencesAny(n, names, depth + 1));
  }
  if (node.type === 'Identifier') return names.has(node.name);
  if (node.type === 'MemberExpression') {
    if (referencesAny(node.object, names, depth + 1)) return true;
    return node.computed ? referencesAny(node.property, names, depth + 1) : false;
  }
  if (node.type === 'Property') {
    if (node.computed && referencesAny(node.key, names, depth + 1)) return true;
    return referencesAny(node.value, names, depth + 1);
  }
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const val = node[key];
    if (val && typeof val === 'object' && referencesAny(val, names, depth + 1)) return true;
  }
  return false;
}

/** Names bound by a declarator id (identifier or destructuring patterns). */
function bindingNames(id: any, out: string[] = [], depth = 0): string[] {
  if (!id || depth > 10) return out;
  if (id.type === 'Identifier') out.push(id.name);
  else if (id.type === 'ObjectPattern') {
    for (const p of id.properties ?? []) {
      if (p?.type === 'Property') bindingNames(p.value, out, depth + 1);
      else if (p?.type === 'RestElement') bindingNames(p.argument, out, depth + 1);
    }
  } else if (id.type === 'ArrayPattern') {
    for (const el of id.elements ?? []) bindingNames(el, out, depth + 1);
  } else if (id.type === 'AssignmentPattern') {
    bindingNames(id.left, out, depth + 1);
  } else if (id.type === 'RestElement') {
    bindingNames(id.argument, out, depth + 1);
  }
  return out;
}

/** Collects every VariableDeclarator in a subtree. */
function collectDeclarators(node: any, out: any[], depth = 0): void {
  if (!node || typeof node !== 'object' || depth > 40) return;
  if (Array.isArray(node)) {
    for (const n of node) collectDeclarators(n, out, depth + 1);
    return;
  }
  if (node.type === 'VariableDeclarator') out.push(node);
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const val = node[key];
    if (val && typeof val === 'object') collectDeclarators(val, out, depth + 1);
  }
}

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
    type FnState = { sawBraceSearch: boolean; jsonParseSliceNodes: any[] };
    const stack: any[] = [];
    const states = new Map<any, FnState>();
    let programNode: any = null;

    function ensureState(fn: any): FnState {
      let s = states.get(fn);
      if (!s) {
        s = { sawBraceSearch: false, jsonParseSliceNodes: [] };
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

    /**
     * Variable names (transitively) derived from a CUA response: seeded by
     * declarators whose init contains `responses.create(...)` or reads
     * `output_text`, then propagated through assignments referencing an
     * already-derived name.
     */
    function computeCuaDerivedNames(): Set<string> {
      const declarators: any[] = [];
      collectDeclarators(programNode, declarators);
      const derived = new Set<string>();
      let changed = true;
      let guard = 0;
      while (changed && guard++ < 10) {
        changed = false;
        for (const d of declarators) {
          if (!d.init) continue;
          const names = bindingNames(d.id);
          if (names.length === 0 || names.every((n) => derived.has(n))) continue;
          if (hasResponsesCreateCall(d.init) || hasOutputTextAccess(d.init) || referencesAny(d.init, derived)) {
            for (const name of names) {
              if (!derived.has(name)) {
                derived.add(name);
                changed = true;
              }
            }
          }
        }
      }
      return derived;
    }

    /** True when the string being sliced verifiably traces to a CUA response. */
    function sliceReceiverIsCuaDerived(parseNode: any, derived: Set<string>): boolean {
      const receiver = parseNode.arguments?.[0]?.callee?.object;
      if (!receiver) return false;
      return hasOutputTextAccess(receiver) || hasResponsesCreateCall(receiver) || referencesAny(receiver, derived);
    }

    return {
      Program(node: any) {
        programNode = node;
        pushScope(node);
      },
      'Program:exit'() {
        let derived: Set<string> | null = null;
        for (const state of states.values()) {
          if (!state.sawBraceSearch || state.jsonParseSliceNodes.length === 0) continue;
          if (!derived) derived = computeCuaDerivedNames();
          const traced = state.jsonParseSliceNodes.find((n) => sliceReceiverIsCuaDerived(n, derived!));
          if (traced) {
            context.report({ node: traced, messageId: 'textJsonExtraction' });
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
        }
        if (isJsonParseOnSliceCall(node)) {
          state.jsonParseSliceNodes.push(node);
        }
      },
    };
  },
};

export const openaiStructuredStepMetadataNotTextJsonRule = rule;
