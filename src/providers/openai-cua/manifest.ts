import type { ProviderManifest } from '../../types.js';

export const openaiCuaManifest: ProviderManifest = {
  name: 'openai-cua',
  displayName: 'OpenAI Computer Use',
  detect: {
    packages: ['openai'],
    pythonPackages: ['openai'],
    imports: ['openai'],
    pythonImports: ['openai'],
    urlPatterns: ['api.openai.com'],
  },
  rules: [
    // RULE-DISABLED 2026-07-28 (pre-launch): overfitting, 295/307 (96%) false
    // positives in review. Commenting out the entry disables the rule for BOTH
    // engines at once (the JS rule and its dormant Python port share this key),
    // so it cannot quietly come back when the Python engine is switched on.
    // Rule, tests and fixtures are intact.
    // {
    //   key: 'openai-cua-no-domain-allowlist',
    //   resultRule: 'openai-cua/security/no-domain-allowlist',
    //   message: 'Computer-use actions execute against the current page with no domain/origin allowlist check.',
    //   fix: 'Check the page origin against a configured allowlist before executing click/type/fill actions, and require explicit opt-in for cross-domain navigation.',
    //   docsUrl: 'https://developers.openai.com/api/docs/guides/tools-computer-use',
    //   severity: 'error',
    //   languages: ['javascript', 'python'],
    // },
    {
      key: 'openai-cua-scroll-delta-default-zero',
      resultRule: 'openai-cua/correctness/scroll-delta-default-zero',
      message: 'A missing vertical scroll delta defaults to a non-zero value instead of 0.',
      fix: 'Default the missing scroll delta to 0 on both axes, matching the reference scroll handler.',
      docsUrl: 'https://developers.openai.com/api/docs/guides/tools-computer-use',
      severity: 'error',
      languages: ['javascript', 'python'],
    },
    {
      key: 'openai-cua-structured-step-metadata-not-text-json',
      resultRule: 'openai-cua/correctness/structured-step-metadata-not-text-json',
      message: 'Step metadata is extracted by brace-hunting in free text instead of structured tool output.',
      fix: 'Add a function tool (e.g. report_step) or use structured output (text.format) instead of parsing JSON found via indexOf/lastIndexOf in the message text.',
      docsUrl: 'https://developers.openai.com/api/docs/guides/tools-computer-use',
      severity: 'warning',
      languages: ['javascript', 'python'],
    },
    {
      key: 'openai-cua-no-blind-safety-check-ack',
      resultRule: 'openai-cua/correctness/no-blind-safety-check-ack',
      message: 'Pending safety checks are acknowledged by a filter that never inspects .code or .message.',
      fix: 'Evaluate each check\'s code/message against an actual policy before acknowledging it, or omit acknowledged_safety_checks entirely if you rely on harness-level confirmation instead.',
      docsUrl: 'https://developers.openai.com/api/docs/guides/tools-computer-use',
      severity: 'warning',
      languages: ['javascript', 'python'],
    },
    {
      key: 'openai-cua-retry-transient-turn-errors',
      resultRule: 'openai-cua/reliability/retry-transient-turn-errors',
      message: 'responses.create() has no turn-level retry, so a transient error ends the entire run.',
      fix: 'Catch typed transient exceptions (RateLimitError, APIConnectionError, InternalServerError) and retry that turn with backoff before falling back to ending the run.',
      docsUrl: 'https://developers.openai.com/api/docs/guides/tools-computer-use',
      severity: 'error',
      languages: ['javascript', 'python'],
    },
    {
      key: 'openai-cua-check-response-status-incomplete',
      resultRule: 'openai-cua/reliability/check-response-status-incomplete',
      message: 'A completion check treats "no tool calls" as success without checking response.status === "incomplete".',
      fix: 'Check response.status === "incomplete" before treating a tool-call-free response as a successful completion; retry with a larger token budget or fail the run explicitly otherwise.',
      docsUrl: 'https://developers.openai.com/api/docs/guides/tools-computer-use',
      severity: 'error',
      languages: ['javascript', 'python'],
    },
    {
      key: 'openai-cua-set-safety-identifier',
      resultRule: 'openai-cua/correctness/set-safety-identifier',
      message: 'responses.create() call has no safety_identifier (or user) parameter.',
      fix: 'Thread a stable, hashed per-customer identifier through to every responses.create() call as safety_identifier.',
      docsUrl: 'https://developers.openai.com/api/docs/guides/safety-best-practices',
      severity: 'warning',
      languages: ['javascript', 'python'],
    },
  ],
};
