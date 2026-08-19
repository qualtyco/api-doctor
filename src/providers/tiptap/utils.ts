import { contains, endOffset, findProperty, isInsideTestFile, startOffset } from '../_shared/ast.js';
export { contains, endOffset, findProperty, isInsideTestFile, startOffset };

/**
 * Shared AST helpers for Tiptap rules.
 */

/** True if ImportDeclaration source is from @tiptap/* or tiptap-markdown. */
export function isTiptapImport(node: any): boolean {
  const src: string = node?.source?.value ?? '';
  return src.startsWith('@tiptap/') || src === 'tiptap-markdown';
}

/**
 * True for CallExpression matching `Node.create(...)` or `Mark.create(...)`.
 * Handles both `Node.create` and renamed imports like `TiptapNode.create`.
 */
export function isNodeOrMarkCreate(node: any): boolean {
  if (node?.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee?.type !== 'MemberExpression') return false;
  const prop = callee.property;
  return prop?.type === 'Identifier' && prop.name === 'create';
}

/**
 * Walks an AST node depth-first, calling `visit` for each node.
 * Stops descending into a child if `visit` returns false.
 */
export function walk(node: any, visit: (n: any) => boolean | void): void {
  if (!node || typeof node !== 'object') return;
  const result = visit(node);
  if (result === false) return;
  for (const key of Object.keys(node)) {
    if (key === 'parent') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) walk(item, visit);
    } else if (child && typeof child === 'object' && child.type) {
      walk(child, visit);
    }
  }
}

/** Returns the string value of a Literal or TemplateLiteral with no expressions. */
export function getLiteralString(node: any): string | null {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions?.length === 0) {
    return node.quasis?.[0]?.value?.cooked ?? null;
  }
  return null;
}
