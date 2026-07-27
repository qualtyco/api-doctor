/**
 * agentmail-inbox-create-client-id (correctness)
 *
 * `inboxes.create()` without a deterministic `clientId` creates a brand-new
 * inbox on every fresh checkout, container restart, or CI run: the agent's
 * address silently changes (replies to the old address are lost), orphaned
 * inboxes accumulate, and the Free plan's 3-inbox cap is exhausted after
 * three runs. With `clientId`, retries and redeploys return the same inbox.
 */
import {
  createAgentMailFileTracker,
  findProperty,
  hasSpread,
  isHolderMethodCall,
  isInsideTestFile,
  unwrapExpr,
} from '../../utils.js';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'inboxes.create needs a deterministic clientId to be safe to run repeatedly',
      category: 'correctness',
      rationale:
        'Without clientId, every run that reaches inboxes.create makes a new inbox: the agent\'s email address changes so correspondents replying to the old address are never seen again, orphaned inboxes accumulate, and the Free plan\'s 3-inbox cap is hit after three runs. AgentMail\'s idempotency support exists precisely for this — pass a deterministic clientId and repeated calls return the same inbox.',
      docsUrl: 'https://docs.agentmail.to/idempotency',
      recommended: true,
    },
    messages: {
      missingClientId:
        'inboxes.create without clientId creates a new inbox on every run. Pass a deterministic clientId (e.g. "support-inbox-v1") so retries and redeploys return the same inbox.',
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

      CallExpression(node: any) {
        if (!isHolderMethodCall(node, 'inboxes', 'create')) return;
        const args = node.arguments ?? [];
        if (args.length === 0) {
          // `client.inboxes.create()` — the quickstart shape; still not retry-safe.
          flagged.push(node);
          return;
        }
        const arg0 = unwrapExpr(args[0]);
        if (arg0?.type !== 'ObjectExpression') return; // options built elsewhere — can't verify
        if (hasSpread(arg0)) return; // spread may carry clientId — can't verify
        if (!findProperty(arg0, 'clientId')) flagged.push(node);
      },

      'Program:exit'() {
        if (!tracker.isAgentMailFile()) return;
        for (const node of flagged) {
          context.report({ node, messageId: 'missingClientId' });
        }
      },
    };
  },
};

export const agentmailInboxCreateClientIdRule = rule;
export default rule;
