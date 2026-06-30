/**
 * Shared AST helpers for TipTap rules.
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

/** Returns the Property node named `name` on an ObjectExpression, else undefined. */
export function findProperty(objectExpression: any, name: string): any | undefined {
  if (objectExpression?.type !== 'ObjectExpression') return undefined;
  return objectExpression.properties?.find(
    (p: any) =>
      p?.type === 'Property' &&
      ((p.key?.type === 'Identifier' && p.key.name === name) ||
        (p.key?.type === 'Literal' && p.key.value === name)),
  );
}

/** True when the file path looks like a test file. */
export function isInsideTestFile(filename: string): boolean {
  return /(^|[\\/])__tests__[\\/]|\.(test|spec)\.[cm]?[jt]sx?$/.test(filename);
}

/** Best-effort start offset of a node. */
export function startOffset(n: any): number {
  if (typeof n?.range?.[0] === 'number') return n.range[0];
  if (typeof n?.start === 'number') return n.start;
  return (n?.loc?.start?.line ?? 0) * 1_000_000 + (n?.loc?.start?.column ?? 0);
}

/** Best-effort end offset of a node. */
export function endOffset(n: any): number {
  if (typeof n?.range?.[1] === 'number') return n.range[1];
  if (typeof n?.end === 'number') return n.end;
  return (n?.loc?.end?.line ?? n?.loc?.start?.line ?? 0) * 1_000_000 + (n?.loc?.end?.column ?? 0);
}

/** True when `outer` fully contains `inner`'s start. */
export function contains(outer: any, inner: any): boolean {
  const s = startOffset(inner);
  return s >= startOffset(outer) && s <= endOffset(outer);
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
