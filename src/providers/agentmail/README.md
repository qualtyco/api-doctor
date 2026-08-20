# AgentMail rules

Rules for the [`agentmail`](https://docs.agentmail.to/welcome) SDK, derived from `docs/audits/agentmail-audit-2026-07-14.md` (an audit of AgentMail's 14 official TypeScript example projects — patterns coding agents copy verbatim).

## Security

| Rule | Severity | What it catches |
|------|----------|-----------------|
| `agentmail/verify-approval-reply-sender` | warning | Approve/decline parsed from an email body with no sender verification — any thread participant (including the requester) can approve their own request |
| `agentmail/check-unauthenticated-label` | warning | `from`-equality authorization in a file that never rejects the `unauthenticated` label — spoofable by mail with missing SPF/DKIM/DMARC headers |
| `agentmail/configure-recipient-guardrails` | warning | Long-running auto-reply loop with no Lists (allowlist/blocklist) guardrails — replies to any sender, mail-loop exposure |

## Correctness

| Rule | Severity | What it catches |
|------|----------|-----------------|
| `agentmail/inbox-create-client-id` | error | `inboxes.create` without a deterministic `clientId` — a new inbox (and a new agent address) on every fresh run |
| `agentmail/draft-create-client-id` | warning | `drafts.create` without `clientId` — duplicate drafts when a crash lands between create and the state update |
| `agentmail/html-fallback-for-inbound-body` | warning | Inbound body built from `text`/`extractedText` only — HTML-only mail (Gmail/Outlook forwards) reads as empty |
| `agentmail/no-message-id-as-thread-id` | info | `threadId ?? messageId` — stores a message ID where a thread ID belongs, so reply routing never matches |
| `agentmail/custom-domain-for-outreach` | warning | Bulk outreach from the shared `@agentmail.to` domain instead of a verified custom subdomain |

## Reliability

| Rule | Severity | What it catches |
|------|----------|-----------------|
| `agentmail/handle-send-failure-status` | error | Blanket catch around sends — permanent 403 (suppressed recipient) failures retried forever |
| `agentmail/throttle-bulk-sends` | warning | `messages.send` in a loop with no inter-iteration delay — bursts the whole list from one address |
| `agentmail/label-failed-messages` | warning | Per-message catch with no label transition — the message stays `unread` and every poll retries it |
| `agentmail/attachment-size-guard` | warning | File/network content attached inline with no size check — handlers cap inline base64 `content` at 6 MB; use the `url` field (30 MB) for larger files. Limits provider-confirmed 2026-07-14 (docs update pending); both fields verified in `agentmail@0.4.20` |
| `agentmail/prefer-webhooks-in-production` | info | Forever-loop polling `messages.list` — webhooks/WebSockets are the recommended production mechanisms |
| `agentmail/html-requires-text` | info | `html` body with no `text` part — deliverability and text-only-client failure (text-only sends are fine) |

## Compatibility

Code versus the SDK version this project has installed. These rules never suggest upgrading: an old call on a deliberately pinned old version is correct and stays silent forever. They fire only when the code calls a client method that provably does not exist in what `node_modules`/the lockfile/a pinned range resolves to — a runtime `TypeError` that nothing else catches in plain `.js` files, because the import and the constructor are unchanged. The receiver must trace to the SDK (construction, SDK constructor import, alias, or `this.<prop>`), so a project's own object with the same method name never matches. Removals are hand-verified against both published tarballs (implementation, not just the type diff) in [compatibility.ts](compatibility.ts); silence whenever the installed version cannot be resolved.

| Rule | Severity | Why it matters | Docs | Rule file | Test |
| ---- | -------- | --- | ---- | --------- | ---- |
| removed-method | error | `metrics.query` was split into `queryEvents` (`GET /v0/metrics/events`) and `queryUsage` (`GET /v0/metrics/usage`) in 0.5.12 — two different endpoints, not a rename. Covers the account-level, per-inbox and per-pod `metrics` resources alike. | [API reference](https://docs.agentmail.to/api-reference) | [removed-method.ts](rules/js/removed-method.ts) | [test](../../../tests/rules/agentmail-removed-method.test.ts) |
