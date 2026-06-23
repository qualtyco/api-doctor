/**
 * firebase-rtdb-write-promise-not-handled (reliability)
 *
 * set()/update()/remove() return promises specifically so a rejected write
 * (offline, permission-denied, rules-rejected) can be handled. A bare
 * fire-and-forget call, or an awaited call with no surrounding try/catch,
 * means the caller proceeds (and may navigate away) as if the write
 * succeeded.
 */
import { chainLinks, contains, isIdentifierCall, memberPropName, namedImportsFrom } from '../utils.js';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Realtime Database write promises must be handled',
      category: 'reliability',
      rationale:
        'set()/update()/remove() return promises specifically so a rejected write (offline, permission-denied, rules-rejected) can be handled. A bare fire-and-forget call, or an awaited call with no surrounding try/catch, means the caller proceeds — and may navigate away — as if the write succeeded, while the rejection is silently dropped.',
      docsUrl: 'https://firebase.google.com/docs/database/web/read-and-write',
      recommended: true,
    },
    messages: {
      writePromiseNotHandled:
        'This Realtime Database write is neither awaited inside a try/catch nor given a .catch handler. A rejected write will be silently dropped.',
    },
    schema: [],
  },
  create(context: any) {
    const writeLocalNames = new Set<string>();
    const writeCalls = new Set<any>();
    const safeReturns = new Set<any>();
    const awaitedCalls = new Set<any>();
    const caughtCalls = new Set<any>();
    const tryBlocks: any[] = [];

    // Nodes are visited parent-before-child, so a ReturnStatement/AwaitExpression
    // is seen before the CallExpression it wraps — evaluate the predicate
    // directly here rather than checking membership in `writeCalls`.
    function isWriteCall(node: any): boolean {
      return [...writeLocalNames].some((n) => isIdentifierCall(node, n));
    }

    return {
      ImportDeclaration(node: any) {
        const imports = namedImportsFrom(node, 'firebase/database');
        for (const name of ['set', 'update', 'remove']) {
          const local = imports.get(name);
          if (local) writeLocalNames.add(local);
        }
      },
      TryStatement(node: any) {
        if (node.block) tryBlocks.push(node.block);
      },
      ReturnStatement(node: any) {
        if (isWriteCall(node.argument)) safeReturns.add(node.argument);
      },
      AwaitExpression(node: any) {
        if (isWriteCall(node.argument)) awaitedCalls.add(node.argument);
      },
      CallExpression(node: any) {
        if (isWriteCall(node)) writeCalls.add(node);

        const prop = memberPropName(node);
        const isCatch = prop === 'catch';
        const isTwoArgThen = prop === 'then' && (node.arguments ?? []).length >= 2;
        if (isCatch || isTwoArgThen) {
          for (const link of chainLinks(node)) {
            if (isWriteCall(link)) caughtCalls.add(link);
          }
        }
      },
      'Program:exit'() {
        for (const call of writeCalls) {
          if (safeReturns.has(call)) continue;
          if (caughtCalls.has(call)) continue;
          if (awaitedCalls.has(call)) {
            if (tryBlocks.some((block) => contains(block, call))) continue;
          }
          context.report({ node: call, messageId: 'writePromiseNotHandled' });
        }
      },
    };
  },
};

export const firebaseRtdbWritePromiseNotHandledRule = rule;
export default rule;
