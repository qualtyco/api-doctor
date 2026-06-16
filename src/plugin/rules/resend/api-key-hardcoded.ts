/**
 * resend-api-key-hardcoded (security)
 *
 * Flags Resend API key literals (`re_...`) embedded directly in source code.
 * Keys must come from `process.env.RESEND_API_KEY` (audit "COMPLIANT AREAS" #1).
 *
 * Detection is AST-based: it inspects string `Literal` and `TemplateElement`
 * VALUES only, so the same token appearing in a comment is never a node and is
 * naturally ignored. A leading word boundary keeps the pattern from matching
 * inside unrelated identifiers like `pre_release`.
 */

// Resend secret keys are prefixed with `re_`. Word boundary avoids `pre_...`.
const RESEND_KEY_PATTERN = /\bre_[A-Za-z0-9_]+/;

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Resend API keys must not be hardcoded; load them from environment variables',
      category: 'security',
      cwe: 'CWE-798',
      owasp: 'API8:2023 Security Misconfiguration',
      rationale:
        'A hardcoded API key gets committed to version control, where it lives in git history forever and is exposed to anyone with repository access. Leaked Resend keys let attackers send mail from your domain, damaging sender reputation and deliverability. Reading the key from process.env.RESEND_API_KEY keeps the secret out of source code and lets you rotate it without a redeploy.',
      docsUrl: 'https://resend.com/docs/send-with-nextjs#prerequisites',
      recommended: true,
    },
    messages: {
      hardcodedApiKey:
        'Hardcoded Resend API key detected. Load the key from process.env.RESEND_API_KEY instead.',
    },
    schema: [],
  },
  create(context: any) {
    return {
      Literal(node: any) {
        if (typeof node.value !== 'string') return;
        if (RESEND_KEY_PATTERN.test(node.value)) {
          context.report({ node, messageId: 'hardcodedApiKey' });
        }
      },

      TemplateElement(node: any) {
        const cooked = node?.value?.cooked ?? node?.value?.raw;
        if (typeof cooked !== 'string') return;
        if (RESEND_KEY_PATTERN.test(cooked)) {
          context.report({ node, messageId: 'hardcodedApiKey' });
        }
      },
    };
  },
};

export const resendApiKeyHardcodedRule = rule;
export default rule;
