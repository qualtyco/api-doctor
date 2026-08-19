/**
 * agentmail-configure-recipient-guardrails (security)
 *
 * Long-running auto-reply agents answer *any* sender — including other bots
 * (mail-loop risk) — unless Lists set hard platform boundaries. Flags
 * `.messages.reply(...)` in files that run a long-running loop
 * (while(true)/setInterval) and never create a receive/send List. The reply
 * usually lives in a helper the poll loop calls, so co-occurrence is
 * file-level, not lexical. One-shot reply scripts (the documented
 * label-tracking loop) have no forever loop and are not flagged.
 */
import {
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
  if (node.type === 'ForStatement') return !node.test; // for (;;)
  return false;
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Autonomous auto-reply agents need Lists (allowlist/blocklist) guardrails',
      category: 'security',
      cwe: 'CWE-799',
      owasp: 'API4:2023 Unrestricted Resource Consumption',
      rationale:
        'An agent that auto-replies inside a long-running poll loop answers any inbound sender, including other bots — the only loop guard in typical code is "skip our own address". AgentMail Lists are the documented hard platform boundary for this: a receive-allowlist limits who can trigger the agent, a send-allowlist limits who it can email. The docs call Lists "a critical safety feature for autonomous agents running in production".',
      docsUrl: 'https://docs.agentmail.to/knowledge-base/allowlists-blocklists',
      recommended: true,
    },
    messages: {
      noGuardrails:
        'This long-running agent auto-replies with no Lists guardrails — it will answer any sender, including other bots. Create a receive/send allowlist (client.inboxes.lists.create / client.lists.create).',
    },
    schema: [],
  },
  create(context: any) {
    if (isInsideTestFile(String(context.filename ?? context.getFilename?.() ?? ''))) return {};
    const tracker = createAgentMailFileTracker();
    let longRunning = false;
    const replyCalls: any[] = [];
    let createsList = false;

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },
      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      WhileStatement(node: any) {
        if (isForeverLoop(node)) longRunning = true;
      },
      DoWhileStatement(node: any) {
        if (isForeverLoop(node)) longRunning = true;
      },
      ForStatement(node: any) {
        if (isForeverLoop(node)) longRunning = true;
      },

      CallExpression(node: any) {
        if (isHolderMethodCall(node, 'lists', 'create')) {
          createsList = true;
          return;
        }
        if (isHolderMethodCall(node, 'messages', 'reply')) {
          replyCalls.push(node);
          return;
        }
        const callee = unwrapExpr(node.callee);
        if (callee?.type === 'Identifier' && callee.name === 'setInterval') {
          longRunning = true;
        }
      },

      'Program:exit'() {
        if (!tracker.isAgentMailFile() || createsList) return;
        if (!longRunning || replyCalls.length === 0) return;
        context.report({ node: replyCalls[0], messageId: 'noGuardrails' });
      },
    };
  },
};

export const agentmailConfigureRecipientGuardrailsRule = rule;
