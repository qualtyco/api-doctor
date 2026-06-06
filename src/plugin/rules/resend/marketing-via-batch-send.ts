/**
 * resend-marketing-via-batch-send (correctness)
 *
 * Audit finding A [CRITICAL]: the campaign route sends promotional content with
 * `resend.batch.send` (the transactional batch API). Docs direct marketing
 * sends to Broadcasts, not batch send.
 *
 * Detection: a `.batch.send(...)` call in a file whose path indicates marketing
 * (campaign/marketing/newsletter/promotion/broadcast). The audit's signal is
 * the route path `app/api/emails/campaign/route.ts`.
 */
import { isResendBatchSendCall } from '../../utils/resend.js';

const MARKETING_PATH = /marketing|campaign|newsletter|promotion|broadcast/i;

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Marketing emails should use the Broadcasts API, not resend.batch.send',
      category: 'correctness',
      docsUrl: 'https://resend.com/docs/dashboard/emails/batch-sending',
      recommended: true,
    },
    messages: {
      marketingViaBatch:
        'Marketing/campaign email sent via resend.batch.send. Use the Broadcasts API for marketing sends.',
    },
    schema: [],
  },
  create(context: any) {
    const isMarketingFile = MARKETING_PATH.test(String(context.filename ?? ''));

    return {
      CallExpression(node: any) {
        if (!isMarketingFile) return;
        if (isResendBatchSendCall(node)) {
          context.report({ node, messageId: 'marketingViaBatch' });
        }
      },
    };
  },
};

export const resendMarketingViaBatchSendRule = rule;
export default rule;
