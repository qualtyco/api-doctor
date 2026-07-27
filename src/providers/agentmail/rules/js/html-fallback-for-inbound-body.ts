/**
 * agentmail-html-fallback-for-inbound-body (correctness)
 *
 * `message.text` (and `preview`) are derived from the email's text/plain
 * MIME part and are documented to be absent when clients — particularly
 * Gmail and Outlook — send HTML-only mail, which is common for forwards.
 * Files that build the processing body exclusively from `.text` /
 * `.extractedText` treat an HTML-only forwarded invoice as "(empty body)"
 * and misclassify or drop it. Flags text reads in inbound-processing files
 * with no `.html` fallback anywhere in the file.
 */
import {
  createAgentMailFileTracker,
  endOffset,
  isHolderMethodCall,
  isInsideTestFile,
  memberPropName,
  startOffset,
} from '../../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Inbound message bodies need an HTML fallback — text can be absent on HTML-only mail',
      category: 'correctness',
      rationale:
        'The text and preview fields come from the email\'s text/plain MIME part and are absent when the sender\'s client transmits HTML only — the docs call out Gmail and Outlook forwards specifically. Building the classification body from text/extractedText alone turns an HTML-only forwarded invoice or request into an empty body that gets discarded or misclassified. Fall back to converting message.html when text is missing.',
      docsUrl: 'https://docs.agentmail.to/messages',
      recommended: true,
    },
    messages: {
      noHtmlFallback:
        'This inbound body is read from text/extractedText only — HTML-only mail (common for Gmail/Outlook forwards) arrives with no text part. Fall back to converting message.html.',
    },
    schema: [],
  },
  create(context: any) {
    if (isInsideTestFile(String(context.filename ?? context.getFilename?.() ?? ''))) return {};
    const tracker = createAgentMailFileTracker();
    const textReads: any[] = [];
    /** range keys of member expressions used as a call's callee (`res.text()`). */
    const calledMembers = new Set<string>();
    let readsHtml = false;
    let fetchesInbound = false;

    const rangeKey = (n: any): string => `${startOffset(n)}:${endOffset(n)}`;

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },
      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      MemberExpression(node: any) {
        const prop = memberPropName(node);
        if (prop === 'extractedText' || prop === 'text' || prop === 'preview') {
          textReads.push(node);
        }
        if (prop === 'html') readsHtml = true;
      },

      CallExpression(node: any) {
        // `res.text()` (fetch API) is a call, not a message-field read.
        if (node.callee?.type === 'MemberExpression') {
          calledMembers.add(rangeKey(node.callee));
        }
        if (
          isHolderMethodCall(node, 'messages', 'get') ||
          isHolderMethodCall(node, 'messages', 'list') ||
          isHolderMethodCall(node, 'threads', 'get') ||
          isHolderMethodCall(node, 'threads', 'list')
        ) {
          fetchesInbound = true;
        }
      },

      'Program:exit'() {
        if (!tracker.isAgentMailFile() || !fetchesInbound || readsHtml) return;
        const fieldRead = textReads.find((n) => !calledMembers.has(rangeKey(n)));
        if (fieldRead) context.report({ node: fieldRead, messageId: 'noHtmlFallback' });
      },
    };
  },
};

export const agentmailHtmlFallbackForInboundBodyRule = rule;
export default rule;
