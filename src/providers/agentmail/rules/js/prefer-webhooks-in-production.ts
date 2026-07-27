/**
 * agentmail-prefer-webhooks-in-production (reliability, advisory)
 *
 * Long-running agents that poll `messages.list` in a while(true)/setInterval
 * loop re-fetch on a fixed interval (plus per-message get/thread
 * amplification). AgentMail's inbound guide recommends webhooks for
 * production and WebSockets for real-time without a public URL. Advisory:
 * polling is a documented pattern — this only fires on the long-running
 * loop shape, never on one-shot scripts.
 */
import {
  contains,
  createAgentMailFileTracker,
  isHolderMethodCall,
  isInsideTestFile,
  unwrapExpr,
} from '../../utils.js';

function isForeverLoop(node: any): boolean {
  if (node.type === 'WhileStatement' || node.type === 'DoWhileStatement') {
    const test = unwrapExpr(node.test);
    return test?.type === 'Literal' && test.value === true;
  }
  if (node.type === 'ForStatement') return !node.test;
  return false;
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Production agents should receive mail via webhooks/WebSockets, not poll loops',
      category: 'reliability',
      rationale:
        'A forever-loop that polls messages.list every N seconds adds latency, burns rate budget with per-message get/thread amplification, and misses the delivery guarantees of the recommended mechanisms: webhooks ("Recommended for Production", with Svix signature verification) or WebSockets (real-time without a public URL). Polling remains a documented pattern for simple agents — treat this as an architecture nudge for long-running production workloads.',
      docsUrl: 'https://docs.agentmail.to/knowledge-base/handling-inbound-emails',
      recommended: false,
    },
    messages: {
      pollingLoop:
        'Long-running poll loop over messages.list — for production, register a webhook (client.webhooks.create, verify with Svix) or use WebSockets instead of polling.',
    },
    schema: [],
  },
  create(context: any) {
    if (isInsideTestFile(String(context.filename ?? context.getFilename?.() ?? ''))) return {};
    const tracker = createAgentMailFileTracker();
    const longRunningScopes: any[] = [];
    const listCalls: any[] = [];

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },
      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      WhileStatement(node: any) {
        if (isForeverLoop(node)) longRunningScopes.push(node);
      },
      DoWhileStatement(node: any) {
        if (isForeverLoop(node)) longRunningScopes.push(node);
      },
      ForStatement(node: any) {
        if (isForeverLoop(node)) longRunningScopes.push(node);
      },

      CallExpression(node: any) {
        if (
          isHolderMethodCall(node, 'messages', 'list') ||
          isHolderMethodCall(node, 'threads', 'list')
        ) {
          listCalls.push(node);
          return;
        }
        const callee = unwrapExpr(node.callee);
        if (callee?.type === 'Identifier' && callee.name === 'setInterval') {
          const cb = unwrapExpr(node.arguments?.[0]);
          if (cb) longRunningScopes.push(cb);
        }
      },

      'Program:exit'() {
        if (!tracker.isAgentMailFile()) return;
        const polled = listCalls.find((c) =>
          longRunningScopes.some((scope) => contains(scope, c)),
        );
        if (polled) context.report({ node: polled, messageId: 'pollingLoop' });
      },
    };
  },
};

export const agentmailPreferWebhooksInProductionRule = rule;
export default rule;
