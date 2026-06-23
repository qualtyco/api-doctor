# <img src="assets/qualty-logo.svg" alt="api-doctor mascot" width="40" valign="middle" /> api-doctor

[![npm version](https://img.shields.io/npm/v/@api-doctor/cli)](https://www.npmjs.com/package/@api-doctor/cli)
[![npm downloads](https://img.shields.io/npm/dt/@api-doctor/cli?color=007ec6)](https://www.npmjs.com/package/@api-doctor/cli)

**AI compiles hallucinated code that pass. This fixes it before accepting it.**

Claude, Cursor, and Codex write code that compiles and looks finished. But it hallucinates integrations that got lost in documentation context.

Make your coding agents catch errors before review. Run this during runtime. CLI as a SKILL

## Install

```bash
npx @api-doctor/cli .
```

### VIDEO HERE
 
## Supported providers
 
| | Provider | Rules |
| --- | --- | --- |
| <img src="https://cdn.simpleicons.org/resend/000000" width="28" height="28" alt="" /> | **[Resend](https://resend.com/docs)** | [13 rules](src/providers/resend/README.md) |
| <img src="https://cdn.simpleicons.org/supabase/3FCF8E" width="28" height="28" alt="" /> | **[Supabase](https://supabase.com/docs)** | [12 rules](src/providers/supabase/README.md) |
| <img src="https://cdn.simpleicons.org/auth0/EB5424" width="28" height="28" alt="" /> | **[Auth0](https://auth0.com/docs)** | [4 rules](src/providers/auth0/README.md) |
| <img src="https://cdn.simpleicons.org/firebase/FFCA28" width="28" height="28" alt="" /> | **[Firebase](https://firebase.google.com/docs)** | [8 rules](src/providers/firebase/README.md) |
| | **[Lovable](https://docs.lovable.dev)** | [4 rules](src/providers/lovable/README.md) |
| | **[Browserbase](https://docs.browserbase.com)** | [11 rules](src/providers/browserbase/README.md) |
| | **[OpenAI Computer Use](https://developers.openai.com/api/docs/guides/tools-computer-use)** | [7 rules](src/providers/openai-cua/README.md) |
 
---
 
## What it catches
 
| Category | What it means | Examples |
| --- | --- | --- |
| **Security** | Things that will get you hacked. Mapped to CWE and OWASP aduits | Hardcoded API keys, secrets in the client bundle, webhooks read before signature verification |
| **Correctness** | You're calling the wrong endpoint for what you're doing. Providers have specific APIs for specific use cases your agent is not using | Wrong send method for marketing, missing unsubscribe links, test domain in production |
| **Reliability** | Will this hold up in production? Checks what the provider docs explicitly warn about. | Missing idempotency keys, batch size limits not enforced, error codes not mapped |
| **Integration** | Is this wired into your own system correctly? Things your agent doesn't know to add. | No tags, no request ID logging, bare `from` address instead of `"Name <email>"` |
 
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
 
## Contributing
 
Found a bug or want a new provider? Open an issue or start a discussion.
 
## License
 
[MIT](LICENSE.md) © Qualty Co