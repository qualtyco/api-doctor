/**
 * resend-from-address-not-friendly-format (integration)
 *
 * Audit finding C (secondary): Resend doc examples use the friendly-name form
 * `Acme <onboarding@acme.com>`. Flags a `from` value that is a bare email
 * literal with no display name. Advisory only (info).
 */
import { findProperty, getSendOptionObjects } from '../../utils/resend.js';

// Bare email: has an `@`, and no angle brackets (no "Name <...>" wrapper).
const BARE_EMAIL = /^[^<>]+@[^<>]+$/;

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Resend from addresses should use the friendly-name format "Name <email>"',
      category: 'integration',
      docsUrl: 'https://resend.com/docs/api-reference/emails/send-email',
      recommended: true,
    },
    messages: {
      bareFromAddress:
        'From address is a bare email. Use the friendly format "Name <email@domain>" as shown in the docs.',
    },
    schema: [],
  },
  create(context: any) {
    return {
      CallExpression(node: any) {
        for (const opts of getSendOptionObjects(node)) {
          const fromProp = findProperty(opts, 'from');
          const value = fromProp?.value;
          if (
            value?.type === 'Literal' &&
            typeof value.value === 'string' &&
            BARE_EMAIL.test(value.value.trim())
          ) {
            context.report({ node: value, messageId: 'bareFromAddress' });
          }
        }
      },
    };
  },
};

export const resendFromAddressNotFriendlyFormatRule = rule;
export default rule;
