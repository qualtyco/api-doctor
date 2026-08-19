import { contains, endOffset, findProperty, isInsideTestFile, callPropName, someDescendant, startOffset } from '../_shared/ast.js';
export { contains, endOffset, findProperty, isInsideTestFile, callPropName, someDescendant, startOffset };

/**
 * Shared AST helpers for Browserbase rules. Kept intentionally small; extend
 * only when logic is genuinely reused across rules.
 *
 * The Node SDK (`@browserbasehq/sdk`, Stainless-generated) exposes a
 * `client.sessions.*` / `client.contexts.*` resource API, so most call-site
 * matching here is member-expression based (`<client>.sessions.create(...)`)
 * rather than free-function matching like some other providers.
 */

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
  if (callPropName(node) !== name) return false;
  const obj = node.callee.object;
  return obj?.type === 'MemberExpression' && !obj.computed && obj.property?.type === 'Identifier' && obj.property.name === 'sessions';
}

/** True for `<chain>.sessions.recording.<name>(...)`. */
export function isSessionsRecordingCall(node: any, name: string): boolean {
  if (callPropName(node) !== name) return false;
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

/** True for a call to a response-sending method: res.json/.send, Response.json, NextResponse.json. */
export function isResponseSendCall(node: any): boolean {
  const name = callPropName(node);
  if (name !== 'json' && name !== 'send') return false;
  const obj = node.callee.object;
  if (obj?.type === 'Identifier') {
    return /^(res|response)$/i.test(obj.name) || obj.name === 'Response' || obj.name === 'NextResponse';
  }
  return false;
}
