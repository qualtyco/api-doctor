/**
 * s2-close-stream-client (reliability)
 *
 * Append sessions and Producers hold an HTTP/2 (S2S) connection. Handles
 * opened per request and never closed leak connections in long-lived
 * processes; short scripts that never close can hang on exit. Flags
 * appendSession()/new Producer(...) variables with no close() on any path.
 * A session passed into `new Producer(...)` is owned (and closed) by the
 * Producer; a handle returned from a factory is closed by the caller —
 * neither is flagged.
 */
import { createS2FileTracker, memberCallObject, unwrapExpr } from '../../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Close append sessions and Producers when done',
      category: 'reliability',
      cwe: 'CWE-404',
      rationale:
        'Sessions pin an HTTP/2 connection until closed, and close() is also what flushes outstanding batches. A per-request session that is never closed leaks a connection per request; a script that never closes may hang instead of exiting. Close in a finally block, and reuse one client across requests where possible.',
      docsUrl: 'https://s2.dev/docs/sdk/appending',
      recommended: true,
    },
    messages: {
      neverClosed:
        'This append session/Producer is never close()d — it leaks its connection and unflushed batches. Await close() in a finally block.',
    },
    schema: [],
  },
  create(context: any) {
    const tracker = createS2FileTracker();
    /** writer var name → its declarator node. */
    const writerVars = new Map<string, any>();
    const closedVars = new Set<string>();
    /** Vars whose ownership moved: passed to new Producer(...) or returned. */
    const transferredVars = new Set<string>();

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },

      VariableDeclarator(node: any) {
        if (node?.id?.type !== 'Identifier') return;
        let init = unwrapExpr(node.init);
        if (init?.type === 'AwaitExpression') init = unwrapExpr(init.argument);
        if (init?.type === 'CallExpression' && memberCallObject(init, 'appendSession')) {
          writerVars.set(node.id.name, node);
        }
        if (init?.type === 'NewExpression') {
          const callee = unwrapExpr(init.callee);
          if (callee?.type === 'Identifier' && tracker.localNames('Producer').has(callee.name)) {
            writerVars.set(node.id.name, node);
          }
        }
      },

      NewExpression(node: any) {
        tracker.visitNew(node);
        // `new Producer(transform, session)` — the Producer owns the session
        // and closes it via producer.close().
        for (const arg of node?.arguments ?? []) {
          let a = unwrapExpr(arg);
          if (a?.type === 'AwaitExpression') a = unwrapExpr(a.argument);
          if (a?.type === 'Identifier') transferredVars.add(a.name);
        }
      },

      ReturnStatement(node: any) {
        const arg = unwrapExpr(node?.argument);
        if (arg?.type === 'Identifier') transferredVars.add(arg.name);
      },

      Property(node: any) {
        // Handle stored in an object (e.g. `return { stream, producer }`) —
        // the object's owner is responsible for closing it.
        const value = unwrapExpr(node?.value);
        if (value?.type === 'Identifier') transferredVars.add(value.name);
      },

      MemberExpression(node: any) {
        // `pipeTo(producer.writable)` closes the destination when the source
        // completes, and `.readable` consumers manage the lifecycle likewise —
        // the documented Web Streams integration.
        const prop = node?.property;
        const isStreamAdapter =
          !node.computed &&
          prop?.type === 'Identifier' &&
          (prop.name === 'writable' || prop.name === 'readable');
        if (!isStreamAdapter) return;
        const base = unwrapExpr(node.object);
        if (base?.type === 'Identifier') transferredVars.add(base.name);
      },

      ArrowFunctionExpression(node: any) {
        // Implicit return: `() => session`
        const body = unwrapExpr(node?.body);
        if (body?.type === 'Identifier') transferredVars.add(body.name);
      },

      CallExpression(node: any) {
        const closeTarget = unwrapExpr(memberCallObject(node, 'close'));
        if (closeTarget?.type === 'Identifier') closedVars.add(closeTarget.name);
      },

      'Program:exit'() {
        if (!tracker.isS2File()) return;
        for (const [name, declarator] of writerVars) {
          if (closedVars.has(name) || transferredVars.has(name)) continue;
          context.report({ node: declarator, messageId: 'neverClosed' });
        }
      },
    };
  },
};

export const s2CloseStreamClientRule = rule;
