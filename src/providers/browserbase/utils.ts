/**
 * Shared AST helpers for Browserbase rules. Kept intentionally small; extend
 * only when logic is genuinely reused across rules.
 *
 * The Node SDK (`@browserbasehq/sdk`, Stainless-generated) exposes a
 * `client.sessions.*` / `client.contexts.*` resource API, so most call-site
 * matching here is member-expression based (`<client>.sessions.create(...)`)
 * rather than free-function matching like some other providers.
 */

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

/** True for `<chain>.sessions.<name>(...)`, e.g. `bb.sessions.create(...)`, `client.sessions.debug(...)`. */
export function isSessionsCall(node: any, name: string): boolean {
  if (memberPropName(node) !== name) return false;
  const obj = node.callee.object;
  return obj?.type === 'MemberExpression' && !obj.computed && obj.property?.type === 'Identifier' && obj.property.name === 'sessions';
}

/** True for `<chain>.sessions.recording.<name>(...)`. */
export function isSessionsRecordingCall(node: any, name: string): boolean {
  if (memberPropName(node) !== name) return false;
  const recordingObj = node.callee.object;
  if (recordingObj?.type !== 'MemberExpression' || recordingObj.computed) return false;
  if (recordingObj.property?.type !== 'Identifier' || recordingObj.property.name !== 'recording') return false;
  const sessionsObj = recordingObj.object;
  return (
    sessionsObj?.type === 'MemberExpression' &&
    !sessionsObj.computed &&
    sessionsObj.property?.type === 'Identifier' &&
    sessionsObj.property.name === 'sessions'
  );
}

/** Returns the Property node named `name` on an ObjectExpression, else undefined. */
export function findProperty(objectExpression: any, name: string): any | undefined {
  if (objectExpression?.type !== 'ObjectExpression') return undefined;
  return objectExpression.properties?.find(
    (p: any) =>
      p?.type === 'Property' &&
      ((p.key?.type === 'Identifier' && p.key.name === name) || (p.key?.type === 'Literal' && p.key.value === name)),
  );
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

/** True for a call to a response-sending method: res.json/.send, Response.json, NextResponse.json. */
export function isResponseSendCall(node: any): boolean {
  const name = memberPropName(node);
  if (name !== 'json' && name !== 'send') return false;
  const obj = node.callee.object;
  if (obj?.type === 'Identifier') {
    return /^(res|response)$/i.test(obj.name) || obj.name === 'Response' || obj.name === 'NextResponse';
  }
  return false;
}

/** True when the file path looks like a test file. */
export function isInsideTestFile(filename: string): boolean {
  return /(^|[\\/])__tests__[\\/]|\.(test|spec)\.[cm]?[jt]sx?$/.test(filename);
}
