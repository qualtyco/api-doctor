/**
 * Shared AST helpers for Firebase rules. Kept intentionally small; extend
 * only when logic is genuinely reused across rules.
 *
 * The modular Firebase JS SDK (v9+) exposes free functions (`initializeApp`,
 * `onValue`, `set`, `update`, `push`, `signInWithPopup`, ...) rather than
 * instance methods, so most call-site matching here is "imported name,
 * called as a bare identifier" rather than member-expression matching.
 */

/** Map of imported name -> local name for every named import from `sourceValue` on this ImportDeclaration. */
export function namedImportsFrom(node: any, sourceValue: string): Map<string, string> {
  const map = new Map<string, string>();
  if (node?.type !== 'ImportDeclaration' || node.source?.value !== sourceValue) return map;
  for (const s of node.specifiers ?? []) {
    if (s?.type === 'ImportSpecifier' && s.imported?.type === 'Identifier' && s.local?.type === 'Identifier') {
      map.set(s.imported.name, s.local.name);
    }
  }
  return map;
}

/** Local binding name for a namespace import (`import * as ns from 'source'`) from `sourceValue`, if present. */
export function namespaceImportFrom(node: any, sourceValue: string): string | undefined {
  if (node?.type !== 'ImportDeclaration' || node.source?.value !== sourceValue) return undefined;
  for (const s of node.specifiers ?? []) {
    if (s?.type === 'ImportNamespaceSpecifier' && s.local?.type === 'Identifier') return s.local.name;
  }
  return undefined;
}

/** True for `<name>(...)` — a CallExpression whose callee is the bare identifier `name`. */
export function isIdentifierCall(node: any, name: string | undefined): boolean {
  if (!name) return false;
  return node?.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === name;
}

/** True for `<obj>.<name>(...)` where `obj` is the bare identifier `objName`. */
export function isNamespaceMemberCall(node: any, objName: string | undefined, name: string): boolean {
  if (!objName) return false;
  if (node?.type !== 'CallExpression' || node.callee?.type !== 'MemberExpression') return false;
  const callee = node.callee;
  if (callee.computed) return false;
  return (
    callee.object?.type === 'Identifier' &&
    callee.object.name === objName &&
    callee.property?.type === 'Identifier' &&
    callee.property.name === name
  );
}

/** Returns the called method name for `<chain>.<name>(...)`, handling computed string-literal access. */
export function memberPropName(node: any): string | undefined {
  if (node?.type !== 'CallExpression') return undefined;
  const callee = node.callee;
  if (callee?.type !== 'MemberExpression') return undefined;
  const prop = callee.property;
  if (!callee.computed && prop?.type === 'Identifier') return prop.name;
  if (callee.computed && prop?.type === 'Literal' && typeof prop.value === 'string') return prop.value;
  return undefined;
}

/** The CallExpression this call is chained onto (`<this>.method()`), or null if the base isn't itself a call. */
export function chainObjectCall(node: any): any | null {
  const obj = node?.callee?.object;
  return obj?.type === 'CallExpression' ? obj : null;
}

/** Every CallExpression link in a member chain, starting at `node` and walking down to the base call. */
export function chainLinks(node: any): any[] {
  const links: any[] = [];
  let current: any = node;
  while (current?.type === 'CallExpression') {
    links.push(current);
    current = chainObjectCall(current);
  }
  return links;
}

/** Best-effort absolute start offset of a node (range -> start -> loc fallback). */
export function startOffset(n: any): number {
  if (typeof n?.range?.[0] === 'number') return n.range[0];
  if (typeof n?.start === 'number') return n.start;
  return (n?.loc?.start?.line ?? 0) * 1_000_000 + (n?.loc?.start?.column ?? 0);
}

/** Best-effort absolute end offset of a node (range -> end -> loc fallback). */
export function endOffset(n: any): number {
  if (typeof n?.range?.[1] === 'number') return n.range[1];
  if (typeof n?.end === 'number') return n.end;
  return (n?.loc?.end?.line ?? n?.loc?.start?.line ?? 0) * 1_000_000 + (n?.loc?.end?.column ?? 0);
}

/** True when `outer`'s range fully contains `inner`'s start position. */
export function contains(outer: any, inner: any): boolean {
  const s = startOffset(inner);
  return s >= startOffset(outer) && s <= endOffset(outer);
}

/** Depth-first search over the AST rooted at `node` for any descendant matching `predicate`. */
export function someDescendant(node: any, predicate: (n: any) => boolean): boolean {
  let found = false;
  function visit(n: any) {
    if (found || !n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      for (const item of n) visit(item);
      return;
    }
    if (typeof n.type !== 'string') return;
    if (predicate(n)) {
      found = true;
      return;
    }
    for (const key of Object.keys(n)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue;
      visit(n[key]);
    }
  }
  visit(node);
  return found;
}

/** True for `<objName>.uid` / `<objName>?.uid` member access. */
export function isUidMemberAccess(node: any, objName: string): boolean {
  const n = node?.type === 'ChainExpression' ? node.expression : node;
  if (n?.type !== 'MemberExpression' || n.computed) return false;
  return n.object?.type === 'Identifier' && n.object.name === objName && n.property?.type === 'Identifier' && n.property.name === 'uid';
}

/** True when `node` is a BinaryExpression (`===`/`==`) with `name` as one operand. */
export function comparesIdentifier(node: any, name: string): boolean {
  if (node?.type !== 'BinaryExpression') return false;
  if (node.operator !== '===' && node.operator !== '==') return false;
  return [node.left, node.right].some((s: any) => s?.type === 'Identifier' && s.name === name);
}

/** True when the file path looks like a test file. */
export function isInsideTestFile(filename: string): boolean {
  return /(^|[\\/])__tests__[\\/]|\.(test|spec)\.[cm]?[jt]sx?$/.test(filename);
}
