import { contains, endOffset, isInsideTestFile, callPropName, someDescendant, startOffset } from '../_shared/ast.js';
export { contains, endOffset, isInsideTestFile, callPropName, someDescendant, startOffset };

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
