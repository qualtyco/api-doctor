/**
 * Flags a `responses.create()` call inside a try/catch with no retry —
 * neither a surrounding loop nor a retry call in the catch block — so any
 * exception that survives the SDK's own internal retries ends the entire run.
 */
import { findResponsesCreateCall } from '../utils.js';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'A responses.create() call must be retried at the turn level on transient errors',
      category: 'reliability',
      rationale:
        "The SDK's own internal retry budget (DEFAULT_MAX_RETRIES) is finite. Treating any exception that survives it as fatal for the whole run — instead of retrying that one turn with backoff — means a single transient RateLimitError/APIConnectionError/InternalServerError can discard a long-running, multi-turn, expensive agent loop that may have already executed dozens of prior turns.",
      docsUrl: 'https://developers.openai.com/api/docs/guides/tools-computer-use',
      recommended: true,
    },
    messages: {
      noTurnRetry:
        'This responses.create() call has no turn-level retry — neither a surrounding loop nor a retry call in the catch block — so any error beyond the SDK\'s own retry budget ends the entire run.',
    },
  },
  create(context: any) {
    let loopDepth = 0;

    function propName(node: any): string | undefined {
      if (!node) return undefined;
      if (node.type === 'Identifier') return node.name;
      if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
      return undefined;
    }

    function catchHasRetryCall(node: any, depth = 0): boolean {
      if (!node || typeof node !== 'object' || depth > 12) return false;
      if (Array.isArray(node)) return node.some((n) => catchHasRetryCall(n, depth + 1));
      if (node.type === 'CallExpression') {
        const callee = node.callee;
        const name =
          callee?.type === 'Identifier'
            ? callee.name
            : callee?.type === 'MemberExpression'
              ? propName(callee.property)
              : undefined;
        if (name && /retry/i.test(name)) return true;
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === 'loc' || key === 'range') continue;
        const val = (node as any)[key];
        if (val && typeof val === 'object') {
          if (catchHasRetryCall(val, depth + 1)) return true;
        }
      }
      return false;
    }

    return {
      ForStatement() {
        loopDepth += 1;
      },
      'ForStatement:exit'() {
        loopDepth -= 1;
      },
      WhileStatement() {
        loopDepth += 1;
      },
      'WhileStatement:exit'() {
        loopDepth -= 1;
      },
      DoWhileStatement() {
        loopDepth += 1;
      },
      'DoWhileStatement:exit'() {
        loopDepth -= 1;
      },
      ForOfStatement() {
        loopDepth += 1;
      },
      'ForOfStatement:exit'() {
        loopDepth -= 1;
      },
      ForInStatement() {
        loopDepth += 1;
      },
      'ForInStatement:exit'() {
        loopDepth -= 1;
      },

      TryStatement(node: any) {
        const createCall = findResponsesCreateCall(node.block);
        if (!createCall) return;
        if (loopDepth > 0) return;

        const handler = node.handler;
        if (!handler) return;
        if (catchHasRetryCall(handler.body)) return;

        context.report({ node: handler, messageId: 'noTurnRetry' });
      },
    };
  },
};

export const openaiCuaRetryTransientTurnErrorsRule = rule;
