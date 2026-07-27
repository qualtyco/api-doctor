/**
 * agentmail-verify-approval-reply-sender (security)
 *
 * Human-in-the-loop agents parse "approve"/"decline" out of email reply
 * bodies. Every participant of the pending thread — including the vendor
 * or requester who triggered the review — can reply, so parsing a decision
 * without first verifying the sender lets an attacker approve their own
 * request (in the x402 example: fire a payment). Flags decision-keyword
 * parsing of message body text in files that never compare a sender/from
 * address (and never check the `unauthenticated` label).
 */
import { createAgentMailFileTracker, isInsideTestFile, memberCallObject, mentions, unwrapExpr } from '../../utils.js';

const DECISION_KEYWORDS = new Set([
  'approve',
  'approved',
  'decline',
  'declined',
  'reject',
  'rejected',
  'lgtm',
]);

/** Expressions carrying email body text: `body`, `replyText`, `decision`, `message.text`… */
const BODYISH = /body|text|reply|content|decision|command/i;
/** Expressions carrying the sender identity: `from`, `sender`, `senderEmail(...)`, approver… */
const SENDERISH = /^from$|sender|approver|author/i;
/** Comparisons against our own address are self-skip loop guards, not authorization. */
const SELFISH = /inbox|self|own|our/i;

const EQ_OPS = new Set(['==', '===', '!=', '!==']);
const MATCHER_METHODS = new Set(['includes', 'startsWith', 'endsWith']);

function isDecisionLiteral(node: any): boolean {
  const n = unwrapExpr(node);
  return (
    n?.type === 'Literal' &&
    typeof n.value === 'string' &&
    DECISION_KEYWORDS.has(n.value.toLowerCase())
  );
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Approval replies must verify the sender before acting on the decision',
      category: 'security',
      cwe: 'CWE-862',
      owasp: 'API5:2023 Broken Function Level Authorization',
      rationale:
        'The requester who triggered a review is a participant of the pending thread, so any unread reply on it — including one the requester sends themselves — reaches the decision parser. Parsing "approve" without first checking that the message\'s from address is the authorized approver (and that it does not carry the unauthenticated label) turns the approval flow into an attacker-controlled signal. AgentMail\'s inbound SPF/DKIM/DMARC enforcement is what makes the from field trustworthy for this check.',
      docsUrl: 'https://docs.agentmail.to/knowledge-base/human-in-the-loop',
      recommended: true,
    },
    messages: {
      unverifiedDecision:
        'Approval/decline is parsed from an email body without verifying the sender first. Check the message from address against the authorized approver and reject unauthenticated-labeled messages.',
    },
    schema: [],
  },
  create(context: any) {
    if (isInsideTestFile(String(context.filename ?? context.getFilename?.() ?? ''))) return {};
    const tracker = createAgentMailFileTracker();
    const decisionNodes: any[] = [];
    let senderVerified = false;

    function noteSenderComparison(left: any, right: any): void {
      const leftSender = mentions(left, SENDERISH);
      const rightSender = mentions(right, SENDERISH);
      if (!leftSender && !rightSender) return;
      // `sender === ourAddress` is the ubiquitous skip-own-messages guard,
      // not an authorization check — don't count it as verification.
      const other = leftSender ? right : left;
      if (mentions(other, SELFISH)) return;
      senderVerified = true;
    }

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },
      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      BinaryExpression(node: any) {
        if (!EQ_OPS.has(node.operator)) return;
        const { left, right } = node;
        if (
          (isDecisionLiteral(left) && mentions(right, BODYISH)) ||
          (isDecisionLiteral(right) && mentions(left, BODYISH))
        ) {
          decisionNodes.push(node);
        }
        noteSenderComparison(left, right);
      },

      SwitchStatement(node: any) {
        // `switch (decision) { case 'approved': ... }`
        if (!mentions(node.discriminant, BODYISH)) return;
        for (const c of node.cases ?? []) {
          if (isDecisionLiteral(c?.test)) {
            decisionNodes.push(c.test);
            return;
          }
        }
      },

      CallExpression(node: any) {
        for (const method of MATCHER_METHODS) {
          const obj = memberCallObject(node, method);
          if (!obj) continue;
          const arg = node.arguments?.[0];
          if (method === 'includes' && unwrapExpr(arg)?.value === 'unauthenticated') {
            // `labels.includes("unauthenticated")` — the other half of the check.
            senderVerified = true;
            return;
          }
          if (isDecisionLiteral(arg) && mentions(obj, BODYISH)) {
            decisionNodes.push(node);
          }
          return;
        }
      },

      'Program:exit'() {
        if (!tracker.isAgentMailFile()) return;
        if (senderVerified || decisionNodes.length === 0) return;
        context.report({ node: decisionNodes[0], messageId: 'unverifiedDecision' });
      },
    };
  },
};

export const agentmailVerifyApprovalReplySenderRule = rule;
export default rule;
