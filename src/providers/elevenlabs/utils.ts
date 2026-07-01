/** Shared AST helpers for ElevenLabs provider rules. */

/** True when a fetch URL argument (string or template literal) targets the ElevenLabs API. */
export function isElevenLabsUrlArg(node: any): boolean {
  if (!node) return false;
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value.includes('elevenlabs.io');
  }
  if (node.type === 'TemplateLiteral') {
    return (node.quasis ?? []).some(
      (q: any) => typeof q?.value?.raw === 'string' && q.value.raw.includes('elevenlabs.io'),
    );
  }
  return false;
}

/** Recursively searches a subtree for a `fetch(<elevenlabs url>, ...)` call. */
export function findElevenLabsFetchCall(node: any, depth = 0): any {
  if (!node || typeof node !== 'object' || depth > 20) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findElevenLabsFetchCall(n, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'fetch') {
    if (isElevenLabsUrlArg(node.arguments?.[0])) return node;
  }
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const val = node[key];
    if (val && typeof val === 'object') {
      const found = findElevenLabsFetchCall(val, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/** Unwraps `await <expr>` to `<expr>`; passes through anything else unchanged. */
export function unwrapAwait(node: any): any {
  return node?.type === 'AwaitExpression' ? node.argument : node;
}

/** Recursively collects every VariableDeclarator in a subtree. */
export function collectVarDeclarators(node: any, out: any[], depth = 0): void {
  if (!node || typeof node !== 'object' || depth > 24) return;
  if (Array.isArray(node)) {
    for (const n of node) collectVarDeclarators(n, out, depth + 1);
    return;
  }
  if (node.type === 'VariableDeclarator') out.push(node);
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const val = node[key];
    if (val && typeof val === 'object') collectVarDeclarators(val, out, depth + 1);
  }
}

/** A source-order sortable position for a node, used to compare "happens before". */
export function posOf(n: any): number {
  if (typeof n?.range?.[0] === 'number') return n.range[0];
  const line = n?.loc?.start?.line ?? 0;
  const column = n?.loc?.start?.column ?? 0;
  return line * 1_000_000 + column;
}
