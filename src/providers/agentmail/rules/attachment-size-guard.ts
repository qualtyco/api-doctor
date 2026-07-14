/**
 * agentmail-attachment-size-guard (reliability)
 *
 * AgentMail's handlers cap inline base64 `content` attachments at 6 MB;
 * larger files must go through the `url` attachment field (up to 30 MB).
 * (Limits provider-confirmed by the AgentMail team, 2026-07-14 — not yet
 * on the attachments docs page; both fields verified in agentmail@0.4.20's
 * SendAttachment type.) Base64 inflates raw bytes ~33%, so a file read
 * from disk or the network can silently cross the cap. Flags outbound
 * calls with inline-content attachments in files that read dynamic file
 * data with no size check anywhere.
 */
import {
  createAgentMailFileTracker,
  findProperty,
  isHolderMethodCall,
  isInsideTestFile,
  memberPropName,
  mentions,
  objectArgs,
  unwrapExpr,
} from '../utils.js';

const FILE_READS = /^(readFile|readFileSync|createReadStream|arrayBuffer)$/;
const SIZEISH = /length|size|byte/i;
const COMPARISON_OPS = new Set(['<', '>', '<=', '>=']);

function isOutboundCall(node: any): boolean {
  return (
    isHolderMethodCall(node, 'messages', 'send') ||
    isHolderMethodCall(node, 'messages', 'reply') ||
    isHolderMethodCall(node, 'drafts', 'create')
  );
}

/** True when the attachments array is statically all-`url` (no inline content). */
function usesUrlOnly(attachmentsValue: any): boolean {
  const arr = unwrapExpr(attachmentsValue);
  if (arr?.type !== 'ArrayExpression') return false;
  const elements = (arr.elements ?? []).map((e: any) => unwrapExpr(e));
  if (elements.length === 0) return false;
  return elements.every(
    (el: any) => el?.type === 'ObjectExpression' && !findProperty(el, 'content'),
  );
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Inline attachment content needs a size check — handlers cap it at 6 MB',
      category: 'reliability',
      rationale:
        'AgentMail caps inline base64 attachment content at 6 MB per the AgentMail team (provider-confirmed 2026-07-14; docs update pending) — larger files must use the url attachment field, which supports up to 30 MB. Base64 encoding inflates raw bytes by ~33%, so a raw file over ~4.5 MB already exceeds the inline cap. File or network content has unknown size at build time: check it before attaching, and fall back to the url field for anything larger.',
      docsUrl: 'https://docs.agentmail.to/attachments',
      recommended: true,
    },
    messages: {
      unguardedAttachment:
        'Attachment content comes from a file/network read with no size check — inline base64 content is capped at 6 MB. Check the payload size and use the url attachment field (up to 30 MB) for larger files.',
    },
    schema: [],
  },
  create(context: any) {
    if (isInsideTestFile(String(context.filename ?? context.getFilename?.() ?? ''))) return {};
    const tracker = createAgentMailFileTracker();
    const attachmentProps: any[] = [];
    let readsDynamicContent = false;
    let checksSize = false;

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },
      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      BinaryExpression(node: any) {
        if (!COMPARISON_OPS.has(node.operator)) return;
        if (mentions(node.left, SIZEISH) || mentions(node.right, SIZEISH)) {
          checksSize = true;
        }
      },

      CallExpression(node: any) {
        const callee = unwrapExpr(node.callee);
        const name = callee?.type === 'Identifier' ? callee.name : memberPropName(callee) ?? '';
        if (FILE_READS.test(name)) readsDynamicContent = true;

        if (!isOutboundCall(node)) return;
        for (const options of objectArgs(node)) {
          const attachments = findProperty(options, 'attachments');
          if (!attachments) continue;
          if (usesUrlOnly(attachments.value)) continue; // url attachments carry the 30 MB path
          attachmentProps.push(attachments);
        }
      },

      'Program:exit'() {
        if (!tracker.isAgentMailFile()) return;
        if (!readsDynamicContent || checksSize) return;
        for (const node of attachmentProps) {
          context.report({ node, messageId: 'unguardedAttachment' });
        }
      },
    };
  },
};

export const agentmailAttachmentSizeGuardRule = rule;
export default rule;
