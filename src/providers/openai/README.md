# OpenAI

7 oxlint rules for OpenAI Responses API integrations. Three apply to every
Responses API user (`retry-transient-turn-errors`,
`check-response-status-incomplete`, `set-safety-identifier`); four are specific
to computer-use (CUA) flows — `client.responses.create({ tools: [{ type: 'computer' }], ... })` —
and additionally require computer-use evidence before firing.

|                          |                                      |
| ------------------------ | ------------------------------------ |
| **Manifest**             | [manifest.ts](manifest.ts)           |
| **Rule implementations** | [rules/](rules/)                     |
| **Shared AST helpers**   | [utils.ts](utils.ts)                 |
| **Fixtures**             | `tests/fixtures/openai/`         |
| **Rule tests**           | `tests/rules/openai-*.test.ts`   |

Detection: `openai` in package.json or imports, or `api.openai.com` in source.

These rules target integration mistakes specific to building a computer-use agent loop on the Responses API: governance gaps (no domain allowlist, blind safety-check acknowledgment), reliability gaps around the turn loop (no retry on transient errors, not detecting a token-budget truncation disguised as a successful completion), and a few narrower correctness issues in action normalization and request configuration.

---

## Rules and tests by category

### Security

Boundary control and attestation for browser automation actions.

| Rule | Severity | CWE / OWASP | Why it matters | OpenAI docs | Rule file | Test |
| --- | --- | --- | --- | --- | --- | --- |
| No domain allowlist | error | CWE-345, A01:2021 | Without domain allowlist, the agent can navigate to and execute actions on any page, including off-domain redirects or injected content. | [Computer use](https://developers.openai.com/api/docs/guides/tools-computer-use) | [no-domain-allowlist.ts](rules/no-domain-allowlist.ts) | [test](../../../tests/rules/openai-no-domain-allowlist.test.ts) |
| No blind safety-check ack | warning | CWE-345, A08:2023 | System prompt lacks documented confirmation/consent framework, allowing the agent to silently execute risky actions like deleting data, changing permissions, or solving CAPTCHAs. | [Safety considerations](https://developers.openai.com/api/docs/guides/tools-computer-use) | [no-blind-safety-check-ack.ts](rules/no-blind-safety-check-ack.ts) | [test](../../../tests/rules/openai-no-blind-safety-check-ack.test.ts) |

#### Security fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| --- | --- | --- |
| No domain allowlist | `openai-no-domain-allowlist-broken/no-allowlist-param.ts`, `empty-allowlist-array.ts` | `openai-no-domain-allowlist-fixed/domain-allowlist-configured.ts`, `allowlist-check-at-runtime-adversarial.ts` |
| No blind safety-check ack | `openai-no-blind-safety-check-ack-broken/skip-safety-check.ts`, `no-safety-prompt.ts` | `openai-no-blind-safety-check-ack-fixed/safety-ack-in-system-prompt.ts`, `safety-check-external-adversarial.ts` |

---

### Correctness

Action parsing, normalization, and response validation.

| Rule | Severity | Why it matters | OpenAI docs | Rule file | Test |
| --- | --- | --- | --- | --- | --- |
| Scroll delta default zero | error | Missing vertical scroll delta defaults to 700px instead of 0, causing unintended scrolls that desynchronize the agent's mental model of page state. | [Computer use](https://developers.openai.com/api/docs/guides/tools-computer-use) | [scroll-delta-default-zero.ts](rules/scroll-delta-default-zero.ts) | [test](../../../tests/rules/openai-scroll-delta-default-zero.test.ts) |
| Structured step metadata not text/json | warning | Step metadata in the wrong format cannot be properly validated or logged, making debugging and audit trails unreliable. | [Response format](https://developers.openai.com/api/reference/resources/responses) | [structured-step-metadata-not-text-json.ts](rules/structured-step-metadata-not-text-json.ts) | [test](../../../tests/rules/openai-structured-step-metadata-not-text-json.test.ts) |
| Set safety identifier | warning | Without a safety identifier, it's impossible to trace which agent instance initiated a dangerous action or correlate it with user intent. | [Computer use](https://developers.openai.com/api/docs/guides/tools-computer-use) | [set-safety-identifier.ts](rules/set-safety-identifier.ts) | [test](../../../tests/rules/openai-set-safety-identifier.test.ts) |

#### Correctness fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| --- | --- | --- |
| Scroll delta default zero | `openai-scroll-delta-default-zero-broken/default-scroll.ts`, `unset-scroll-delta.ts` | `openai-scroll-delta-default-zero-fixed/scroll-delta-nonzero.ts`, `static-page-no-scroll-adversarial.ts` |
| Structured step metadata not text/json | `openai-structured-step-metadata-not-text-json-broken/text-plain-metadata.ts`, `html-step-metadata.ts` | `openai-structured-step-metadata-not-text-json-fixed/json-metadata.ts`, `no-metadata-field-adversarial.ts` |
| Set safety identifier | `openai-set-safety-identifier-broken/no-identifier.ts`, `missing-safety-id.ts` | `openai-set-safety-identifier-fixed/safety-identifier-set.ts`, `internal-endpoint-no-id-adversarial.ts` |

---

### Reliability

Retry logic and truncation detection on the turn loop.

| Rule | Severity | Why it matters | OpenAI docs | Rule file | Test |
| --- | --- | --- | --- | --- | --- |
| Retry transient turn errors | error | Transient errors (timeouts, rate limits, 5xx) cause the turn loop to crash instead of retry, making the agent unreliable on unstable networks. | [Error handling](https://developers.openai.com/api/reference/resources/responses) | [retry-transient-turn-errors.ts](rules/retry-transient-turn-errors.ts) | [test](../../../tests/rules/openai-retry-transient-turn-errors.test.ts) |
| Check response status incomplete | error | Response with status `incomplete` (token budget exceeded) is treated as success, but the model's action was truncated and never executed, corrupting the task. | [Response status](https://developers.openai.com/api/reference/resources/responses) | [check-response-status-incomplete.ts](rules/check-response-status-incomplete.ts) | [test](../../../tests/rules/openai-check-response-status-incomplete.test.ts) |

#### Reliability fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| --- | --- | --- |
| Retry transient turn errors | `openai-retry-transient-turn-errors-broken/no-retry-loop.ts`, `fail-on-timeout.ts` | `openai-retry-transient-turn-errors-fixed/retry-with-backoff.ts`, `permanent-error-no-retry-adversarial.ts` |
| Check response status incomplete | `openai-check-response-status-incomplete-broken/skip-status-check.ts`, `assume-success.ts` | `openai-check-response-status-incomplete-fixed/check-status-complete.ts`, `status-logged-no-check-adversarial.ts` |

---

## Test summary

| Category    | Rules | Test files | Fixture pairs |
| ----------- | ----- | ---------- | -------------- |
| Security    | 2     | 2          | 2              |
| Correctness | 3     | 3          | 3              |
| Reliability | 2     | 2          | 2              |
| **Total**   | **7** | **7**      | **7**          |

## Out of scope

These patterns require prompt-content verification or external knowledge — not detectable via AST rules alone:

- **Specific confirmation/consent language in system prompt** — Requires evaluating whether prompt text "adequately" covers a safety framework for risky actions (e.g., deleting data, modifying sensitive settings). AST rules cannot judge prompt quality.
- **Prompt-injection defense** — Distinguishing user instructions from on-screen page content in a prompt requires semantic understanding of page structure and user intent, not a code pattern.

## SDK surface coverage

`manifest.ts` also declares a `surface` — the hand-written list of every SDK method
path (verified against `openai@7.2.0` type declarations and cross-checked against
the SDK's method↔endpoint catalog, `api.md` in `openai/openai-node`), which drives
the CLI's informational coverage section and the `sdk_used` telemetry prop.
Coverage is **not a rule**: it never produces findings, never affects the score,
and never reports counts or ratios. The OpenAI Agents SDK (`@openai/agents`) is
deliberately out of scope — its free-function API has no client root the collector
could attribute calls to — and `@openai/agents-realtime` belongs to the
`openai-realtime` provider. Coverage fixtures live in
`tests/fixtures/openai/coverage-*` with tests under `tests/coverage/`.
