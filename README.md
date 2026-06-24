#  api-doctor

[node version](https://www.npmjs.com/package/@api-doctor/cli)
[npm downloads](https://www.npmjs.com/package/@api-doctor/cli)

**AI compiles hallucinated code that pass. This fixes it before accepting it.**

Claude, Cursor, and Codex write code that compiles and looks finished. But it hallucinates integrations that got lost in documentation context.

Make your coding agents catch errors before review. Run this during runtime. CLI as a SKILL

## Install

```bash
npx @api-doctor/cli .
```

### VIDEO HERE

## Supported providers


| Provider                                                                                | Rules                                           |
| --------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [Resend](https://resend.com/docs)                                                       | [13 rules](src/providers/resend/README.md)      |
| [Supabase](https://supabase.com/docs)                                                   | [12 rules](src/providers/supabase/README.md)    |
| [Auth0](https://auth0.com/docs)                                                         | [4 rules](src/providers/auth0/README.md)        |
| [Firebase](https://firebase.google.com/docs)                                            | [8 rules](src/providers/firebase/README.md)     |
| [Lovable](https://docs.lovable.dev)                                                     | [4 rules](src/providers/lovable/README.md)      |
| [Browserbase](https://docs.browserbase.com)                                             | [11 rules](src/providers/browserbase/README.md) |
| [OpenAI Computer Use](https://developers.openai.com/api/docs/guides/tools-computer-use) | [7 rules](src/providers/openai-cua/README.md)   |


---

## What it catches


| Category        | What it means                                                                                                                        | Examples                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| **Security**    | Things that will get you hacked. Mapped to CWE and OWASP aduits                                                                      | Hardcoded API keys, secrets in the client bundle, webhooks read before signature verification |
| **Correctness** | You're calling the wrong endpoint for what you're doing. Providers have specific APIs for specific use cases your agent is not using | Wrong send method for marketing, missing unsubscribe links, test domain in production         |
| **Reliability** | Will this hold up in production? Checks what the provider docs explicitly warn about.                                                | Missing idempotency keys, batch size limits not enforced, error codes not mapped              |
| **Integration** | Is this wired into your own system correctly? Things your agent doesn't know to add.                                                 | No tags, no request ID logging, bare `from` address instead of `"Name <email>"`               |


Full rule list: `src/providers/<name>/README.md`

---

## Getting results to your agent

Run it. Get a report. Feed it back.

```bash
npx @api-doctor/cli .
```

prints score, writes `.api-doctor/report.json`

Install once into your agent to pick up the report and fixes findings on its own:

```bash
npx @api-doctor/cli install
```

Works with Claude Code, Cursor, Codex, OpenCode, and others. No tokens burned. No model calls. **100% Deterministic Reports**

---

## Not a confidence score

Asking a model how confident it is doesn't work. 

api-doctor runs 100% determinisitic rule checks across all providers.

---

## Telemetry

api-doctor sends anonymous usage data to PostHog to help us understand how the tool is being used and whether it's helping developers catch real bugs.

**What we collect:**

- CLI version, Node.js version, platform
- Run context: local, CI, or agent
- Which API SDKs were detected (e.g. `resend`, `supabase`) — no file paths
- Which rules fired and how many times — rule names only, no code
- Score and finding counts
- Score delta between runs on the same project (tracked locally by a hash of your detected providers)
- Stack traces on unexpected crashes

**What we never collect:**

- Your code or file contents
- File paths or project names
- Email, name, or any personally identifying information

A random anonymous ID is stored at `~/.api-doctor/install-id`. Per-project run history is stored at `~/.api-doctor/run-history.json`. Both files stay on your machine — only the event data above is sent to PostHog.

**Opt out:**

```bash
npx @api-doctor/cli . --no-telemetry
```

---

## Contributing

Found a bug or want a new provider? Open an issue or start a discussion.

## License

[MIT](LICENSE.md) © Qualty Co