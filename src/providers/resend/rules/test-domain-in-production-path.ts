/**
 * resend-test-domain-in-production-path (correctness)
 *
 * Audit finding C [HIGH]: `onboarding@resend.dev` is for testing only and must
 * not be used as a production from address (it 403s to non-owner recipients).
 * Flags the literal anywhere in non-test source, which also covers the
 * `process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"` fallback (the
 * fallback's right-hand side is the same string literal).
 *
 * Test files are skipped — using the test domain in tests is expected.
 */
import { isInsideTestFile } from '../utils.js';

const TEST_DOMAIN = 'onboarding@resend.dev';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not use the onboarding@resend.dev test domain in production code',
      category: 'correctness',
      rationale:
        'onboarding@resend.dev is a shared test sender that only delivers to the account owner; sending from it to any other recipient returns a 403 error. Shipping it to production — including as a `?? "onboarding@resend.dev"` fallback — means real users silently never receive their email. Sending from a verified domain configured via process.env.RESEND_FROM_EMAIL is the documented production requirement.',
      docsUrl: 'https://resend.com/docs/send-with-nextjs',
      recommended: true,
    },
    messages: {
      testDomain:
        'onboarding@resend.dev is a test-only sender. Use a verified domain (via process.env) in production.',
    },
    schema: [],
  },
  create(context: any) {
    if (isInsideTestFile(String(context.filename ?? ''))) return {};

    return {
      Literal(node: any) {
        if (typeof node.value === 'string' && node.value.includes(TEST_DOMAIN)) {
          context.report({ node, messageId: 'testDomain' });
        }
      },
      TemplateElement(node: any) {
        const cooked = node?.value?.cooked ?? node?.value?.raw;
        if (typeof cooked === 'string' && cooked.includes(TEST_DOMAIN)) {
          context.report({ node, messageId: 'testDomain' });
        }
      },
    };
  },
};

export const resendTestDomainInProductionPathRule = rule;
export default rule;
