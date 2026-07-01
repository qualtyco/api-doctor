# Twilio

9 oxlint rules for the [Twilio](https://www.twilio.com/docs) Node.js SDK (`twilio`), covering webhook security, TaskRouter, and Media Streams, derived from `docs/audits/twilio-audit-2026-06-30.md`.


|                          |                                   |
| ------------------------ | --------------------------------- |
| **Manifest**             | [manifest.ts](manifest.ts)        |
| **Rule implementations** | [rules/](rules/)                  |
| **Shared AST helpers**   | [utils.ts](utils.ts)              |
| **Fixtures**             | `tests/fixtures/twilio/`          |
| **Rule tests**           | `tests/rules/twilio-*.test.ts`    |


Detection: `twilio` in package.json/imports, or `api.twilio.com` in source.

---

## Rules and tests by category

### Security

Forged webhook requests, JSON-injection in TaskRouter attributes, and unescaped XML in TwiML.

| Rule                              | Severity | CWE / OWASP        | Why it matters                                                                                                                                                                                                  | Twilio docs                                                                       | Rule file                                                                       | Test                                                                              |
| ---------------------------------- | -------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Validate webhook signature        | error    | CWE-345, A07:2021   | Webhook URLs are public — anyone who learns the path can POST a forged `CallSid`/`From`/`TaskAttributes` body. Without checking `X-Twilio-Signature`, an attacker can trigger billed outbound calls or falsely invoke a reservation-accepted callback for an arbitrary caller. | [Webhook security](https://www.twilio.com/docs/usage/webhooks/webhooks-security)     | [validate-webhook-signature.ts](rules/validate-webhook-signature.ts)               | [test](../../../tests/rules/twilio-validate-webhook-signature.test.ts)               |
| Enqueue task JSON.stringify       | error    | CWE-116, CWE-91     | Hand-building Task attributes by interpolating a request field into a JSON string literal breaks the moment that field contains a `"` or `\` — the resulting body is invalid JSON and Twilio rejects the Enqueue with error 14221. | [Error 14221](https://www.twilio.com/docs/api/errors/14221)                          | [enqueue-task-json-stringify.ts](rules/enqueue-task-json-stringify.ts)             | [test](../../../tests/rules/twilio-enqueue-task-json-stringify.test.ts)              |
| Use TwiML builder, not templates  | warning  | CWE-91              | The VoiceResponse builder XML-escapes interpolated values automatically; a raw template literal does not. The pattern is safe only as long as every interpolated value stays Twilio-controlled — it breaks the moment one becomes attacker-influenced (e.g. a SIP header). | [Stream verb](https://www.twilio.com/docs/voice/twiml/stream)                        | [use-twiml-builder-not-string-templates.ts](rules/use-twiml-builder-not-string-templates.ts) | [test](../../../tests/rules/twilio-use-twiml-builder-not-string-templates.test.ts)   |

#### Security fixtures

| Rule                              | Broken (`should flag`)                          | Fixed (`should not flag`)                                                                  |
| ----------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Validate webhook signature        | `incoming-call.ts`, `outbound-call.ts`            | `incoming-call.ts` (preHandler + validateRequest), `outbound-call.ts` (adversarial: RequestValidator class form) |
| Enqueue task JSON.stringify       | `outbound-call.ts` (template), `outbound-call-concat.ts` (string concat) | `outbound-call.ts` (JSON.stringify), `outbound-call-static-template.ts` (adversarial: no interpolation) |
| Use TwiML builder, not templates  | `intercept.ts`, `greeting.ts`                     | `intercept.ts` (VoiceResponse builder), `static-twiml.ts` (adversarial: static XML, no interpolation) |

---

### Correctness

A Task attributes shape that drifts from its own consumer, unvalidated request inputs, and a documented-schema mismatch on Media Streams marks.

| Rule                                  | Severity | CWE    | Why it matters                                                                                                                                                                              | Twilio docs                                                                            | Rule file                                                                       | Test                                                                                |
| --------------------------------------- | -------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| TaskRouter attributes match consumer  | error    | —      | A Task is created with attributes like `{ name, type }`, while a reservation handler later does `const { from } = JSON.parse(TaskAttributes)` to look something up. If the producer never set `from`, that destructure is always `undefined` — the lookup always misses and the handler returns 404, even though every other part of the flow worked. | [Enqueue + TaskRouter](https://www.twilio.com/docs/taskrouter/twiml-queue-calls)           | [taskrouter-attributes-match-consumer.ts](rules/taskrouter-attributes-match-consumer.ts) | [test](../../../tests/rules/twilio-taskrouter-attributes-match-consumer.test.ts)       |
| Validate all request inputs           | warning  | CWE-20 | A route that validates `body` but declares no `querystring` schema (or no schema at all) lets unvalidated fields flow downstream as `undefined`. The failure then surfaces far from its root cause — e.g. a later `.toString()` call throws because a query param that "should always be there" never arrived. | [Stream verb](https://www.twilio.com/docs/voice/twiml/stream)                              | [validate-all-request-inputs.ts](rules/validate-all-request-inputs.ts)             | [test](../../../tests/rules/twilio-validate-all-request-inputs.test.ts)                |
| Media Streams mark.name string        | warning  | —      | Twilio's documented `mark` message schema and every example show `mark.name` as a string. Setting it to a bare number (`Date.now()` is a common culprit) means `JSON.stringify()` serializes it as a numeric literal — a latent type mismatch that surfaces once mark-based pacing actually depends on matching mark names. | [WebSocket messages](https://www.twilio.com/docs/voice/media-streams/websocket-messages)   | [media-streams-mark-name-string.ts](rules/media-streams-mark-name-string.ts)       | [test](../../../tests/rules/twilio-media-streams-mark-name-string.test.ts)             |

#### Correctness fixtures

| Rule                                  | Broken (`should flag`)                                | Fixed (`should not flag`)                                                                       |
| ---------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| TaskRouter attributes match consumer  | `flex-routes.ts` (missing `from`), `flex-routes-template.ts` (template form) | `flex-routes.ts` (matching field), `flex-routes-superset.ts` (adversarial: superset of fields) |
| Validate all request inputs           | `incoming-call.ts` (no querystring), `outbound-call.ts` (no schema) | `incoming-call.ts` (querystring added), `ready.ts` (adversarial: no inputs read at all)        |
| Media Streams mark.name string        | `StreamSocket.ts` (`Date.now()`), `sequence-mark.ts` (number literal) | `StreamSocket.ts` (`String(Date.now())`), `labeled-mark.ts` (adversarial: string-valued identifier) |

---

### Reliability

A session map keyed by the wrong identifier, unhandled REST rejections inside event callbacks, and no audio-buffer pacing.

| Rule                                          | Severity | Why it matters                                                                                                                                                                                       | Twilio docs                                                                              | Rule file                                                                                       | Test                                                                                          |
| ------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Media Streams key by callSid                  | error    | A session Map keyed by the caller's phone number breaks the moment the same number places two concurrent calls — a retry after a dropped call, or two family members sharing a line. The second `map.set()` silently overwrites the first call's entry, crossing audio streams between two unrelated calls. Twilio gives every call a unique `callSid` specifically to avoid this. | [WebSocket messages](https://www.twilio.com/docs/voice/media-streams/websocket-messages)     | [media-streams-key-by-call-sid.ts](rules/media-streams-key-by-call-sid.ts)                         | [test](../../../tests/rules/twilio-media-streams-key-by-call-sid.test.ts)                         |
| Await/catch REST calls in event handlers      | error    | Event-emitter callbacks are often invoked via `callbacks.map((cb) => cb(event))`, which discards the returned promise. If the callback is `async` and awaits a Twilio REST call with no try/catch, any REST error (invalid number, suspended account, rate limit) becomes an unhandled rejection — and if the process has a global handler that calls `process.exit()`, one failed outbound call takes down the entire server and every other in-progress call. | [Webhooks FAQ](https://www.twilio.com/docs/usage/webhooks/webhooks-faq)                      | [await-or-catch-rest-calls-in-event-handlers.ts](rules/await-or-catch-rest-calls-in-event-handlers.ts) | [test](../../../tests/rules/twilio-await-or-catch-rest-calls-in-event-handlers.test.ts)           |
| Media Streams mark pacing                     | warning  | Twilio buffers at most 10 minutes of audio per bidirectional Stream. If audio is forwarded with no mark-based pacing and the sender produces media faster than real-time (or playback stalls), Twilio stops accepting further audio and emits warning 31931 — silently dropping audio rather than erroring loudly. This rule is intentionally conservative (best-effort heuristic) to keep false positives low. | [Error 31931](https://www.twilio.com/docs/api/errors/31931)                                  | [media-streams-mark-pacing.ts](rules/media-streams-mark-pacing.ts)                                 | [test](../../../tests/rules/twilio-media-streams-mark-pacing.test.ts)                             |

#### Reliability fixtures

| Rule                                          | Broken (`should flag`)                              | Fixed (`should not flag`)                                                                          |
| ------------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Media Streams key by callSid                  | `intercept.ts`, `flex-reservation-accepted.ts`         | `intercept.ts` (keyed by callSid), `rate-limiter.ts` (adversarial: unrelated computed-key map)     |
| Await/catch REST calls in event handlers      | `intercept.ts` (no try/catch), `flex-events.ts` (try/catch covers the wrong statement) | `intercept.ts` (wrapped in try/catch), `openai-in-handler.ts` (adversarial: non-Twilio SDK)        |
| Media Streams mark pacing                     | `AudioInterceptor.ts`, `forward.ts`                     | `AudioInterceptor.ts` (isLast paced), `forward-with-unrelated-isLast.ts` (adversarial: conservative no-flag) |

---

## Root-cause note

The audit's Finding D (`/outbound-call` never invoked by the real call flow) and Finding N (mixed `<Connect>`/`<Enqueue>` routing strategies) are documented as non-rules — they require cross-file control-flow reachability analysis that a single-file AST rule can't reliably do. `taskrouter-attributes-match-consumer` (Finding E) is kept as an independent rule per the audit's recommendation, since it's a self-contained, unconditionally-true bug regardless of reachability — but because oxlint rules run per file, it only fires when the producer and consumer code live in the same file; the audit's actual two-file case (`outbound-call.ts` + `flex-reservation-accepted.ts`) needs manual review to catch.

---

## Running tests

```bash
pnpm build
npx vitest run tests/rules/twilio-

# Single rule
npx vitest run tests/rules/twilio-validate-webhook-signature.test.ts

# Lint a fixture directory end-to-end
node dist/cli.mjs tests/fixtures/twilio/twilio-validate-webhook-signature-broken
```
