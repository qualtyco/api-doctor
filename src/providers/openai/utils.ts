/** Shared AST helpers for OpenAI Computer Use rules. */

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

/** True for a CallExpression like `client.responses.create(...)` / `openai.responses.create(...)`. */
export function isResponsesCreateCall(node: any): boolean {
  if (node?.type !== 'CallExpression' || node.callee?.type !== 'MemberExpression') return false;
  const chain = memberChainNames(node.callee);
  return chain.length >= 2 && chain[chain.length - 1] === 'create' && chain[chain.length - 2] === 'responses';
}

/** Bounded recursive search for the first `responses.create(...)` call within a subtree. */
export function findResponsesCreateCall(node: any, depth = 0): any {
  if (!node || typeof node !== 'object' || depth > 12) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findResponsesCreateCall(n, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (isResponsesCreateCall(node)) return node;
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const val = (node as any)[key];
    if (val && typeof val === 'object') {
      const found = findResponsesCreateCall(val, depth + 1);
      if (found) return found;
    }
  }
  return null;
}
