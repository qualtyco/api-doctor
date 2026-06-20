# api-doctor
[![npm version](https://img.shields.io/npm/v/@api-doctor/cli)](https://www.npmjs.com/package/@api-doctor/cli)

**AI compiles hallucinated code that pass. This fixes it before accepting it.**

Claude, Cursor, and Codex write code that compiles and looks finished, then hallucinate the parts that do not show up in a sanity check.

## Quick Start

```bash
npx @api-doctor/cli .
```

### VIDEO HERE

## Why this exists

One wrong assumption poisons every later turn. Coding agents agree instead of pushing back. Slop code ships because the agent writing it is the same agent reviewing it.

## CLI as a SKILL

api-doctor checks code the moment your agentic coding session writes it. 

Not docs, that is Mintlify and Fern. Not after production, that is Datadog and your ticket queue. Think of it as a cli skill

## No confidence scores

Asking a model how confident it is does not work, it reports high confidence either way. api-doctor does not ask. It checks deterministically and burns zero tokens.

## What it catches


| Category        | Examples                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------- |
| **Security**    | Hardcoded API keys, secrets in the client bundle, webhooks read before signature verification |
| **Correctness** | Wrong API for the job, missing compliance requirements like unsubscribe links                 |
| **Reliability** | Missing idempotency keys, unenforced batch limits, unmapped error codes                       |
| **Integration** | Malformed `from` addresses, missing tags, dropped request IDs                                 |


Full list in `src/providers/<name>/README.md`.

## How it works

1. **Detect**: scans `package.json`, imports, and URLs for the SDKs in use.
2. **Enable**: turns on the rule set for each SDK found.
3. **Check**: walks the code your agent just wrote.
4. **Report**: prints a score and writes `.api-doctor/report.json`.

## Usage

```bash
npx @api-doctor/cli .
```

Prints a score in the terminal and writes `.api-doctor/report.json`.

## Install for agents

Once you have a report, install the skill so your agent reads it and fixes findings on its own.

```bash
npx @api-doctor/cli install
```

Works with Claude Code, Cursor, Codex, OpenCode, and others

## Supported providers


| Provider                              | Status                                     |
| ------------------------------------- | ------------------------------------------ |
| [Resend](https://resend.com/docs)     | [13 rules](src/providers/resend/README.md) |
| [Railway](https://docs.railway.com)   | [6 rules](src/providers/railway/README.md) |
| [Supabase](https://supabase.com/docs) | [6 rules](src/providers/supabase)          |


## Contributing

Found a bug or want a new provider? Open an issue or start a discussion on GitHub.

## License

[MIT](LICENSE.md) © Qualty Co