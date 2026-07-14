/**
 * agentmail-check-unauthenticated-label (security)
 *
 * AgentMail drops inbound mail only when SPF/DKIM/DMARC headers are present
 * and fail; mail with MISSING auth headers is still delivered, labeled
 * `unauthenticated`. A forged email with no auth headers therefore passes
 * any `from === USER_EMAIL` check. Flags sender-equality authorization in
 * files that never inspect labels for "unauthenticated".
 */
import { createAgentMailFileTracker, isInsideTestFile, mentions, unwrapExpr } from '../utils.js';

const SENDERISH = /^from$|sender|approver|author/i;
const SELFISH = /inbox|self|own|our/i;
const EQ_OPS = new Set(['==', '===', '!=', '!==']);

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Sender-based authorization must also reject unauthenticated-labeled messages',
      category: 'security',
      cwe: 'CWE-290',
      owasp: 'API2:2023 Broken Authentication',
      rationale:
        'AgentMail delivers mail whose authentication headers are missing (rather than failing), labeled "unauthenticated". A spoofed email with no SPF/DKIM/DMARC headers therefore reaches the inbox and passes a bare from-address equality check. Sender-based authorization is only trustworthy when the message does not carry the unauthenticated label.',
      docsUrl: 'https://docs.agentmail.to/knowledge-base/inbound-emails-missing',
      recommended: true,
    },
    messages: {
      missingLabelCheck:
        'This from-address check can be spoofed by mail with missing auth headers. Also require that message.labels does not include "unauthenticated".',
    },
    schema: [],
  },
  create(context: any) {
    if (isInsideTestFile(String(context.filename ?? context.getFilename?.() ?? ''))) return {};
    const tracker = createAgentMailFileTracker();
    const senderComparisons: any[] = [];
    let checksUnauthenticated = false;

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },
      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      Literal(node: any) {
        if (node?.value === 'unauthenticated') checksUnauthenticated = true;
      },

      BinaryExpression(node: any) {
        if (!EQ_OPS.has(node.operator)) return;
        const { left, right } = node;
        const leftSender = mentions(left, SENDERISH);
        const rightSender = mentions(right, SENDERISH);
        if (!leftSender && !rightSender) return;
        // Comparing the sender to our own address is the skip-own-messages
        // loop guard every poll loop needs — not authorization.
        const other = unwrapExpr(leftSender ? right : left);
        if (mentions(other, SELFISH)) return;
        // Comparing against a literal like `""` or a non-address sentinel is noise.
        if (other?.type === 'Literal' && typeof other.value === 'string' && !other.value.includes('@')) {
          return;
        }
        senderComparisons.push(node);
      },

      'Program:exit'() {
        if (!tracker.isAgentMailFile()) return;
        if (checksUnauthenticated) return;
        for (const node of senderComparisons) {
          context.report({ node, messageId: 'missingLabelCheck' });
        }
      },
    };
  },
};

export const agentmailCheckUnauthenticatedLabelRule = rule;
export default rule;
