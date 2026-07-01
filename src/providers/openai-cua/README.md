# OpenAI Computer Use

7 oxlint rules for OpenAI Responses API computer-use (CUA) integrations — `client.responses.create({ tools: [{ type: 'computer' }], ... })`.

|                          |                                      |
| ------------------------ | ------------------------------------ |
| **Manifest**             | [manifest.ts](manifest.ts)           |
| **Rule implementations** | [rules/](rules/)                     |
| **Shared AST helpers**   | [utils.ts](utils.ts)                 |
| **Fixtures**             | `tests/fixtures/openai-cua/`         |
| **Rule tests**           | `tests/rules/openai-cua-*.test.ts`   |

Detection: `openai` in package.json or imports, or `api.openai.com` in source.

These rules target integration mistakes specific to building a computer-use agent loop on the Responses API: governance gaps (no domain allowlist, blind safety-check acknowledgment), reliability gaps around the turn loop (no retry on transient errors, not detecting a token-budget truncation disguised as a successful completion), and a few narrower correctness/integration issues in action normalization and request configuration.

---

## Rules and tests by category

### Security

Boundary control and attestation for browser automation actions.

| Rule | Severity | CWE / OWASP | Why it matters | OpenAI docs | Rule file | Test |
| --- | --- | --- | --- | --- | --- | --- |
| No domain allowlist | error | CWE-345, A01:2021 | Without domain allowlist, the agent can navigate to and execute actions on any page, including off-domain redirects or injected content. | [Computer use](https://platform.openai.com/docs/guides/computer-use) | [no-domain-allowlist.ts](rules/no-domain-allowlist.ts) | [test](../../../tests/rules/openai-cua-no-domain-allowlist.test.ts) |
| No blind safety-check ack | warning | CWE-345, A08:2023 | System prompt lacks documented confirmation/consent framework, allowing the agent to silently execute risky actions like deleting data, changing permissions, or solving CAPTCHAs. | [Safety considerations](https://platform.openai.com/docs/guides/computer-use#safety) | [no-blind-safety-check-ack.ts](rules/no-blind-safety-check-ack.ts) | [test](../../../tests/rules/openai-cua-no-blind-safety-check-ack.test.ts) |

#### Security fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| --- | --- | --- |
| No domain allowlist | `openai-cua-no-domain-allowlist-broken/no-allowlist-param.ts`, `empty-allowlist-array.ts` | `openai-cua-no-domain-allowlist-fixed/domain-allowlist-configured.ts`, `allowlist-check-at-runtime-adversarial.ts` |
| No blind safety-check ack | `openai-cua-no-blind-safety-check-ack-broken/skip-safety-check.ts`, `no-safety-prompt.ts` | `openai-cua-no-blind-safety-check-ack-fixed/safety-ack-in-system-prompt.ts`, `safety-check-external-adversarial.ts` |

---

### Correctness

Action parsing, normalization, and response validation.

| Rule | Severity | Why it matters | OpenAI docs | Rule file | Test |
| --- | --- | --- | --- | --- | --- |
| Scroll delta default zero | error | Missing vertical scroll delta defaults to 700px instead of 0, causing unintended scrolls that desynchronize the agent's mental model of page state. | [Computer use](https://platform.openai.com/docs/guides/computer-use) | [scroll-delta-default-zero.ts](rules/scroll-delta-default-zero.ts) | [test](../../../tests/rules/openai-cua-scroll-delta-default-zero.test.ts) |
| Structured step metadata not text/json | warning | Step metadata in the wrong format cannot be properly validated or logged, making debugging and audit trails unreliable. | [Response format](https://platform.openai.com/docs/api-reference/responses-api) | [structured-step-metadata-not-text-json.ts](rules/structured-step-metadata-not-text-json.ts) | [test](../../../tests/rules/openai-cua-structured-step-metadata-not-text-json.test.ts) |
| Set safety identifier | warning | Without a safety identifier, it's impossible to trace which agent instance initiated a dangerous action or correlate it with user intent. | [Computer use](https://platform.openai.com/docs/guides/computer-use) | [set-safety-identifier.ts](rules/set-safety-identifier.ts) | [test](../../../tests/rules/openai-cua-set-safety-identifier.test.ts) |

#### Correctness fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| --- | --- | --- |
| Scroll delta default zero | `openai-cua-scroll-delta-default-zero-broken/default-scroll.ts`, `unset-scroll-delta.ts` | `openai-cua-scroll-delta-default-zero-fixed/scroll-delta-nonzero.ts`, `static-page-no-scroll-adversarial.ts` |
| Structured step metadata not text/json | `openai-cua-structured-step-metadata-not-text-json-broken/text-plain-metadata.ts`, `html-step-metadata.ts` | `openai-cua-structured-step-metadata-not-text-json-fixed/json-metadata.ts`, `no-metadata-field-adversarial.ts` |
| Set safety identifier | `openai-cua-set-safety-identifier-broken/no-identifier.ts`, `missing-safety-id.ts` | `openai-cua-set-safety-identifier-fixed/safety-identifier-set.ts`, `internal-endpoint-no-id-adversarial.ts` |

---

### Reliability

Retry logic and truncation detection on the turn loop.

| Rule | Severity | Why it matters | OpenAI docs | Rule file | Test |
| --- | --- | --- | --- | --- | --- |
| Retry transient turn errors | error | Transient errors (timeouts, rate limits, 5xx) cause the turn loop to crash instead of retry, making the agent unreliable on unstable networks. | [Error handling](https://platform.openai.com/docs/api-reference/responses-api#error-handling) | [retry-transient-turn-errors.ts](rules/retry-transient-turn-errors.ts) | [test](../../../tests/rules/openai-cua-retry-transient-turn-errors.test.ts) |
| Check response status incomplete | error | Response with status `incomplete` (token budget exceeded) is treated as success, but the model's action was truncated and never executed, corrupting the task. | [Response status](https://platform.openai.com/docs/api-reference/responses-api#response-object) | [check-response-status-incomplete.ts](rules/check-response-status-incomplete.ts) | [test](../../../tests/rules/openai-cua-check-response-status-incomplete.test.ts) |

#### Reliability fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| --- | --- | --- |
| Retry transient turn errors | `openai-cua-retry-transient-turn-errors-broken/no-retry-loop.ts`, `fail-on-timeout.ts` | `openai-cua-retry-transient-turn-errors-fixed/retry-with-backoff.ts`, `permanent-error-no-retry-adversarial.ts` |
| Check response status incomplete | `openai-cua-check-response-status-incomplete-broken/skip-status-check.ts`, `assume-success.ts` | `openai-cua-check-response-status-incomplete-fixed/check-status-complete.ts`, `status-logged-no-check-adversarial.ts` |

---

## Test summary

| Category    | Rules | Test files | Fixture pairs |
| ----------- | ----- | ---------- | -------------- |
| Security    | 2     | 2          | 2              |
| Correctness | 3     | 3          | 3              |
| Reliability | 2     | 2          | 2              |
| **Total**   | **7** | **7**      | **7**          |

### Running tests

```bash
# All OpenAI CUA rule tests
pnpm build
npx vitest run tests/rules/openai-cua-

# Single rule
npx vitest run tests/rules/openai-cua-no-domain-allowlist.test.ts

# Lint a fixture directory end-to-end
node dist/cli.mjs tests/fixtures/openai-cua/openai-cua-no-domain-allowlist-broken
```

### Test harness

Rule tests use [tests/helpers/lint-rule.ts](../../../tests/helpers/lint-rule.ts):

- `fixtureDir(ruleKey, 'broken' | 'fixed', 'openai-cua')` — resolves `tests/fixtures/openai-cua/<rule-key>-<kind>/`
- `lintFileForRule(ruleKey, filePath)` — runs oxlint with only that rule enabled

---

## Severity in reports

| Severity | Count | Affects score |
| -------- | ----- | ------------- |
| error    | 4     | −15 each      |
| warning  | 3     | −5 each       |

Structured reports include each rule's `meta.docs.rationale` under **Why this matters** (markdown export).

---

## Out of scope

These patterns require prompt-content verification or external knowledge — not detectable via AST rules alone:

- **Specific confirmation/consent language in system prompt** — Requires evaluating whether prompt text "adequately" covers a safety framework for risky actions (e.g., deleting data, modifying sensitive settings). AST rules cannot judge prompt quality.
- **Prompt-injection defense** — Distinguishing user instructions from on-screen page content in a prompt requires semantic understanding of page structure and user intent, not a code pattern.
