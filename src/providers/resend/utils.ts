/**
 * Shared AST helpers for Resend rules. Kept intentionally small; extend only
 * when logic is genuinely reused across rules.
 *
 * Send calls are matched by the `.emails.send(...)` / `.batch.send(...)` member
 * shape rather than the base identifier name, so a client stored as `resend`,
 * `client`, etc. is still recognized.
 */

/** True for `<obj>.emails.send(...)`. */
export function isResendEmailsSendCall(node: any): boolean {
  if (node?.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee?.type !== 'MemberExpression') return false;
  if (callee.property?.type !== 'Identifier' || callee.property.name !== 'send') return false;
  const obj = callee.object;
  return (
    obj?.type === 'MemberExpression' &&
    obj.property?.type === 'Identifier' &&
    obj.property.name === 'emails'
  );
}

/** True for `<obj>.batch.send(...)`. */
export function isResendBatchSendCall(node: any): boolean {
  if (node?.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee?.type !== 'MemberExpression') return false;
  if (callee.property?.type !== 'Identifier' || callee.property.name !== 'send') return false;
  const obj = callee.object;
  return (
    obj?.type === 'MemberExpression' &&
    obj.property?.type === 'Identifier' &&
    obj.property.name === 'batch'
  );
}

/** True for either Resend send variant. */
export function isResendSendCall(node: any): boolean {
  return isResendEmailsSendCall(node) || isResendBatchSendCall(node);
}

/** Returns `arguments[index]` if it is an ObjectExpression, else null. */
export function getObjectArg(node: any, index: number): any | null {
  const arg = node?.arguments?.[index];
  return arg?.type === 'ObjectExpression' ? arg : null;
}

/**
 * Returns the per-email option object(s) for a send call:
 *   - emails.send(payload)         -> [payload]
 *   - batch.send([email, email])   -> [email, email]  (literal array only)
 * Returns [] when the relevant argument is not a plain object/array literal.
 */
export function getSendOptionObjects(node: any): any[] {
  if (isResendEmailsSendCall(node)) {
    const opts = getObjectArg(node, 0);
    return opts ? [opts] : [];
  }
  if (isResendBatchSendCall(node)) {
    const arr = node?.arguments?.[0];
    if (arr?.type !== 'ArrayExpression') return [];
    return (arr.elements ?? []).filter((el: any) => el?.type === 'ObjectExpression');
  }
  return [];
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

/** Best-effort absolute start offset of a node (range → start → loc fallback). */
export function startOffset(n: any): number {
  if (typeof n?.range?.[0] === 'number') return n.range[0];
  if (typeof n?.start === 'number') return n.start;
  return (n?.loc?.start?.line ?? 0) * 1_000_000 + (n?.loc?.start?.column ?? 0);
}

/** Best-effort absolute end offset of a node (range → end → loc fallback). */
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
