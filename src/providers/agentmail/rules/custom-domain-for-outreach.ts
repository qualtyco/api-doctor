/**
 * agentmail-custom-domain-for-outreach (correctness)
 *
 * Cold-outreach campaigns sent from the shared @agentmail.to domain ride on
 * reputation shared across all users — the spam guide says it is for
 * testing, and production sending should use a (warmed-up) custom
 * subdomain. Flags `inboxes.create` with no `domain` in files that also
 * run a bulk send loop; single transactional sends are not flagged.
 */
import {
  contains,
  createAgentMailFileTracker,
  findProperty,
  hasSpread,
  isHolderMethodCall,
  isInsideTestFile,
  unwrapExpr,
} from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Outreach campaigns should send from a verified custom subdomain, not @agentmail.to',
      category: 'correctness',
      rationale:
        'The shared @agentmail.to domain carries reputation shared across all users — fine for testing, a liability for production cold outreach, where full-volume sending from a fresh shared-domain inbox is a top cause of spam-foldering. Create the outreach inbox on a verified custom subdomain (agents.yourcompany.com avoids MX conflicts with the root domain) and warm it up gradually.',
      docsUrl: 'https://docs.agentmail.to/knowledge-base/emails-going-to-spam',
      recommended: true,
    },
    messages: {
      sharedDomainOutreach:
        'This campaign sends from the shared @agentmail.to domain — shared reputation, spam-folder risk. Create the inbox on a verified custom subdomain (e.g. agents.yourcompany.com) and warm it up.',
    },
    schema: [],
  },
  create(context: any) {
    if (isInsideTestFile(String(context.filename ?? context.getFilename?.() ?? ''))) return {};
    const tracker = createAgentMailFileTracker();
    const loops: any[] = [];
    const sendCalls: any[] = [];
    const domainlessCreates: any[] = [];

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
      },
      ForInStatement(node: any) {
        loops.push(node);
      },
      WhileStatement(node: any) {
        loops.push(node);
      },
      DoWhileStatement(node: any) {
        loops.push(node);
      },

      CallExpression(node: any) {
        if (isHolderMethodCall(node, 'messages', 'send')) {
          sendCalls.push(node);
          return;
        }
        if (!isHolderMethodCall(node, 'inboxes', 'create')) return;
        const args = node.arguments ?? [];
        if (args.length === 0) {
          domainlessCreates.push(node);
          return;
        }
        const arg0 = unwrapExpr(args[0]);
        if (arg0?.type !== 'ObjectExpression' || hasSpread(arg0)) return; // can't verify
        if (!findProperty(arg0, 'domain')) domainlessCreates.push(node);
      },

      'Program:exit'() {
        if (!tracker.isAgentMailFile()) return;
        // Outreach shape = a send inside a loop in the same file.
        const bulkSends = sendCalls.some((s) => loops.some((l) => contains(l, s)));
        if (!bulkSends) return;
        for (const node of domainlessCreates) {
          context.report({ node, messageId: 'sharedDomainOutreach' });
        }
      },
    };
  },
};

export const agentmailCustomDomainForOutreachRule = rule;
export default rule;
