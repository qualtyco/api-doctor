/**
 * agentmail-handle-send-failure-status (reliability)
 *
 * AgentMail returns 403 for permanent send failures (e.g. suppressed
 * recipients after a bounce/complaint). A catch around `messages.send` that
 * logs and continues treats every failure as transient: the suppressed
 * prospect is retried every poll, forever — often burning an LLM call per
 * attempt. Flags catch handlers around send calls that neither inspect the
 * error status nor rethrow.
 */
import {
  contains,
  createAgentMailFileTracker,
  endOffset,
  isHolderMethodCall,
  isInsideTestFile,
  memberCallObject,
  memberPropName,
  startOffset,
  unwrapExpr,
} from '../../utils.js';

const STATUS_PROPS = new Set(['statusCode', 'status', 'code']);

function isSendCall(node: any): boolean {
  return isHolderMethodCall(node, 'messages', 'send') || isHolderMethodCall(node, 'drafts', 'send');
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Send failures must be inspected for permanent errors (403 suppressed), not blanket-retried',
      category: 'reliability',
      rationale:
        'Sending to a suppressed address (prior bounce or complaint) returns 403 — a permanent failure. A catch that only logs leaves the recipient queued, so the loop retries it on every poll forever, and no bounce ever cleans the list; accounts exceeding a 4% bounce rate go under review. Inspect the error statusCode: on 403, transition the recipient out of the queue; rethrow or leave queued only for transient errors.',
      docsUrl: 'https://docs.agentmail.to/knowledge-base/api-403-error',
      recommended: true,
    },
    messages: {
      blanketCatch:
        'This catch around a send treats permanent failures (403 suppressed recipient) as transient. Inspect error.statusCode and stop retrying suppressed addresses.',
    },
    schema: [],
  },
  create(context: any) {
    if (isInsideTestFile(String(context.filename ?? context.getFilename?.() ?? ''))) return {};
    const tracker = createAgentMailFileTracker();
    const sendCalls: any[] = [];
    const tryStatements: any[] = [];
    /** `.catch(handler)` chained on a send call → [handlerNode]. */
    const chainedCatchHandlers: any[] = [];
    const statusReads: any[] = [];
    const throwStatements: any[] = [];

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },
      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      TryStatement(node: any) {
        if (node?.handler && node.block) tryStatements.push(node);
      },

      ThrowStatement(node: any) {
        throwStatements.push(node);
      },

      MemberExpression(node: any) {
        const prop = memberPropName(node);
        if (prop && STATUS_PROPS.has(prop)) statusReads.push(node);
      },

      CallExpression(node: any) {
        if (isSendCall(node)) {
          sendCalls.push(node);
          return;
        }
        const target = unwrapExpr(memberCallObject(node, 'catch'));
        if (target && isSendCall(target)) {
          const handler = unwrapExpr(node.arguments?.[0]);
          if (handler) chainedCatchHandlers.push(handler);
        }
      },

      'Program:exit'() {
        if (!tracker.isAgentMailFile()) return;

        const handlesError = (scope: any): boolean =>
          statusReads.some((r) => contains(scope, r)) ||
          throwStatements.some((t) => contains(scope, t));

        for (const t of tryStatements) {
          if (!sendCalls.some((s) => contains(t.block, s))) continue;
          // Only sends directly in this try (not in a nested try with its own handler).
          const nestedTries = tryStatements.filter(
            (other) =>
              other !== t &&
              startOffset(other) >= startOffset(t.block) &&
              endOffset(other) <= endOffset(t.block),
          );
          const directSend = sendCalls.some(
            (s) => contains(t.block, s) && !nestedTries.some((n) => contains(n.block, s)),
          );
          if (!directSend) continue;
          if (!handlesError(t.handler)) {
            context.report({ node: t.handler, messageId: 'blanketCatch' });
          }
        }

        for (const handler of chainedCatchHandlers) {
          if (!handlesError(handler)) {
            context.report({ node: handler, messageId: 'blanketCatch' });
          }
        }
      },
    };
  },
};

export const agentmailHandleSendFailureStatusRule = rule;
