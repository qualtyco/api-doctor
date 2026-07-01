# OpenAI Realtime API

9 oxlint rules for the [OpenAI Realtime API](https://developers.openai.com/api/docs/guides/realtime), derived from `docs/audits/openai-realtime-audit-2026-06-30.md`. This is a raw-WebSocket integration (no `openai` npm package dependency), audited against a live Twilio↔OpenAI translation sample.


|                          |                                       |
| ------------------------ | ------------------------------------- |
| **Manifest**             | [manifest.ts](manifest.ts)            |
| **Rule implementations** | [rules/](rules/)                      |
| **Shared AST helpers**   | [utils.ts](utils.ts)                  |
| **Fixtures**              | `tests/fixtures/openai-realtime/`     |
| **Rule tests**           | `tests/rules/openai-realtime-*.test.ts` |


Detection: `api.openai.com/v1/realtime` in source (URL-pattern only — the audited sample speaks the Realtime WebSocket protocol directly with hand-rolled auth headers, with no `openai` package dependency to key off of).

---

## Rules and tests by category

### Security

Live call content logged in plaintext, and missing abuse/safety connection metadata.

| Rule                          | Severity | CWE     | Scenario                                                                                                                          | OpenAI docs                                                                            | Rule file                                                                         | Test                                                                                              |
| ------------------------------ | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| No log raw message payloads    | error    | CWE-532 | Every inbound Realtime message — including `response.audio.delta` payloads carrying base64-encoded live call audio — is logged verbatim at `info` level with no redaction. | [Realtime guide](https://developers.openai.com/api/docs/guides/realtime)               | [no-log-raw-message-payloads.ts](rules/no-log-raw-message-payloads.ts)           | [test](../../../tests/rules/openai-realtime-no-log-raw-message-payloads.test.ts)                      |
| Send safety identifier         | info     | —       | Neither the caller- nor agent-side WebSocket sets an `OpenAI-Safety-Identifier` header, so OpenAI's abuse/safety monitoring has no per-connection signal to correlate misuse back to an account. | [Realtime guide](https://developers.openai.com/api/docs/guides/realtime)               | [send-safety-identifier.ts](rules/send-safety-identifier.ts)                     | [test](../../../tests/rules/openai-realtime-send-safety-identifier.test.ts)                           |

#### Security fixtures

| Rule                        | Broken (`should flag`)                              | Fixed (`should not flag`)                                                                  |
| ---------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| No log raw message payloads  | `01-template-literal.ts`, `02-to-string-direct-arg.ts` | `01-debug-with-derived-field.ts` (logs `{ type }` only), `02-adversarial-non-openai-socket.ts` (adversarial: a different WebSocket entirely) |
| Send safety identifier       | `01-no-headers-object.ts`, `02-no-options-arg.ts`      | `01-header-present.ts`, `02-adversarial-non-openai-socket.ts` (adversarial: a non-Realtime WebSocket also missing the header) |

---

### Correctness

The integration is frozen at the beta Realtime surface — stale headers, dated model snapshots, an unverified session field, and the wrong transcription model.

| Rule                              | Severity | Scenario                                                                                                                                          | OpenAI docs                                                                                          | Rule file                                                                                | Test                                                                                                  |
| ----------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Migrate beta to GA                  | error    | The connection still sends `OpenAI-Beta: realtime=v1`, even though OpenAI's guide states beta integrations must migrate to the GA interface — removing that header is listed as a required step — before new work proceeds. | [Realtime guide](https://developers.openai.com/api/docs/guides/realtime)                             | [migrate-beta-to-ga.ts](rules/migrate-beta-to-ga.ts)                                    | [test](../../../tests/rules/openai-realtime-migrate-beta-to-ga.test.ts)                                    |
| Avoid dated preview snapshots       | warning  | The model is pinned to `gpt-4o-realtime-preview-2024-10-01`, the oldest available dated preview snapshot, instead of the floating `gpt-realtime` GA alias — maximizing exposure to a future retirement with no fallback path. | [Realtime sessions reference](https://developers.openai.com/api/docs/api-reference/realtime-sessions) | [avoid-dated-preview-snapshots.ts](rules/avoid-dated-preview-snapshots.ts)              | [test](../../../tests/rules/openai-realtime-avoid-dated-preview-snapshots.test.ts)                         |
| Verify deprecated session fields    | warning  | The session config sets `temperature: 0.6` to force deterministic translation output, but two independent fetches of the current GA sessions reference did not surface `temperature` as a documented field at all. | [Realtime sessions reference](https://developers.openai.com/api/docs/api-reference/realtime-sessions) | [verify-deprecated-session-fields.ts](rules/verify-deprecated-session-fields.ts)        | [test](../../../tests/rules/openai-realtime-verify-deprecated-session-fields.test.ts)                      |
| Transcription model choice          | info     | `input_audio_transcription` is configured with `whisper-1`, which OpenAI's docs explicitly describe as not natively streaming, instead of the realtime-optimized `gpt-realtime-whisper`. | [Realtime transcription guide](https://developers.openai.com/api/docs/guides/realtime-transcription)  | [transcription-model-choice.ts](rules/transcription-model-choice.ts)                    | [test](../../../tests/rules/openai-realtime-transcription-model-choice.test.ts)                            |

#### Correctness fixtures

| Rule                           | Broken                                       | Fixed                                                                                              |
| -------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Migrate beta to GA                | `01-caller-socket.ts`, `02-agent-socket.ts`     | `01-ga-no-beta-header.ts`, `02-non-openai-socket-with-beta-header.ts` (adversarial: a third-party socket reusing the `OpenAI-Beta` header name) |
| Avoid dated preview snapshots     | `01-template-literal-url.ts`, `02-inline-literal-url.ts` | `01-ga-alias.ts`, `02-adversarial-dated-ga-snapshot.ts` (adversarial: a *dated* but non-preview GA snapshot) |
| Verify deprecated session fields  | `01-caller-config.ts`, `02-agent-config.ts`     | `01-no-temperature.ts`, `02-adversarial-unrelated-temperature.ts` (adversarial: `temperature` on an unrelated, non-Realtime object) |
| Transcription model choice        | `01-caller-config.ts`, `02-agent-config.ts`     | `01-streaming-model.ts`, `02-adversarial-unrelated-whisper1.ts` (adversarial: `whisper-1` inside a non-`session.update` payload) |

---

### Reliability

A live phone call has no recovery path: silent API errors, dead connections after a transient drop, and dropped audio during the connect handshake.

| Rule                              | Severity | Scenario                                                                                                                                      | OpenAI docs                                                                                                    | Rule file                                                                              | Test                                                                                                |
| ----------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Handle error server event           | error    | Message handlers branch on `input_audio_buffer.speech_stopped` and `response.audio.delta` but never check for the Realtime API's own `error` event, so rate limits, moderation blocks, or invalid session updates fail silently. | [Realtime server events reference](https://developers.openai.com/api/docs/api-reference/realtime_server_events) | [handle-error-server-event.ts](rules/handle-error-server-event.ts)                    | [test](../../../tests/rules/openai-realtime-handle-error-server-event.test.ts)                          |
| Reconnect on drop                   | error    | Both the caller- and agent-side sockets only log on `close`/`error` and never reopen a session, so a single transient OpenAI-side disconnect permanently kills translation for the rest of a multi-minute call. | [Realtime guide](https://developers.openai.com/api/docs/guides/realtime)                                       | [reconnect-on-drop.ts](rules/reconnect-on-drop.ts)                                    | [test](../../../tests/rules/openai-realtime-reconnect-on-drop.test.ts)                                  |
| Buffer audio until session ready    | warning  | Audio chunks that arrive from Twilio before the OpenAI socket finishes its connect + `session.update` round-trip are dropped instead of queued, so every call loses the first fragment of caller speech. | [Media Streams WebSocket messages](https://developers.openai.com/api/docs/voice/media-streams/websocket-messages) | [buffer-audio-until-session-ready.ts](rules/buffer-audio-until-session-ready.ts)      | [test](../../../tests/rules/openai-realtime-buffer-audio-until-session-ready.test.ts)                   |

#### Reliability fixtures

| Rule                              | Broken                                              | Fixed                                                                                                  |
| ------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Handle error server event            | `01-if-chain.ts`, `02-switch.ts`                          | `01-error-branch-present.ts`, `02-adversarial-no-type-dispatch.ts` (adversarial: a handler with no `message.type` branching at all) |
| Reconnect on drop                    | `01-log-only.ts`, `02-noop-close.ts`                      | `01-reconnect-call.ts`, `02-adversarial-non-openai-close.ts` (adversarial: a log-only close handler on a non-Realtime socket) |
| Buffer audio until session ready     | `01-send-message-helper.ts`, `02-inline-arrow.ts`         | `01-buffered-and-flushed.ts`, `02-adversarial-different-readystate-check.ts` (adversarial: a `readyState` check against `CLOSED`, not `OPEN`) |

---

## Root-cause note

Findings D, E, F, G in the audit cluster as "integration frozen at the OpenAI Realtime beta surface": the beta header is still sent, the model is pinned to the oldest dated preview snapshot, an unverifiable `temperature` field is asserted, and a non-streaming transcription model is configured — four separate, independently-occurring symptoms of the same un-migrated state, kept as four granular rules (`migrate-beta-to-ga`, `avoid-dated-preview-snapshots`, `verify-deprecated-session-fields`, `transcription-model-choice`) rather than one meta-rule, per the audit's recommendation.

## Out of scope

Three audit findings have no corresponding rule:

- **Finding B** (unauthenticated audio reaching a billed API) — requires correlating this provider's findings with the companion Twilio audit's webhook-auth gap; not detectable from a single file in isolation.
- **Finding K** (unbounded latency-tracking arrays) — real but too generic a pattern ("array pushed to in a loop, never trimmed") to flag without high false-positive rates across unrelated code.
- **Findings L/M** (general voice-agent model + hand-prompted translation vs. the dedicated translation session type; two sessions per call vs. one) — architectural/cost tradeoffs, not static-detectable defects.
- **Finding N** — duplicate of Finding C (`send-safety-identifier`), listed in the audit only for category bookkeeping.

---

## Running tests

```bash
pnpm build
npx vitest run tests/rules/openai-realtime-

# Single rule
npx vitest run tests/rules/openai-realtime-migrate-beta-to-ga.test.ts

# Lint a fixture directory end-to-end
node dist/cli.mjs tests/fixtures/openai-realtime/openai-realtime-migrate-beta-to-ga-broken
```

### Test harness

Rule tests use [tests/helpers/lint-rule.ts](../../../tests/helpers/lint-rule.ts):

- `fixtureFiles(ruleKey, 'broken' | 'fixed', 'openai-realtime')` — resolves `tests/fixtures/openai-realtime/<rule-key>-<kind>/`
- `lintFileForRule(ruleKey, filePath)` — runs oxlint with only that rule enabled
