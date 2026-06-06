/**
 * resend-missing-idempotency-key (reliability)
 *
 * Audit finding D [MEDIUM]: send/batch calls should pass an idempotencyKey to
 * prevent duplicate emails on retries. Flags a Resend send call when no object
 * argument carries an `idempotencyKey` property. Checking every object argument
 * accepts the key whether it sits in the payload or a separate options arg.
 */
import { findProperty, isResendSendCall } from '../../utils/resend.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Resend send/batch calls should include an idempotencyKey',
      category: 'reliability',
      docsUrl: 'https://resend.com/docs/send-with-nextjs',
      recommended: true,
    },
    messages: {
      missingIdempotencyKey:
        'Resend send call has no idempotencyKey. Add one to prevent duplicate sends on retry.',
    },
    schema: [],
  },
  create(context: any) {
    return {
      CallExpression(node: any) {
        if (!isResendSendCall(node)) return;
        const hasKey = (node.arguments ?? []).some(
          (arg: any) => arg?.type === 'ObjectExpression' && findProperty(arg, 'idempotencyKey'),
        );
        if (!hasKey) {
          context.report({ node, messageId: 'missingIdempotencyKey' });
        }
      },
    };
  },
};

export const resendMissingIdempotencyKeyRule = rule;
export default rule;
