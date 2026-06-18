/**
 * Shared AST helpers for Railway rules.
 *
 * Railway has no app-facing npm SDK for this integration style, so detection
 * cross-references the `pg` Postgres driver and Railway's config/runtime model.
 * These helpers therefore key off `pg` usage, Next.js App Router route
 * handlers, and SQL string shapes rather than a provider client object.
 *
 * Source text is never matched directly — the only string inspection allowed
 * is on the VALUE of SQL string literals / template literals (the SQL a
 * `.query(...)` call would send).
 */

/** HTTP method names that Next.js App Router exports as route handlers. */
export const HTTP_METHODS = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]);

/** Methods that mutate server state (write endpoints). */
export const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface Handler {
  name: string;
  node: any;
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

/** Module source of an ImportDeclaration, or null. */
export function importSourceOf(node: any): string | null {
  if (node?.type !== 'ImportDeclaration') return null;
  return typeof node.source?.value === 'string' ? node.source.value : null;
}

/** Module argument of a `require("...")` CallExpression, or null. */
export function requireSourceOf(node: any): string | null {
  if (node?.type !== 'CallExpression') return null;
  if (node.callee?.type !== 'Identifier' || node.callee.name !== 'require') return null;
  const arg = node.arguments?.[0];
  return arg?.type === 'Literal' && typeof arg.value === 'string' ? arg.value : null;
}

/** True for an import or require of the `pg` Postgres driver. */
export function isPgModule(source: string | null): boolean {
  return source === 'pg' || source === 'pg-pool';
}

/**
 * Exported App Router handlers declared by an ExportNamedDeclaration:
 *   export async function POST(req) {}
 *   export const POST = async (req) => {}
 */
export function getExportedHandlers(node: any): Handler[] {
  const handlers: Handler[] = [];
  if (node?.type !== 'ExportNamedDeclaration') return handlers;
  const decl = node.declaration;
  if (!decl) return handlers;

  if (decl.type === 'FunctionDeclaration' && decl.id?.type === 'Identifier') {
    if (HTTP_METHODS.has(decl.id.name)) handlers.push({ name: decl.id.name, node: decl });
    return handlers;
  }

  if (decl.type === 'VariableDeclaration') {
    for (const d of decl.declarations ?? []) {
      if (d?.id?.type !== 'Identifier' || !HTTP_METHODS.has(d.id.name)) continue;
      const init = d.init;
      if (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression') {
        handlers.push({ name: d.id.name, node: init });
      }
    }
  }
  return handlers;
}

/** True for a `<obj>.query(...)` call (any receiver — pool, client, db, etc.). */
export function isQueryCall(node: any): boolean {
  if (node?.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee?.type !== 'MemberExpression') return false;
  const prop = callee.property;
  // Handle both `pool.query` and `pool["query"]`.
  return (
    (prop?.type === 'Identifier' && prop.name === 'query') ||
    (prop?.type === 'Literal' && prop.value === 'query')
  );
}

/**
 * Returns the SQL text of a `.query(sql, ...)` call's first argument when it is
 * a string literal or a (non-interpolated or interpolated) template literal.
 * Template expressions are replaced with a placeholder so keyword matching
 * still works. Returns null when the first arg is not a string-shaped node.
 */
export function getQuerySql(node: any): string | null {
  const arg = node?.arguments?.[0];
  if (!arg) return null;
  if (arg.type === 'Literal' && typeof arg.value === 'string') return arg.value;
  if (arg.type === 'TemplateLiteral') {
    const parts = (arg.quasis ?? []).map(
      (q: any) => q?.value?.cooked ?? q?.value?.raw ?? '',
    );
    return parts.join(' ');
  }
  return null;
}

const WRITE_SQL = /\b(insert\s+into|update|delete\s+from)\b/i;
const DDL_SQL = /\b(create|alter|drop)\s+(table|index|schema|materialized\s+view|view)\b/i;
const SELECT_FROM_SQL = /\bselect\b[\s\S]*\bfrom\s+\S/i;
// A "real" table reference: ignore bare `SELECT 1` / `SELECT now()` health pings.
const TABLE_DML = new RegExp(`${WRITE_SQL.source}|${SELECT_FROM_SQL.source}`, 'i');

export function sqlIsWrite(sql: string): boolean {
  return WRITE_SQL.test(sql);
}

export function sqlIsDDL(sql: string): boolean {
  return DDL_SQL.test(sql);
}

/** True when the SQL touches a named table (DML/SELECT-FROM), not a bare ping. */
export function sqlTouchesTable(sql: string): boolean {
  return TABLE_DML.test(sql);
}

/** Identifiers that bootstrap schema (create the tables) before use. */
const SCHEMA_BOOTSTRAP_NAMES = /^(ensureSchema|migrate|runMigrations?|createTables?|initSchema|bootstrapSchema|setupSchema)$/;

/** True for a call to a schema-bootstrap function (`ensureSchema()` etc.). */
export function isSchemaBootstrapCall(node: any): boolean {
  if (node?.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee?.type === 'Identifier') return SCHEMA_BOOTSTRAP_NAMES.test(callee.name);
  if (callee?.type === 'MemberExpression' && callee.property?.type === 'Identifier') {
    return SCHEMA_BOOTSTRAP_NAMES.test(callee.property.name);
  }
  return false;
}

/** True for `console.error|log|warn|info|debug(...)`. */
export function isConsoleCall(node: any): boolean {
  if (node?.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee?.type !== 'MemberExpression') return false;
  return callee.object?.type === 'Identifier' && callee.object.name === 'console';
}

/** True for a bare error identifier (`err`, `error`, `e`) — i.e. the whole object. */
export function isBareErrorIdentifier(node: any): boolean {
  return node?.type === 'Identifier' && /^(err|error|e|ex|exception)$/.test(node.name);
}

/** True for `new Pool(...)` (callee `Pool` or `<x>.Pool`). */
export function isNewPoolExpression(node: any): boolean {
  if (node?.type !== 'NewExpression') return false;
  const callee = node.callee;
  if (callee?.type === 'Identifier') return callee.name === 'Pool';
  if (callee?.type === 'MemberExpression' && callee.property?.type === 'Identifier') {
    return callee.property.name === 'Pool';
  }
  return false;
}

/** True for a `<x>.on('error', ...)` listener registration. */
export function isOnErrorCall(node: any): boolean {
  if (node?.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee?.type !== 'MemberExpression') return false;
  const prop = callee.property;
  const isOn =
    (prop?.type === 'Identifier' && prop.name === 'on') ||
    (prop?.type === 'Literal' && prop.value === 'on');
  if (!isOn) return false;
  const first = node.arguments?.[0];
  return first?.type === 'Literal' && first.value === 'error';
}

/** True for `await request.json()` / `req.json()`. */
export function isRequestJsonCall(node: any): boolean {
  if (node?.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee?.type !== 'MemberExpression') return false;
  const prop = callee.property;
  if (prop?.type !== 'Identifier' || prop.name !== 'json') return false;
  const obj = callee.object;
  return obj?.type === 'Identifier' && (obj.name === 'req' || obj.name === 'request');
}

/** True for a `typeof x === 'string'` / `!== 'string'` comparison. */
export function isTypeofStringComparison(node: any): boolean {
  if (node?.type !== 'BinaryExpression') return false;
  if (node.operator !== '===' && node.operator !== '!==') return false;
  const sides = [node.left, node.right];
  const hasTypeof = sides.some((s: any) => s?.type === 'UnaryExpression' && s.operator === 'typeof');
  const hasStringLit = sides.some(
    (s: any) => s?.type === 'Literal' && s.value === 'string',
  );
  return hasTypeof && hasStringLit;
}

/** True for a `<expr>.length` member access. */
export function isLengthMember(node: any): boolean {
  return (
    node?.type === 'MemberExpression' &&
    node.property?.type === 'Identifier' &&
    node.property.name === 'length'
  );
}
