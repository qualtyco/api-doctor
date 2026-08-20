# api-doctor

[![node version](https://img.shields.io/npm/v/@api-doctor/cli)](https://www.npmjs.com/package/@api-doctor/cli)
[![npm downloads](https://img.shields.io/npm/dt/@api-doctor/cli?color=007ec6)](https://www.npmjs.com/package/@api-doctor/cli)

api-doctor scans AI-generated code for bad API integrations.

Deterministic AST rules. Not a prompt. Same input, same output, every time.


**<u>[Website](https://apidoctor.co) → </u>**


[https://github.com/user-attachments/assets/53dab24f-528b-4f1b-87a9-8870002053d8](https://github.com/user-attachments/assets/53dab24f-528b-4f1b-87a9-8870002053d8)


## Quick Start

```bash
npx @api-doctor/cli .
```

After running it installs api-doctor as a skill
at `.agents/skills/api-doctor/SKILL.md` type _"\api-doctor fix it"_ to get a quick fix or integrate our [CI](https://apidoctor.co/ci) for larger and continous fixes

## Install In Your Codebase (recommended)

→ **[Run it in CI on every PR](https://apidoctor.co/ci)**

## 📦 Supported Providers

| Provider | Rules | SDK verified |
| --- | --- | --- |
| [Resend](https://resend.com/docs) | [13 rules](https://github.com/qualtyco/api-doctor/blob/main/src/providers/resend/README.md) | `resend` 6.20.0 |
| [Supabase](https://supabase.com/docs) | [13 rules](https://github.com/qualtyco/api-doctor/blob/main/src/providers/supabase/README.md) | `@supabase/supabase-js` 2.112.3 |
| [Auth0](https://auth0.com/docs) | [4 rules](https://github.com/qualtyco/api-doctor/blob/main/src/providers/auth0/README.md) | `auth0` 6.3.0 |
| [Firebase](https://firebase.google.com/docs) | [19 rules](https://github.com/qualtyco/api-doctor/blob/main/src/providers/firebase/README.md) | — |
| [Browserbase](https://docs.browserbase.com) | [12 rules](https://github.com/qualtyco/api-doctor/blob/main/src/providers/browserbase/README.md) | `@browserbasehq/sdk` 2.18.0 |
| [OpenAI](https://platform.openai.com/docs/api-reference) | [6 rules](https://github.com/qualtyco/api-doctor/blob/main/src/providers/openai/README.md) | — |
| [Tiptap](https://tiptap.dev/docs) | [11 rules](https://github.com/qualtyco/api-doctor/blob/main/src/providers/tiptap/README.md) | `@tiptap/react` 3.30.2 |
| [ElevenLabs](https://elevenlabs.io/docs) | [10 rules](https://github.com/qualtyco/api-doctor/blob/main/src/providers/elevenlabs/README.md) | `@elevenlabs/elevenlabs-js` 2.64.0 |
| [Twilio](https://www.twilio.com/docs) | [7 rules](https://github.com/qualtyco/api-doctor/blob/main/src/providers/twilio/README.md) | — |
| [OpenAI Realtime](https://developers.openai.com/api/docs/guides/realtime) | [9 rules](https://github.com/qualtyco/api-doctor/blob/main/src/providers/openai-realtime/README.md) | — |
| [S2](https://s2.dev/docs/intro) | [18 rules](https://github.com/qualtyco/api-doctor/blob/main/src/providers/s2/README.md) | `@s2-dev/streamstore` 0.26.0 |
| [AgentMail](https://docs.agentmail.to/welcome) | [15 rules](https://github.com/qualtyco/api-doctor/blob/main/src/providers/agentmail/README.md) | `agentmail` 0.5.20 |

Full rule catalogs live in the [GitHub repo](https://github.com/qualtyco/api-doctor/tree/main/src/providers) under `src/providers/<name>/README.md`.

---

## What it catches

| Category        | What it means                                                         | Examples                                                                                      |
| --------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Security**    | Are your integrations secure? Mapped to CWE and OWASP audits. | Hardcoded API keys, secrets in the client bundle, webhooks read before signature verification |
| **Correctness** | Are you using the right endpoint or API for the job?                                    | Marketing email via batch send, missing unsubscribe links, test domain in production          |
| **Reliability** | Is your integration production ready or following suggested best practices?                | Missing idempotency keys, batch limits not enforced, error codes not mapped                   |
| **Compatabiltiy** | Is your SDK version updated to latest release?                | Upgrade your codebase with the latest SDK version with best practices for that version                   |

---

## Telemetry

api-doctor sends anonymous usage data to PostHog so we can see whether the tool is helping developers catch real bugs.

**What we collect:**

- CLI version, Node.js version, platform
- Run context: local, CI, or agent
- Which API SDKs were detected (e.g. `resend`, `supabase`) — provider names only
- Which rules fired — rule names only, no code
- Which documented SDK methods the scanned code calls (`sdk_used`, e.g. `emails.send`), plus a count of unrecognized calls on those clients (`unknown_sdk_calls`) 
- Which AI model (or agent) most likely wrote the scanned code (`ai_model`), plus which signal determined it (`ai_model_source`).
- For fix runs: which agent was chosen (`claude`, `cursor`, or `codex`)
- Score delta between runs on the same project (stored locally in that project's `.api-doctor/run-history.json`)
- A hashed project identifier (`project_hash`) — SHA-256 of the scanned directory path, not the path itself
- Sanitized error messages and stack traces on unexpected crashes (paths redacted)

**What we never collect:**

- Your code or file contents
- Raw file paths or project names
- Email, name, or any personally identifying information
- Git commit messages, human author names, or human author emails
- Agent session transcripts

A random anonymous ID is stored at `~/.api-doctor/install-id`. Per-project run history is stored at `<project>/.api-doctor/run-history.json`. Both stay on your machine — only the event data above is sent to PostHog.

**Opt out:**

```bash
npx @api-doctor/cli . --no-telemetry
```

---

## Troubleshooting

**Seeing an old version?** npx sometimes caches an older resolution.
Force a fresh pull with 

```bash
npx @api-doctor/cli@latest .
```

## Help

- **New provider?** [Open an issue](https://github.com/qualtyco/api-doctor/issues)

MIT © Qualty
