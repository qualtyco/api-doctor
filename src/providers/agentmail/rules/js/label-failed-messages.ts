/**
 * agentmail-label-failed-messages (reliability)
 *
 * Poll loops that catch per-message processing errors without moving the
 * message out of the poll set repeat the failure forever (poison-message
 * loop, often with an LLM call per iteration) or — with an in-memory seen
 * set — silently drop it until the next restart reprocesses everything.
 * Labels are the documented server-side state: on failure, transition the
 * message (`removeLabels: ["unread"]`, `addLabels: ["processing-failed"]`).
 */
import {
  contains,
  createAgentMailFileTracker,
  isHolderMethodCall,
  isInsideTestFile,
} from '../../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Failed message processing must be labeled (dead-lettered), not silently retried',
      category: 'reliability',
      rationale:
        'Labels are the primary way agents track state server-side: the docs advise labeling a message immediately after handling so restarts can filter by labels=["unread"] and skip handled messages. A catch that only logs leaves the message unread, so the next poll retries it indefinitely (with its LLM classification cost) or, behind an in-memory seen set, drops it until a restart reprocesses everything. On failure, move the message out of the poll set with messages.update and route the failure label to a retry/alerting path.',
      docsUrl: 'https://docs.agentmail.to/knowledge-base/labels-track-state',
      recommended: true,
    },
    messages: {
      unlabeledFailure:
        'This catch leaves the failed message "unread", so every poll retries it forever. Transition it server-side: messages.update(…, { removeLabels: ["unread"], addLabels: ["processing-failed"] }).',
    },
    schema: [],
  },
  create(context: any) {
    if (isInsideTestFile(String(context.filename ?? context.getFilename?.() ?? ''))) return {};
    const tracker = createAgentMailFileTracker();
    const loops: any[] = [];
    /** for-of / for-in loops — the per-message iteration shape. */
    const iterationLoops: any[] = [];
    const tryStatements: any[] = [];
    const inboundCalls: any[] = [];
    const sendCalls: any[] = [];
    const updateCalls: any[] = [];
    const throwStatements: any[] = [];

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },
      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      ForStatement(node: any) {
        loops.push(node);
      },
      ForOfStatement(node: any) {
        loops.push(node);
        iterationLoops.push(node);
      },
      ForInStatement(node: any) {
        loops.push(node);
        iterationLoops.push(node);
      },
      WhileStatement(node: any) {
        loops.push(node);
      },
      DoWhileStatement(node: any) {
        loops.push(node);
      },

      TryStatement(node: any) {
        if (node?.handler && node.block) tryStatements.push(node);
      },

      ThrowStatement(node: any) {
        throwStatements.push(node);
      },

      CallExpression(node: any) {
        if (
          isHolderMethodCall(node, 'messages', 'get') ||
          isHolderMethodCall(node, 'threads', 'get') ||
          isHolderMethodCall(node, 'messages', 'list') ||
          isHolderMethodCall(node, 'threads', 'list')
        ) {
          inboundCalls.push(node);
        }
        if (
          isHolderMethodCall(node, 'messages', 'send') ||
          isHolderMethodCall(node, 'drafts', 'send')
        ) {
          sendCalls.push(node);
        }
        if (isHolderMethodCall(node, 'messages', 'update')) {
          updateCalls.push(node);
        }
      },

      'Program:exit'() {
        if (!tracker.isAgentMailFile()) return;
        for (const t of tryStatements) {
          // Per-message processing: a try inside a loop that fetches/iterates
          // messages. The fetch is often in the enclosing poll loop (the try
          // wraps a processMessage() helper), so accept inbound evidence in
          // the try block OR in any loop enclosing the try.
          const enclosingLoops = loops.filter((l) => contains(l, t));
          if (enclosingLoops.length === 0) continue;
          // Only the per-message try (inside a for-of over messages) has a
          // specific message to label — the outer poll-iteration try/catch
          // (transient list failures) has nothing to transition and is fine.
          if (!iterationLoops.some((l) => contains(l, t))) continue;
          const inboundNearby =
            inboundCalls.some((c) => contains(t.block, c)) ||
            enclosingLoops.some((l) => inboundCalls.some((c) => contains(l, c)));
          if (!inboundNearby) continue;
          // Catches around sends are agentmail-handle-send-failure-status's domain.
          if (sendCalls.some((s) => contains(t.block, s))) continue;
          const handled =
            updateCalls.some((u) => contains(t.handler, u)) ||
            throwStatements.some((th) => contains(t.handler, th));
          if (!handled) {
            context.report({ node: t.handler, messageId: 'unlabeledFailure' });
          }
        }
      },
    };
  },
};

export const agentmailLabelFailedMessagesRule = rule;
