# ElevenLabs

10 oxlint rules for the [ElevenLabs](https://elevenlabs.io) Conversational AI API and `@11labs/client` SDK, derived from `docs/elevenlabs-audit-2026-06-30.md`.


|                          |                                      |
| ------------------------ | ------------------------------------ |
| **Manifest**             | [manifest.ts](manifest.ts)           |
| **Rule implementations** | [rules/](rules/)                     |
| **Shared AST helpers**   | [utils.ts](utils.ts)                 |
| **Fixtures**             | `tests/fixtures/elevenlabs/`         |
| **Rule tests**           | `tests/rules/elevenlabs-*.test.ts`   |


Detection: `@11labs/client`, `elevenlabs`, or `@elevenlabs/elevenlabs-js` in package.json/imports, or `api.elevenlabs.io` in source.

---

## Rules and tests by category

### Security

Raw error logging and predictable session id generation.

| Rule                          | Severity | CWE      | Why it matters | ElevenLabs docs                                              | Rule file                                                       | Test                                                                         |
| ------------------------------ | -------- | -------- | --- | -------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| No error object logging       | error    | CWE-532  | Logging raw error objects can expose sensitive details like API responses, headers, and internal state in server logs. | [API Authentication](https://elevenlabs.io/docs/api-reference/authentication) — keep the API key out of logs/client code | [no-error-object-logging.ts](rules/no-error-object-logging.ts)   | [test](../../../tests/rules/elevenlabs-no-error-object-logging.test.ts)       |
| Secure session id generation  | error    | CWE-338  | Session ID generated with Math.random() is not cryptographically secure and can be predicted by an attacker. | [Secure by Design](https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/security) — general security guidance; ElevenLabs docs don't cover RNG choice directly | [secure-session-id-generation.ts](rules/secure-session-id-generation.ts) | [test](../../../tests/rules/elevenlabs-secure-session-id-generation.test.ts) |

#### Security fixtures

| Rule                          | Broken (`should flag`)                                  | Fixed (`should not flag`)                                              |
| ------------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------- |
| No error object logging       | `route.ts`, `lib-elevenlabs.ts`                          | `route.ts` (sanitized), `lib-elevenlabs.ts` (message-only, adversarial) |
| Secure session id generation  | `ConvAI.tsx`, `lib-elevenlabs.ts`                        | `ConvAI.tsx` (crypto.getRandomValues), `agent-type-select.ts` (adversarial: unrelated Math.random use) |

---

### Correctness

Unvalidated network boundary: response shape, status codes, input format, and startup config.

| Rule                            | Severity | CWE     | Why it matters | ElevenLabs docs                                       | Rule file                                                             | Test                                                                            |
| -------------------------------- | -------- | ------- | --- | -------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Validate signed URL response    | error    | CWE-252 | Response structure is not validated; if the API returns an unexpected response, the code silently returns undefined. | [Get signed URL](https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-signed-url) — documents the `signed_url` response field | [validate-signed-url-response.ts](rules/validate-signed-url-response.ts) | [test](../../../tests/rules/elevenlabs-validate-signed-url-response.test.ts)  |
| Validate agent id format        | error    | CWE-20  | Agent ID query parameter is checked for existence but not validated for format, allowing attackers to send malformed values. | [Agent authentication](https://elevenlabs.io/docs/eleven-agents/customization/authentication) — how `agent_id` is used to obtain a signed URL | [validate-agent-id-format.ts](rules/validate-agent-id-format.ts)         | [test](../../../tests/rules/elevenlabs-validate-agent-id-format.test.ts)      |
| Check HTTP status before json   | error    | —       | Response JSON is parsed without checking HTTP status, causing error responses to be misinterpreted as success. | [Errors](https://elevenlabs.io/docs/eleven-api/resources/errors) — HTTP status codes and the `detail` error body shape | [check-http-status-before-json.ts](rules/check-http-status-before-json.ts) | [test](../../../tests/rules/elevenlabs-check-http-status-before-json.test.ts) |
| Env var validation              | warning  | —       | API key is not validated at module load time, so missing or invalid keys fail at runtime instead of failing fast. | [API Authentication](https://elevenlabs.io/docs/api-reference/authentication) — the `xi-api-key` requirement this validates | [env-var-validation.ts](rules/env-var-validation.ts)                     | [test](../../../tests/rules/elevenlabs-env-var-validation.test.ts)            |

#### Correctness fixtures

| Rule                          | Broken (`should flag`)                          | Fixed (`should not flag`)                                                    |
| ------------------------------ | -------------------------------------------------- | -------------------------------------------------------------------------- |
| Validate signed URL response  | `route.ts`, `lib-elevenlabs.ts`                  | `route.ts` (guarded), `lib-mock-signed-url.ts` (adversarial: non-API mock) |
| Validate agent id format      | `route.ts`, `lib-elevenlabs.ts`                  | `route.ts` (regex validated), `lib-log-agent-id.ts` (adversarial: non-API usage) |
| Check HTTP status before json | `route.ts`, `lib-elevenlabs.ts`                  | `route.ts` (response.ok), `lib-elevenlabs.ts` (adversarial: response.status check) |
| Env var validation            | `route.ts`, `lib-elevenlabs.ts`                  | `route.ts` (module-scope), `route-openai.ts` (adversarial: non-ElevenLabs key) |

---

### Reliability

Network timeouts, version pinning, and conversation lifecycle cleanup.

| Rule                          | Severity | Why it matters | ElevenLabs docs                                       | Rule file                                                       | Test                                                                          |
| ------------------------------ | -------- | --- | -------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Fetch timeout required        | warning  | Fetch requests have no timeout; if the API becomes slow or unresponsive, the request will hang indefinitely. | [Get signed URL](https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-signed-url) — the REST endpoint being fetched with no timeout | [fetch-timeout-required.ts](rules/fetch-timeout-required.ts)       | [test](../../../tests/rules/elevenlabs-fetch-timeout-required.test.ts)        |
| Conversation error recovery   | warning  | If getSignedUrl() fails, error handling may not reset loading state properly, allowing multiple concurrent failed attempts. | [JavaScript SDK](https://elevenlabs.io/docs/eleven-agents/libraries/java-script) — `startSession`/`endSession`/`onError` lifecycle | [conversation-error-recovery.ts](rules/conversation-error-recovery.ts) | [test](../../../tests/rules/elevenlabs-conversation-error-recovery.test.ts)  |
| API version pinning           | warning  | Without explicit API version, unannounced breaking changes can silently break the integration. | [Breaking changes policy](https://elevenlabs.io/docs/eleven-api/resources/breaking-changes-policy) — what ElevenLabs treats as a breaking API change | [api-version-pinning.ts](rules/api-version-pinning.ts)             | [test](../../../tests/rules/elevenlabs-api-version-pinning.test.ts)           |
| Conversation cleanup on error | warning  | On error, the conversation session is not ended, leaving the websocket open and consuming resources. | [JavaScript SDK](https://elevenlabs.io/docs/eleven-agents/libraries/java-script) — `endSession` ends the conversation and disconnects the websocket | [conversation-cleanup-on-error.ts](rules/conversation-cleanup-on-error.ts) | [test](../../../tests/rules/elevenlabs-conversation-cleanup-on-error.test.ts) |

#### Reliability fixtures

| Rule                          | Broken (`should flag`)                  | Fixed (`should not flag`)                                                   |
| ------------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------- |
| Fetch timeout required        | `route.ts`, `lib-elevenlabs.ts`          | `route.ts` (AbortController), `lib-elevenlabs.ts` (adversarial: spread options) |
| Conversation error recovery   | `ConvAI.tsx`, `Widget.tsx`                | `ConvAI.tsx` (reset in catch), `Widget.tsx` (adversarial: reset in finally) |
| API version pinning           | `route.ts`, `lib-elevenlabs.ts`          | `route.ts` (explicit header), `lib-elevenlabs.ts` (adversarial: spread shared headers) |
| Conversation cleanup on error | `ConvAI.tsx`, `lib-cleanup.ts`            | `ConvAI.tsx` (direct try/catch), `lib-cleanup.ts` (adversarial: call inside unrelated try) |

---

## Root-cause note

Findings A, C, D, H, I in the audit cluster as "Inadequate error handling and validation on network boundaries" — five separate rules here (`validate-signed-url-response`, `fetch-timeout-required`, `validate-agent-id-format`, `check-http-status-before-json`, `conversation-cleanup-on-error`) rather than one meta-rule, per the audit's recommendation to keep them granular for reviewers.

---

## Running tests

```bash
pnpm build
npx vitest run tests/rules/elevenlabs-

# Single rule
npx vitest run tests/rules/elevenlabs-validate-signed-url-response.test.ts

# Lint a fixture directory end-to-end
node dist/cli.mjs tests/fixtures/elevenlabs/elevenlabs-validate-signed-url-response-broken
```
