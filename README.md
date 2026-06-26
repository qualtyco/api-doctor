# api-doctor

[![node version](https://img.shields.io/npm/v/@api-doctor/cli)](https://www.npmjs.com/package/@api-doctor/cli)
[![npm downloads](https://img.shields.io/npm/dt/@api-doctor/cli?color=007ec6)](https://www.npmjs.com/package/@api-doctor/cli)


**AI writes code that compiles and passes review but still hallucinates API integrations.** 

api-doctor catches those mistakes during code generation.

Claude, Cursor, and Codex generate integrations that look finished. api-doctor runs deterministic checks against provider docs so missing webhook verification, hardcoded keys, and silent mutation failures surface before merge.

## 💻 Run Locally

Scan your project manually to catch unvalidated third-party SDK usage.

```bash
npx @api-doctor/cli .
```

## 🤖 Install for your Agent (Recommended)

Give your agent api-doctor skill so it can validate its own integrations automatically.

```bash
npx @api-doctor/cli install
```

[https://github.com/user-attachments/assets/53dab24f-528b-4f1b-87a9-8870002053d8](https://github.com/user-attachments/assets/53dab24f-528b-4f1b-87a9-8870002053d8)


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


Full rule catalogs live in the [GitHub repo](https://github.com/qualtyco/api-doctor/tree/main/src/providers) under `src/providers/<name>/README.md`.

---

## What it catches


| Category        | What it means                                                         | Examples                                                                                      |
| --------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Security**    | Issues that expose you to compromise. Mapped to CWE and OWASP audits. | Hardcoded API keys, secrets in the client bundle, webhooks read before signature verification |
| **Correctness** | Wrong endpoint or API for the job.                                    | Marketing email via batch send, missing unsubscribe links, test domain in production          |
| **Reliability** | Production failure modes the provider docs warn about.                | Missing idempotency keys, batch limits not enforced, error codes not mapped                   |
| **Integration** | Wiring gaps your agent won't add on its own.                          | No tags, no request ID logging, bare `from` address instead of `"Name <email>"`               |


---

## Not a confidence score

Asking a model how confident it is doesn't work. api-doctor runs fixed AST rules against your code — same input, same output, every time.

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

## Contributing

Found a bug or want a new provider? [Open an issue](https://github.com/qualtyco/api-doctor/issues).

## License

[MIT](LICENSE.md) © Qualty Co