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

/** True when `node` is the `.from("table")` base of a Supabase query chain. */
export function isSupabaseFromCall(node: any): boolean {
  return memberPropName(node) === 'from' && node?.callee?.object?.type === 'Identifier';
}

/** Returns the table name from a `.from("table")` call anywhere in the chain. */
export function fromTableName(node: any): string | undefined {
  let current: any | null = node;
  while (current?.type === 'CallExpression') {
    if (memberPropName(current) === 'from') {
      const arg = current.arguments?.[0];
      return arg?.type === 'Literal' && typeof arg.value === 'string' ? arg.value : undefined;
    }
    current = chainObjectCall(current);
  }
  return undefined;
}

/** True when a chained Supabase call includes `.single()`. */
export function chainHasMethod(node: any, method: string): boolean {
  let current: any | null = node;
  while (current?.type === 'CallExpression') {
    if (memberPropName(current) === method) return true;
    current = chainObjectCall(current);
  }
  return false;
}

export function isSupabaseMutationKind(
  node: any,
  kind: 'delete' | 'insert' | 'update' | 'upsert',
): boolean {
  if (!chainHasMethod(node, kind)) return false;
  let current: any | null = node;
  while (current?.type === 'CallExpression') {
    if (memberPropName(current) === 'from') return true;
    current = chainObjectCall(current);
  }
  return false;
}

/** Property names on `user_metadata` that should never gate authorization. */
const USER_METADATA_AUTHZ_KEYS = new Set([
  'role',
  'roles',
  'admin',
  'is_admin',
  'permission',
  'permissions',
]);

/** True when `node` reads an auth-sensitive field from `user_metadata`. */
export function isUserMetadataAuthzRead(node: any): boolean {
  if (node?.type !== 'MemberExpression') return false;
  const parts: string[] = [];
  let current: any = node;
  while (current?.type === 'MemberExpression') {
    const prop = current.property;
    const name =
      !current.computed && prop?.type === 'Identifier'
        ? prop.name
        : prop?.type === 'Literal' && typeof prop.value === 'string'
          ? prop.value
          : undefined;
    if (name) parts.unshift(name);
    current = current.object;
  }
  const metaIdx = parts.indexOf('user_metadata');
  if (metaIdx === -1) return false;
  const field = parts[metaIdx + 1];
  return typeof field === 'string' && USER_METADATA_AUTHZ_KEYS.has(field);
}

/** Returns binding names destructured from `pattern` (ObjectPattern or Identifier). */
export function destructuredNames(pattern: any): Set<string> {
  const names = new Set<string>();
  if (!pattern) return names;
  if (pattern.type === 'Identifier') {
    names.add(pattern.name);
    return names;
  }
  if (pattern.type !== 'ObjectPattern') return names;
  for (const prop of pattern.properties ?? []) {
    if (prop?.type === 'Property') {
      if (prop.value?.type === 'Identifier') names.add(prop.value.name);
      else if (prop.key?.type === 'Identifier' && prop.shorthand) names.add(prop.key.name);
      else if (prop.key?.type === 'Identifier' && prop.value?.type === 'Identifier') {
        names.add(prop.value.name);
      }
    } else if (prop?.type === 'RestElement' && prop.argument?.type === 'Identifier') {
      names.add(prop.argument.name);
    }
  }
  return names;
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
