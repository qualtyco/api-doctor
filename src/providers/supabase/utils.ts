/**
 * Shared AST helpers for Supabase rules. Kept intentionally small; extend
 * only when logic is genuinely reused across rules.
 */

/** Returns the property name of a (possibly computed) MemberExpression callee, e.g. `obj["select"]()` -> 'select'. */
export function memberPropName(node: any): string | undefined {
  if (node?.type !== 'CallExpression') return undefined;
  const callee = node.callee;
  if (callee?.type !== 'MemberExpression') return undefined;
  const prop = callee.property;
  if (!callee.computed && prop?.type === 'Identifier') return prop.name;
  if (callee.computed && prop?.type === 'Literal' && typeof prop.value === 'string') {
    return prop.value;
  }
  return undefined;
}

/** The CallExpression this call is chained onto (`<this>.method()`), or null if the base isn't itself a call. */
export function chainObjectCall(node: any): any | null {
  const obj = node?.callee?.object;
  return obj?.type === 'CallExpression' ? obj : null;
}

/** Splits a Supabase `.select("a, b, c")` string literal argument into trimmed column names. */
export function parseSelectColumns(arg: any): string[] {
  if (arg?.type !== 'Literal' || typeof arg.value !== 'string') return [];
  return arg.value
    .split(',')
    .map((c: string) => c.trim())
    .filter(Boolean);
}

/** True for column names that look like a tenant/ownership scoping key, e.g. `session_id`, `user_id` (not the bare `id` PK). */
export function isTenantColumnName(name: string): boolean {
  return /^[a-z][a-z0-9]*_id$/i.test(name) && name.toLowerCase() !== 'id';
}

/** True for column names that look like a timestamp, e.g. `created_at`, `updated_at`. */
export function isTimestampColumnName(name: string): boolean {
  return /^[a-z][a-z0-9]*_at$/i.test(name);
}

/**
 * Resolves the source identifier name backing an insert/upsert object
 * property's value: shorthand (`{ x }`), a bare identifier (`{ x: y }`), or
 * an identifier guarded by `??`/`||` (`{ x: y ?? null }`, common for
 * optional fields) — the left side of the fallback is what was validated.
 */
export function resolvePropertyValueName(prop: any): string | undefined {
  if (prop?.shorthand && prop.key?.type === 'Identifier') return prop.key.name;
  const value = prop?.value;
  if (value?.type === 'Identifier') return value.name;
  if (value?.type === 'LogicalExpression' && (value.operator === '??' || value.operator === '||')) {
    if (value.left?.type === 'Identifier') return value.left.name;
  }
  return undefined;
}

/** If `node` is `typeof <ident> === "string"` (or `!==`), returns `<ident>`'s name. */
export function typeofStringCheckTarget(node: any): string | undefined {
  if (node?.type !== 'BinaryExpression') return undefined;
  if (node.operator !== '===' && node.operator !== '!==') return undefined;
  const sides = [node.left, node.right];
  const typeofSide = sides.find(
    (s: any) =>
      s?.type === 'UnaryExpression' && s.operator === 'typeof' && s.argument?.type === 'Identifier',
  );
  const litSide = sides.find((s: any) => s?.type === 'Literal' && s.value === 'string');
  if (!typeofSide || !litSide) return undefined;
  return typeofSide.argument.name;
}
