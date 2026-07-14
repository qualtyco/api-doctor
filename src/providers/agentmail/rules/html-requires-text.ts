/**
 * agentmail-html-requires-text (integration)
 *
 * The spam guide's dual-format rule: an outbound email with an `html` body
 * and no `text` part hurts deliverability and readability on text-only
 * clients. Targets only the html-without-text case — text-only sends (the
 * quickstart shape) are documented-correct and never flagged.
 */
import {
  createAgentMailFileTracker,
  findProperty,
  hasSpread,
  isHolderMethodCall,
  isInsideTestFile,
  objectArgs,
} from '../utils.js';

function isOutboundCall(node: any): boolean {
  return (
    isHolderMethodCall(node, 'messages', 'send') ||
    isHolderMethodCall(node, 'messages', 'reply') ||
    isHolderMethodCall(node, 'drafts', 'create')
  );
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Emails sent with an html body must also provide a text version',
      category: 'integration',
      rationale:
        'Providing both html and text versions is the sending guide\'s critical best practice: HTML-only mail renders as nothing on text-only clients and scores worse with spam filters, which read a missing text/plain part as a bulk-mail signal. Generate the text part from the same content as the HTML.',
      docsUrl: 'https://docs.agentmail.to/knowledge-base/emails-going-to-spam',
      recommended: true,
    },
    messages: {
      htmlWithoutText:
        'This send provides html but no text part — text-only clients see nothing and spam filters penalize it. Add a text version of the same content.',
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
        if (!isOutboundCall(node)) return;
        for (const options of objectArgs(node)) {
          if (hasSpread(options)) continue;
          if (findProperty(options, 'html') && !findProperty(options, 'text')) {
            flagged.push(options);
          }
        }
      },

      'Program:exit'() {
        if (!tracker.isAgentMailFile()) return;
        for (const node of flagged) {
          context.report({ node, messageId: 'htmlWithoutText' });
        }
      },
    };
  },
};

export const agentmailHtmlRequiresTextRule = rule;
export default rule;
