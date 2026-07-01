/**
 * Flags `conversation.endSession()` / `conversation.endConversation()` calls
 * with no surrounding try/catch, which can leave the conversation in memory
 * if the call rejects (Finding I).
 */
import { posOf } from '../utils.js';

const END_METHODS = new Set(['endSession', 'endConversation']);

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Ending a conversation must be wrapped in try/catch so a rejected call is handled',
      category: 'reliability',
      rationale:
        'If conversation.endSession()/endConversation() rejects (e.g. during a GL-mode transition) and the call site has no try/catch, the rejection becomes an unhandled promise rejection and the conversation state is never cleaned up, leaving stale connections in memory.',
      docsUrl: 'https://elevenlabs.io/docs/eleven-agents/libraries/java-script',
      recommended: true,
    },
    messages: {
      missingTryCatch:
        'This call to end the conversation has no surrounding try/catch — a rejection will go unhandled and the conversation state may never be cleaned up.',
    },
  },
  create(context: any) {
    function posEnd(n: any): number {
      if (typeof n?.range?.[1] === 'number') return n.range[1];
      const line = n?.loc?.end?.line ?? n?.loc?.start?.line ?? 0;
      const column = n?.loc?.end?.column ?? n?.loc?.start?.column ?? 0;
      return line * 1_000_000 + column;
    }

    function isConversationEndCall(node: any): boolean {
      if (node?.type !== 'CallExpression') return false;
      const callee = node.callee;
      // `conversation.endSession()` / `conversation.endConversation()`
      if (callee?.type === 'MemberExpression') {
        return callee.property?.type === 'Identifier' && END_METHODS.has(callee.property.name);
      }
      // A bare `endConversation()` call (e.g. a destructured handler prop).
      return callee?.type === 'Identifier' && END_METHODS.has(callee.name);
    }

    return {
      'Program:exit'(program: any) {
        const tryRanges: Array<[number, number]> = [];
        const endCalls: any[] = [];

        function walk(n: any, depth = 0): void {
          if (!n || typeof n !== 'object' || depth > 60) return;
          if (Array.isArray(n)) {
            for (const item of n) walk(item, depth + 1);
            return;
          }
          if (n.type === 'TryStatement' && n.block) {
            tryRanges.push([posOf(n.block), posEnd(n.block)]);
          }
          if (isConversationEndCall(n)) endCalls.push(n);
          for (const key of Object.keys(n)) {
            if (key === 'parent' || key === 'loc' || key === 'range') continue;
            const val = n[key];
            if (val && typeof val === 'object') walk(val, depth + 1);
          }
        }
        walk(program);

        for (const call of endCalls) {
          const p = posOf(call);
          const covered = tryRanges.some(([start, end]) => p >= start && p <= end);
          if (!covered) {
            context.report({ node: call, messageId: 'missingTryCatch' });
          }
        }
      },
    };
  },
};

export const elevenlabsConversationCleanupOnErrorRule = rule;
