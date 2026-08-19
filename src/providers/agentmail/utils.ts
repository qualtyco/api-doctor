import { contains, endOffset, findProperty, isInsideTestFile, memberPropName, startOffset } from '../_shared/ast.js';
export { contains, endOffset, findProperty, isInsideTestFile, memberPropName, startOffset };

/**
 * Shared AST helpers for AgentMail (`agentmail`) rules.
 *
 * AgentMail calls are matched by member shape (`.inboxes.create(...)`,
 * `.messages.send(...)`, `.drafts.create(...)`) rather than the base
 * identifier name, so clients stored as `agentmail`, `client`, `am`, etc.
 * are still recognized. File-level provider relevance is tracked via
 * createAgentMailFileTracker so rules also fire on wrapper layouts like
 * `import { agentmail } from '@/lib/agentmail'`.
 */

/** Unwraps TS/chain wrappers: `expr!`, `expr as T`, `expr satisfies T`, `expr?.`. */
export function unwrapExpr(node: any): any {
  let n = node;
  while (
    n &&
    (n.type === 'TSNonNullExpression' ||
      n.type === 'TSAsExpression' ||
      n.type === 'TSSatisfiesExpression' ||
      n.type === 'ChainExpression' ||
      n.type === 'ParenthesizedExpression')
  ) {
    n = n.expression;
  }
  return n;
}

/**
 * If `node` is a call of the form `<obj>.<name>(...)` (including dynamic
 * `<obj>["<name>"](...)`), returns the callee object; else null.
 */
export function memberCallObject(node: any, name: string): any | null {
  if (node?.type !== 'CallExpression') return null;
  const callee = unwrapExpr(node.callee);
  if (memberPropName(callee) !== name) return null;
  return callee.object;
}

/**
 * True when `node` is a call `<...>.<holder>.<method>(...)`, e.g.
 * isProviderCall(n, 'messages', 'send') matches `client.inboxes.messages.send(...)`
 * and `inbox.messages["send"](...)`. Also accepts a bare identifier holder:
 * `messages.send(...)`.
 */
export function isHolderMethodCall(node: any, holder: string, method: string): boolean {
  const obj = unwrapExpr(memberCallObject(node, method));
  if (!obj) return false;
  if (obj.type === 'Identifier') return obj.name === holder;
  return memberPropName(obj) === holder;
}

/** True when the ObjectExpression contains a spread — properties can't be verified statically. */
export function hasSpread(objectExpression: any): boolean {
  return (objectExpression?.properties ?? []).some(
    (p: any) => p?.type === 'SpreadElement' || p?.type === 'SpreadProperty',
  );
}

/** All ObjectExpression arguments of a call (options objects at any position). */
export function objectArgs(node: any): any[] {
  return (node?.arguments ?? [])
    .map((a: any) => unwrapExpr(a))
    .filter((a: any) => a?.type === 'ObjectExpression');
}

/**
 * Collects identifier names and member property names mentioned anywhere in
 * an expression (shallow, call arguments excluded — a callee like
 * `senderEmail(message)` contributes "senderEmail" but not "message").
 */
export function mentionedNames(node: any, depth = 0): string[] {
  const n = unwrapExpr(node);
  if (!n || depth > 6) return [];
  if (n.type === 'Identifier') return [n.name];
  if (n.type === 'MemberExpression') {
    const own = memberPropName(n);
    return [...(own ? [own] : []), ...mentionedNames(n.object, depth + 1)];
  }
  if (n.type === 'CallExpression') return mentionedNames(n.callee, depth + 1);
  if (n.type === 'AwaitExpression' || n.type === 'UnaryExpression') {
    return mentionedNames(n.argument, depth + 1);
  }
  if (n.type === 'LogicalExpression' || n.type === 'BinaryExpression') {
    return [...mentionedNames(n.left, depth + 1), ...mentionedNames(n.right, depth + 1)];
  }
  return [];
}

/** True when any name mentioned in the expression matches the pattern. */
export function mentions(node: any, pattern: RegExp): boolean {
  return mentionedNames(node).some((name) => pattern.test(name));
}

export interface AgentMailFileTracker {
  /** Feed every ImportDeclaration to the tracker. */
  visitImport(node: any): void;
  /** Feed every NewExpression to the tracker (recognizes `new AgentMailClient(...)`). */
  visitNew(node: any): void;
  /** True once the file shows AgentMail evidence (SDK import, wrapper import, client construction). */
  isAgentMailFile(): boolean;
}

/**
 * Tracks whether a file is AgentMail-relevant. Accepts:
 *  - direct imports from `agentmail`
 *  - wrapper imports whose source or local binding is agentmail-ish
 *    (`import { client } from '@/lib/agentmail'`, `import { agentmail } from './clients.js'`)
 *  - `new AgentMailClient(...)` constructions (renamed imports included)
 */
export function createAgentMailFileTracker(): AgentMailFileTracker {
  let evidence = false;
  const clientCtorLocals = new Set<string>(['AgentMailClient']);

  return {
    visitImport(node: any): void {
      const source = node?.source?.value;
      if (typeof source === 'string' && /agent[._-]?mail/i.test(source)) evidence = true;
      for (const s of node?.specifiers ?? []) {
        const local = s?.local?.type === 'Identifier' ? s.local.name : null;
        if (!local) continue;
        if (/agent[._-]?mail/i.test(local)) evidence = true;
        if (
          s.type === 'ImportSpecifier' &&
          s.imported?.type === 'Identifier' &&
          s.imported.name === 'AgentMailClient'
        ) {
          clientCtorLocals.add(local);
        }
      }
    },
    visitNew(node: any): void {
      const callee = unwrapExpr(node?.callee);
      if (callee?.type === 'Identifier' && clientCtorLocals.has(callee.name)) {
        evidence = true;
      }
    },
    isAgentMailFile(): boolean {
      return evidence;
    },
  };
}
