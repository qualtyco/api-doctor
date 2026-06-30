# api-doctor

[![node version](https://img.shields.io/npm/v/@api-doctor/cli)](https://www.npmjs.com/package/@api-doctor/cli)
[![npm downloads](https://img.shields.io/npm/dt/@api-doctor/cli?color=007ec6)](https://www.npmjs.com/package/@api-doctor/cli)

api-doctor scans AI-generated code for bad API integrations.

Deterministic AST rules. Not a prompt. Same input, same output, every time.

→ **[Full story and examples at apidoctor.co](https://apidoctor.co)**


[https://github.com/user-attachments/assets/53dab24f-528b-4f1b-87a9-8870002053d8](https://github.com/user-attachments/assets/53dab24f-528b-4f1b-87a9-8870002053d8)


## Quick Start

```bash
# Scan your project
npx @api-doctor/cli .

# Or install as an agent skill (Claude Code, Cursor, Windsurf)
npx @api-doctor/cli install
```


## 📦 Supported Providers

| Provider                                                                                | Rules                                                                                            |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [Resend](https://resend.com/docs)                                                       | [13 rules](https://github.com/qualtyco/api-doctor/blob/main/src/providers/resend/README.md)      |
| [Supabase](https://supabase.com/docs)                                                   | [12 rules](https://github.com/qualtyco/api-doctor/blob/main/src/providers/supabase/README.md)    |
| [Auth0](https://auth0.com/docs)                                                         | [4 rules](https://github.com/qualtyco/api-doctor/blob/main/src/providers/auth0/README.md)        |
| [Firebase](https://firebase.google.com/docs)                                            | [8 rules](https://github.com/qualtyco/api-doctor/blob/main/src/providers/firebase/README.md)     |
| [Lovable](https://docs.lovable.dev)                                                     | [4 rules](https://github.com/qualtyco/api-doctor/blob/main/src/providers/lovable/README.md)      |
| [Browserbase](https://docs.browserbase.com)                                             | [11 rules](https://github.com/qualtyco/api-doctor/blob/main/src/providers/browserbase/README.md) |
| [OpenAI Computer Use](https://developers.openai.com/api/docs/guides/tools-computer-use) | [7 rules](https://github.com/qualtyco/api-doctor/blob/main/src/providers/openai-cua/README.md)   |
| [TipTap](https://tiptap.dev/docs)                                                       | [11 rules](https://github.com/qualtyco/api-doctor/blob/main/src/providers/tiptap/README.md)      |

Full rule catalogs live in the [GitHub repo](https://github.com/qualtyco/api-doctor/tree/main/src/providers) under `src/providers/<name>/README.md`.

---

## What it catches

Rules cover four categories: security (CWE/OWASP mapped), correctness (wrong endpoints), reliability (production failure modes), and integration (wiring gaps).

| Category        | What it means                                                         | Examples                                                                                      |
| --------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Security**    | Issues that expose you to compromise. Mapped to CWE and OWASP audits. | Hardcoded API keys, secrets in the client bundle, webhooks read before signature verification |
| **Correctness** | Wrong endpoint or API for the job.                                    | Marketing email via batch send, missing unsubscribe links, test domain in production          |
| **Reliability** | Production failure modes the provider docs warn about.                | Missing idempotency keys, batch limits not enforced, error codes not mapped                   |
| **Integration** | Wiring gaps your agent won't add on its own.                          | No tags, no request ID logging, bare `from` address instead of `"Name <email>"`               |

---

## Why deterministic matters

You can't test AI code with AI. api-doctor breaks that loop. Same rules, same output, every time. Not a model call. Not a prompt.

---

## Telemetry

api-doctor sends anonymous usage data to PostHog so we can see whether the tool is helping developers catch real bugs.

**What we collect:**

- CLI version, Node.js version, platform
- Run context: local, CI, or agent
- Which API SDKs were detected (e.g. `resend`, `supabase`) — provider names only
- Which rules fired — rule names only, no code
- Score and finding counts
- Score delta between runs on the same project (stored locally in that project's `.api-doctor/run-history.json`)
- A hashed project identifier (`project_hash`) — SHA-256 of the scanned directory path, not the path itself
- Sanitized error messages and stack traces on unexpected crashes (paths redacted)

**What we never collect:**

- Your code or file contents
- Raw file paths or project names
- Email, name, or any personally identifying information

A random anonymous ID is stored at `~/.api-doctor/install-id`. Per-project run history is stored at `<project>/.api-doctor/run-history.json`. Both stay on your machine — only the event data above is sent to PostHog.

**Opt out:**

```bash
npx @api-doctor/cli . --no-telemetry
npx @api-doctor/cli install --no-telemetry
```

Or set `API_DOCTOR_TELEMETRY=0` or `DO_NOT_TRACK=1` in your environment.

---

## Help

- **New provider?** [Open an issue](https://github.com/qualtyco/api-doctor/issues)

MIT © Qualty
