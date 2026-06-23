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

## Rules

| Rule | Category | Severity |
| --- | --- | --- |
| `openai-cua-no-domain-allowlist` | security | error |
| `openai-cua-scroll-delta-default-zero` | correctness | error |
| `openai-cua-structured-step-metadata-not-text-json` | correctness | warning |
| `openai-cua-no-blind-safety-check-ack` | correctness | warning |
| `openai-cua-retry-transient-turn-errors` | reliability | error |
| `openai-cua-check-response-status-incomplete` | reliability | error |
| `openai-cua-set-safety-identifier` | integration | warning |

Two related concerns were intentionally left out: requiring specific confirmation/consent language in an agent's system prompt for risky actions, and requiring a prompt-injection defense distinguishing user instructions from on-screen page content. Both are prompt-content requirements, not code patterns — an AST rule can't verify whether prompt text "adequately" covers a safety framework like that.
