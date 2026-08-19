/**
 * Provider-agnostic ESTree helpers shared by every provider's rules.
 *
 * Only primitives that are genuinely identical across providers live here.
 * Anything encoding provider semantics (`isResendSendCall`, `isSupabaseFromCall`)
 * stays in that provider's `utils.ts` — this module must never learn about a
 * specific SDK.
 *
 * Deliberately NOT hoisted: `findInSubtree` (twilio), `walk` (tiptap), and
 * `mentionedNames` (agentmail). They recurse, but their contracts differ —
 * return node vs boolean vs string[], depth caps of 40 / none / 6, different
 * key skip-lists. Merging them would change rule behaviour, not remove
 * duplication.
 */

/** Node offsets are read three ways because oxlint, oxc-parser, and ESTree disagree. */
export function startOffset(n: any): number {
  if (typeof n?.range?.[0] === 'number') return n.range[0];
  if (typeof n?.start === 'number') return n.start;
  // No byte offsets: synthesise a monotonic position from line/column so
  // comparisons still order correctly within a file.
  return (n?.loc?.start?.line ?? 0) * 1_000_000 + (n?.loc?.start?.column ?? 0);
}

export function endOffset(n: any): number {
  if (typeof n?.range?.[1] === 'number') return n.range[1];
  if (typeof n?.end === 'number') return n.end;
  return (n?.loc?.end?.line ?? n?.loc?.start?.line ?? 0) * 1_000_000 + (n?.loc?.end?.column ?? 0);
}

/** True when `inner` starts within `outer`'s span. */
export function contains(outer: any, inner: any): boolean {
  const s = startOffset(inner);
  return s >= startOffset(outer) && s <= endOffset(outer);
}

/** Test files hold deliberate anti-patterns; rules skip them. */
export function isInsideTestFile(filename: string): boolean {
  return /(^|[\\/])__tests__[\\/]|\.(test|spec)\.[cm]?[jt]sx?$/.test(filename);
}

/**
 * Finds a property by name on an ObjectExpression.
 *
 * A computed Identifier key (`{ [name]: v }`) names a variable, not the
 * property `name`, so it does not match — a literal key (`{ 'name': v }`)
 * does.
 */
export function findProperty(objectExpression: any, name: string): any | undefined {
  if (objectExpression?.type !== 'ObjectExpression') return undefined;
  return objectExpression.properties?.find(
    (p: any) =>
      p?.type === 'Property' &&
      ((p.key?.type === 'Identifier' && !p.computed && p.key.name === name) ||
        (p.key?.type === 'Literal' && p.key.value === name)),
  );
}

/**
 * Property name of a MemberExpression — the `y` in `x.y`.
 *
 * Distinct from `callPropName`, which takes the CallExpression instead. Both
 * contracts existed under the name `memberPropName` in different providers;
 * they are named apart here so a reader never has to guess which is meant.
 */
export function memberPropName(member: any): string | undefined {
  if (member?.type !== 'MemberExpression') return undefined;
  const prop = member.property;
  if (!member.computed && prop?.type === 'Identifier') return prop.name;
  // `x['foo']` names the property just as `x.foo` does.
  if (member.computed && prop?.type === 'Literal' && typeof prop.value === 'string') {
    return prop.value;
  }
  return undefined;
}

/** Property name of a CallExpression's callee — the `y` in `x.y()`. */
export function callPropName(call: any): string | undefined {
  if (call?.type !== 'CallExpression') return undefined;
  return memberPropName(call.callee);
}

/** True when any node in the subtree satisfies `predicate`. */
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
