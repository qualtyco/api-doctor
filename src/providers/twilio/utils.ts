/** Shared AST helpers for Twilio provider rules. */

const POST_METHOD_NAMES = new Set(['post']);
const ROUTER_OBJECT_NAMES = new Set(['server', 'app', 'router', 'fastify']);

/** True for `server.post('/path', ...)` / `app.post('/path', ...)` style route registrations. */
export function isPostRouteRegistration(node: any): boolean {
  if (node?.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee?.type !== 'MemberExpression') return false;
  if (callee.property?.type !== 'Identifier' || !POST_METHOD_NAMES.has(callee.property.name)) return false;
  return callee.object?.type === 'Identifier' && ROUTER_OBJECT_NAMES.has(callee.object.name);
}

/** Recursively searches a subtree for any node matching the predicate. */
export function findInSubtree(node: any, predicate: (n: any) => boolean, depth = 0): any {
  if (!node || typeof node !== 'object' || depth > 40) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findInSubtree(n, predicate, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (predicate(node)) return node;
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const val = node[key];
    if (val && typeof val === 'object') {
      const found = findInSubtree(val, predicate, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/** True when a subtree references `req.body`/`request.body` anywhere. */
export function referencesRequestBody(node: any): boolean {
  return !!findInSubtree(node, (n) => {
    if (n?.type !== 'MemberExpression') return false;
    if (n.property?.type !== 'Identifier' || n.property.name !== 'body') return false;
    return n.object?.type === 'Identifier' && (n.object.name === 'req' || n.object.name === 'request');
  });
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
