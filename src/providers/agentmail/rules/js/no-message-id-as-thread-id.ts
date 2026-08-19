/**
 * agentmail-no-message-id-as-thread-id (correctness)
 *
 * `sent.threadId ?? sent.messageId` silently records a message ID where a
 * thread ID belongs. Later routing matches inbound replies by thread ID —
 * a message ID can never equal one, so the reply is misclassified and the
 * conversation goes unhandled. Fail loudly instead of substituting an ID
 * of a different type.
 */
import { createAgentMailFileTracker, isInsideTestFile, memberPropName, unwrapExpr } from '../../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Never fall back from threadId to messageId — they are different identifier types',
      category: 'correctness',
      rationale:
        'SendMessageResponse carries two distinct identifiers: message_id (required) and thread_id. Coalescing threadId with messageId silently stores a message ID in a thread-ID slot; reply routing that looks records up by the inbound message\'s threadId then never matches, so the reply is treated as untracked and dropped. If threadId can be absent in your flow, throw — don\'t substitute a different identifier type.',
      docsUrl: 'https://docs.agentmail.to/api-reference/inboxes/messages/send',
      recommended: true,
    },
    messages: {
      idTypeConfusion:
        'threadId ?? messageId stores a message ID where a thread ID belongs — reply routing by thread will never match it. Throw when threadId is absent instead.',
    },
    schema: [],
  },
  create(context: any) {
    if (isInsideTestFile(String(context.filename ?? context.getFilename?.() ?? ''))) return {};
    const tracker = createAgentMailFileTracker();
    const flagged: any[] = [];

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },
      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      LogicalExpression(node: any) {
        if (node.operator !== '??' && node.operator !== '||') return;
        const left = unwrapExpr(node.left);
        const right = unwrapExpr(node.right);
        if (memberPropName(left) === 'threadId' && memberPropName(right) === 'messageId') {
          flagged.push(node);
        }
      },

      ConditionalExpression(node: any) {
        // `sent.threadId ? sent.threadId : sent.messageId`
        const consequent = unwrapExpr(node.consequent);
        const alternate = unwrapExpr(node.alternate);
        if (
          memberPropName(consequent) === 'threadId' &&
          memberPropName(alternate) === 'messageId'
        ) {
          flagged.push(node);
        }
      },

      'Program:exit'() {
        if (!tracker.isAgentMailFile()) return;
        for (const node of flagged) {
          context.report({ node, messageId: 'idTypeConfusion' });
        }
      },
    };
  },
};

export const agentmailNoMessageIdAsThreadIdRule = rule;
