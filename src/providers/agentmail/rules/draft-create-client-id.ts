/**
 * agentmail-draft-create-client-id (correctness)
 *
 * `drafts.create` without a deterministic `clientId` is not retry-safe: a
 * crash between the create and the state update that records it produces a
 * second identical draft on the next poll — and a digest that lists all
 * drafts then shows duplicates for the user to send twice. The
 * duplicate-sends guide shows `clientId` on drafts.create as the canonical
 * fix (note: clientId must not contain "@").
 */
import {
  createAgentMailFileTracker,
  findProperty,
  hasSpread,
  isHolderMethodCall,
  isInsideTestFile,
  objectArgs,
} from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'drafts.create needs a deterministic clientId to prevent duplicate drafts on retry',
      category: 'correctness',
      rationale:
        'A crash or failed label update between drafts.create and the write that records it produces a second identical draft on the next poll iteration; review digests that list all drafts then present duplicates the user can send twice. With a deterministic clientId (derived from the triggering message — remember clientId cannot contain "@"), retried creates return the existing draft instead.',
      docsUrl: 'https://docs.agentmail.to/knowledge-base/preventing-duplicate-sends',
      recommended: true,
    },
    messages: {
      missingClientId:
        'drafts.create without clientId duplicates the draft when the poll retries. Pass a deterministic clientId derived from the triggering message (no "@" allowed).',
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
        if (!isHolderMethodCall(node, 'drafts', 'create')) return;
        const options = objectArgs(node);
        if (options.length === 0) return; // options built elsewhere — can't verify
        if (options.some((o) => hasSpread(o))) return;
        if (!options.some((o) => findProperty(o, 'clientId'))) flagged.push(node);
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

export const agentmailDraftCreateClientIdRule = rule;
export default rule;
