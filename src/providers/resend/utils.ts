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

/**
 * Dotted method path of a call's callee, receiver excluded:
 *   resend.emails.send(...)            -> ['emails', 'send']
 *   this.client.contacts.segments.add()-> ['client', 'contacts', 'segments', 'add']
 *   emails.send(...)                   -> ['send']   (no receiver — not a match)
 * Returns [] when any link is computed or not a plain identifier. The receiver
 * itself is deliberately dropped: verifying it is a Resend client is the
 * provider gate's job (src/plugin/gate.ts), not each rule's.
 */
export function calleeMethodPath(node: any): string[] {
  if (node?.type !== 'CallExpression') return [];
  const parts: string[] = [];
  let cur = node.callee;
  while (cur?.type === 'MemberExpression') {
    if (cur.computed || cur.property?.type !== 'Identifier') return [];
    parts.unshift(cur.property.name);
    cur = cur.object;
  }
  return cur ? parts : [];
}

/**
 * Resend resource methods that change state and resolve to `{ data, error }`.
 *
 * Derived by hand from `surface.methods` in manifest.ts, which `pnpm
 * check:surface` guards against SDK drift — when that check reports a new
 * method, decide here whether it mutates.
 *
 * Reads (`.get` / `.list`) are excluded on purpose: discarding the result of a
 * read is dead code, not a silent failure, so there is no error to miss.
 * `webhooks.verify` is excluded because it is a local signature helper that
 * throws — it does not use the `{ data, error }` contract at all.
 */
const MUTATING_METHODS = new Set([
  'apiKeys.create',
  'apiKeys.remove',
  'audiences.create',
  'audiences.remove',
  'automations.create',
  'automations.remove',
  'automations.stop',
  'automations.update',
  'batch.create',
  'batch.send',
  'broadcasts.create',
  'broadcasts.remove',
  'broadcasts.send',
  'broadcasts.update',
  'contactProperties.create',
  'contactProperties.remove',
  'contactProperties.update',
  'contacts.create',
  'contacts.imports.create',
  'contacts.remove',
  'contacts.segments.add',
  'contacts.segments.remove',
  'contacts.topics.update',
  'contacts.update',
  'domains.claims.create',
  'domains.claims.verify',
  'domains.create',
  'domains.remove',
  'domains.update',
  'domains.verify',
  'emails.cancel',
  'emails.create',
  'emails.receiving.forward',
  'emails.send',
  'emails.update',
  'events.create',
  'events.remove',
  'events.send',
  'events.update',
  'oauthGrants.revoke',
  'segments.create',
  'segments.remove',
  'suppressions.add',
  'suppressions.batch.add',
  'suppressions.batch.remove',
  'suppressions.remove',
  'templates.create',
  'templates.duplicate',
  'templates.publish',
  'templates.remove',
  'templates.update',
  'topics.create',
  'topics.remove',
  'topics.update',
  'webhooks.create',
  'webhooks.remove',
  'webhooks.update',
]);

/**
 * True for a call to a Resend method that mutates and returns `{ data, error }`.
 * Matched on the trailing `<resource>.<verb>` shape so a client held as
 * `resend`, `client`, `this.mailer`, … is recognized the same way.
 */
export function isResendMutationCall(node: any): boolean {
  const path = calleeMethodPath(node);
  // Start at 2 so a bare `send(...)` or `emails.send(...)` with no receiver
  // left over never matches — same requirement the send helpers above impose.
  for (let len = 2; len <= 4 && len <= path.length; len += 1) {
    if (MUTATING_METHODS.has(path.slice(path.length - len).join('.'))) return true;
  }
  return false;
}

/**
 * True when `pattern` destructures property `key` under any local name —
 * `{ error }` and `{ error: sendError }` both count. Renaming is forced as soon
 * as one scope holds two results, so matching the local name misses correct code.
 *
 * Second sighting of the `{ data, error }` contract (Supabase has the same
 * helper). If a third provider needs it, lift both into a shared module.
 */
export function destructuresKey(pattern: any, key: string): boolean {
  if (pattern?.type !== 'ObjectPattern') return false;
  return (pattern.properties ?? []).some((prop: any) => {
    if (prop?.type !== 'Property' || prop.computed) return false;
    if (prop.key?.type === 'Identifier') return prop.key.name === key;
    if (prop.key?.type === 'Literal') return prop.key.value === key;
    return false;
  });
}

/** True when `pattern` is an ObjectPattern carrying a rest element (`{ ...rest }`). */
export function hasRestElement(pattern: any): boolean {
  if (pattern?.type !== 'ObjectPattern') return false;
  return (pattern.properties ?? []).some((p: any) => p?.type === 'RestElement');
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
