/** Shared AST helpers for OpenAI Realtime provider rules. */

/** True when a URL argument (string or template literal) targets the OpenAI Realtime endpoint. */
export function isOpenAIRealtimeUrlArg(node: any): boolean {
  if (!node) return false;
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value.includes('api.openai.com/v1/realtime');
  }
  if (node.type === 'TemplateLiteral') {
    return (node.quasis ?? []).some(
      (q: any) => typeof q?.value?.raw === 'string' && q.value.raw.includes('api.openai.com/v1/realtime'),
    );
  }
  return false;
}

/**
 * Collects every local variable name whose initializer is a string/template
 * literal containing the OpenAI Realtime URL, e.g. `const url = 'wss://api.openai.com/v1/realtime'`.
 */
export function collectOpenAIRealtimeUrlVarNames(program: any): Set<string> {
  const names = new Set<string>();
  visit(program);
  return names;

  function visit(node: any, depth = 0): void {
    if (!node || typeof node !== 'object' || depth > 40) return;
    if (Array.isArray(node)) {
      for (const n of node) visit(n, depth + 1);
      return;
    }
    if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' && isOpenAIRealtimeUrlArg(node.init)) {
      names.add(node.id.name);
    }
    for (const key of Object.keys(node)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue;
      const val = node[key];
      if (val && typeof val === 'object') visit(val, depth + 1);
    }
  }
}

/**
 * True when `urlArgNode` resolves to the OpenAI Realtime URL — either directly
 * (string/template literal) or via a local variable in `urlVarNames`.
 */
export function isOpenAIRealtimeUrlNode(urlArgNode: any, urlVarNames: Set<string>): boolean {
  if (isOpenAIRealtimeUrlArg(urlArgNode)) return true;
  return urlArgNode?.type === 'Identifier' && urlVarNames.has(urlArgNode.name);
}

/** True for `new WebSocket(<openai realtime url>, ...)`, resolving simple url variables. */
export function isOpenAIRealtimeNewWebSocket(node: any, urlVarNames: Set<string> = new Set()): boolean {
  if (node?.type !== 'NewExpression') return false;
  if (node.callee?.type !== 'Identifier' || node.callee.name !== 'WebSocket') return false;
  return isOpenAIRealtimeUrlNode(node.arguments?.[0], urlVarNames);
}

/** Finds a Property node in an ObjectExpression by its key name (Identifier or string Literal). */
export function findProperty(objectExpression: any, propertyName: string): any {
  if (objectExpression?.type !== 'ObjectExpression') return null;
  for (const prop of objectExpression.properties ?? []) {
    if (prop?.type !== 'Property') continue;
    const key = prop.key;
    const name = key?.type === 'Identifier' ? key.name : key?.type === 'Literal' ? key.value : null;
    if (name === propertyName) return prop;
  }
  return null;
}

/**
 * Walks a VariableDeclarator's `init` (unwrapping `new WebSocket(...)` directly assigned to a
 * variable, e.g. `const callerSocket = new WebSocket(url, opts)`) and collects every local
 * variable name initialized to an OpenAI Realtime WebSocket.
 */
export function collectOpenAIRealtimeSocketVarNames(program: any): Set<string> {
  const urlVarNames = collectOpenAIRealtimeUrlVarNames(program);
  const names = new Set<string>();
  visit(program);
  return names;

  function visit(node: any, depth = 0): void {
    if (!node || typeof node !== 'object' || depth > 40) return;
    if (Array.isArray(node)) {
      for (const n of node) visit(n, depth + 1);
      return;
    }
    if (
      node.type === 'VariableDeclarator' &&
      node.id?.type === 'Identifier' &&
      isOpenAIRealtimeNewWebSocket(node.init, urlVarNames)
    ) {
      names.add(node.id.name);
    }
    // Also handle `this.#socket = new WebSocket(...)` / `this.socket = new WebSocket(...)`.
    if (
      node.type === 'AssignmentExpression' &&
      node.operator === '=' &&
      isOpenAIRealtimeNewWebSocket(node.right, urlVarNames)
    ) {
      const left = node.left;
      if (left?.type === 'Identifier') {
        names.add(left.name);
      } else if (left?.type === 'MemberExpression' && left.property) {
        const propName = left.property.name;
        if (typeof propName === 'string') names.add(propName);
      }
    }
    for (const key of Object.keys(node)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue;
      const val = node[key];
      if (val && typeof val === 'object') visit(val, depth + 1);
    }
  }
}

/** True when `objNode` refers to a tracked socket variable, either `socket` or `this.#socket`/`this.socket`. */
export function isTrackedSocketRef(objNode: any, socketVarNames: Set<string>): boolean {
  if (objNode?.type === 'Identifier') return socketVarNames.has(objNode.name);
  if (objNode?.type === 'MemberExpression' && objNode.property) {
    const propName = objNode.property.name;
    return typeof propName === 'string' && socketVarNames.has(propName);
  }
  return false;
}

/** True for `<socketVar>.on(<eventName>, <handler>)` where socketVar is one of `socketVarNames`. */
export function isSocketOnCall(node: any, socketVarNames: Set<string>, eventName: string): boolean {
  if (node?.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee?.type !== 'MemberExpression') return false;
  const prop = callee.property;
  if (prop?.type !== 'Identifier' || prop.name !== 'on') return false;
  if (!isTrackedSocketRef(callee.object, socketVarNames)) return false;
  const firstArg = node.arguments?.[0];
  return firstArg?.type === 'Literal' && firstArg.value === eventName;
}

/** Collects `const name = '<string literal>'` / `const name = \`<plain template>\`` values. */
export function collectStringVarValues(program: any): Map<string, string> {
  const values = new Map<string, string>();
  visit(program);
  return values;

  function visit(node: any, depth = 0): void {
    if (!node || typeof node !== 'object' || depth > 40) return;
    if (Array.isArray(node)) {
      for (const n of node) visit(n, depth + 1);
      return;
    }
    if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier') {
      const init = node.init;
      if (init?.type === 'Literal' && typeof init.value === 'string') {
        values.set(node.id.name, init.value);
      } else if (init?.type === 'TemplateLiteral' && (init.expressions ?? []).length === 0) {
        values.set(node.id.name, (init.quasis ?? []).map((q: any) => q.value?.raw ?? '').join(''));
      }
    }
    for (const key of Object.keys(node)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue;
      const val = node[key];
      if (val && typeof val === 'object') visit(val, depth + 1);
    }
  }
}

/** Resolves a node to its string value: literal, plain template literal, or a tracked variable. */
export function resolveStringValue(node: any, stringVarValues: Map<string, string>): string | null {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && (node.expressions ?? []).length === 0) {
    return (node.quasis ?? []).map((q: any) => q.value?.raw ?? '').join('');
  }
  if (node.type === 'Identifier' && stringVarValues.has(node.name)) {
    return stringVarValues.get(node.name) ?? null;
  }
  return null;
}

/** A source-order sortable position for a node. */
export function posOf(n: any): number {
  if (typeof n?.range?.[0] === 'number') return n.range[0];
  const line = n?.loc?.start?.line ?? 0;
  const column = n?.loc?.start?.column ?? 0;
  return line * 1_000_000 + column;
}
