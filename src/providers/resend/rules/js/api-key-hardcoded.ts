/**
 * resend-api-key-hardcoded (security)
 *
 * Flags Resend API key literals (`re_...`) embedded directly in source code.
 * Keys must come from `process.env.RESEND_API_KEY`.
 *
 * Detection is AST-based: it inspects string `Literal` and `TemplateElement`
 * VALUES only, so the same token appearing in a comment is never a node and is
 * naturally ignored. A leading word boundary keeps the pattern from matching
 * inside unrelated identifiers like `pre_release`.
 *
 * `re_` is also an extremely common snake_case prefix (`re_activate_available_at`,
 * `re_engagement_flag`…), so a candidate only counts as a key when it has the
 * shape of a real Resend secret: `re_` + an optional short key-id segment +
 * a long random token — at least 16 alphanumeric characters in total,
 * containing a digit or uppercase letter (random base62 practically always
 * does; snake_case words never do). Multi-underscore identifiers never match.
 */

// Candidate extractor: `re_` + word characters. Word boundary avoids `pre_...`.
const RESEND_KEY_CANDIDATE = /\bre_[A-Za-z0-9_]+/g;

/** True when a `re_...` token has the shape of a real Resend secret key. */
function looksLikeResendKey(token: string): boolean {
  const segments = token.slice('re_'.length).split('_');
  // Real keys are `re_<token>` or `re_<keyid>_<token>`; three or more
  // segments is a snake_case identifier, not a key.
  if (segments.length > 2 || segments.some((s) => s.length === 0)) return false;
  const chars = segments.join('');
  if (chars.length < 16) return false;
  return /[0-9A-Z]/.test(chars);
}

function containsResendKey(value: string): boolean {
  const candidates = value.match(RESEND_KEY_CANDIDATE) ?? [];
  return candidates.some(looksLikeResendKey);
}

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
        if (containsResendKey(node.value)) {
          context.report({ node, messageId: 'hardcodedApiKey' });
        }
      },

      TemplateElement(node: any) {
        const cooked = node?.value?.cooked ?? node?.value?.raw;
        if (typeof cooked !== 'string') return;
        if (containsResendKey(cooked)) {
          context.report({ node, messageId: 'hardcodedApiKey' });
        }
      },
    };
  },
};

export const resendApiKeyHardcodedRule = rule;
