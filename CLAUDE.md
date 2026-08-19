# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git policy

**Never commit or push without being explicitly asked.** Finish the work, leave all changes uncommitted in the working tree, and summarize what changed so it can be reviewed first. Plan or task approval is not commit authorization. If a commit split would help, propose the split and messages and wait for the go-ahead.

## Commands

```bash
pnpm install        # install deps
pnpm build          # compile src/ → dist/ (tsup bundles cli.ts + plugin/index.ts)
pnpm dev            # watch mode
pnpm test           # full check: test:unit + check:links + check:surface — network-bound
pnpm test:unit      # vitest run only (builds once via globalSetup) — fast, offline, for the inner loop
pnpm check:links    # validate every docs URL in src/providers (404s, soft 404s, stale redirects)
pnpm check:surface  # diff surface.methods manifests against the latest SDK type declarations (drift guard)
```

**Run `pnpm test` before committing.** The two network-bound guards catch what the
unit suite structurally cannot, because both compare the repo against the outside
world: a provider moving a docs page (`check:links`), and an SDK growing or
renaming methods the surface manifest doesn't list (`check:surface`). Both have
already caught real problems. Nothing enforces this automatically — use
`pnpm test:unit` while iterating and the full `pnpm test` before you commit.

Run a single rule's tests (requires a prior build):

```bash
pnpm build && npx vitest run tests/rules/resend-missing-idempotency-key.test.ts
```

Smoke-test against a fixture directory:

```bash
node dist/cli.mjs tests/fixtures/resend/resend-api-key-hardcoded-broken
```

## Architecture

Two outputs from a single build (`tsup.config.ts`):

| Output | Entry | Description |
|--------|-------|-------------|
| `dist/cli.{mjs,cjs}` | `src/cli.ts` | CLI binary (`api-doctor` bin) |
| `dist/plugin.js` | `src/plugin/index.ts` | Oxlint JS plugin (consumed by the CLI and directly by users) |

### Python engine — present but dormant

Python rule sources live under `src/providers/*/rules/python/` with a stdlib runtime in
`src/engines/python/runtime/`, **but the shipped product is TypeScript-only.** Every call
site that could classify, walk, detect, or lint a `.py` file is commented out behind a
`PYTHON-DORMANT` marker:

```bash
grep -rn PYTHON-DORMANT src tests    # every switch, in one command
```

The master switch is the `.py` branch in `src/engines/classify.ts` — while it is off,
`.py` files are never walked, read, classified, or linted. `src/detector.ts` needs its
own switch because pyproject/requirements detection reads disk directly and does not go
through file classification. `src/scanner.ts` does not import the Python runner at all,
so `dist/` contains no code that can spawn a Python process, and `package.json` `files`
ships no `.py` at all.

Rules for keeping it dormant:

- **Never re-enable one site alone** — the switches are a set; flip them together.
- Python rule tests (`tests/rules/*-python-rules.test.ts`) drive the runtime directly via
  `lintPythonFixture` and bypass `scan()`, so they keep running and keep the rule pack
  under test. Only `tests/scanner-python.test.ts` (end-to-end through `scan()`) is skipped.
- Do not add `src/providers` or `src/engines/python/runtime` to `package.json` `files`:
  an explicit `files` entry force-includes everything beneath it, which `.gitignore`
  cannot override — that leaks local `__pycache__/*.pyc` and every provider `.ts` source
  into the published tarball.
- When Python does ship: a repo containing `.py` files but no `python3` on PATH must
  degrade to a JS-only report, never abort the whole scan (today `runPythonEngine`
  throws `ScanError` → exit 2, discarding valid JS findings).

### Source layout

```
src/
├── cli.ts              Entry point — one command: scan + skill + fix
├── scanner.ts          Walks files, classifies language, fans out to engines
├── detector.ts         package.json / pyproject / import / URL heuristics
├── types.ts            Shared contracts + computeScore (the only score formula)
├── scan-error.ts       ScanError — import from here, never via scanner.ts
├── fix.ts              Fix phase: prompt build, outcome diff, agent registry
├── select.ts           Arrow-key menu (TTY-only; returns undefined otherwise)
├── skill.ts            Writes .agents/skills/api-doctor/SKILL.md into the scanned project
├── clipboard.ts        pbcopy / clip / wl-copy / xclip / xsel
├── sdk-versions.ts     Installed vs surface.verified version per provider
├── run-history.ts      .api-doctor/run-history.json (score delta, compat symbols)
├── telemetry.ts        PostHog events; agent-detector.ts feeds it ai_model
├── engines/
│   ├── classify.ts     Per-file language (javascript | python)
│   ├── js/runner.ts    Oxlint engine
│   └── python/         Node runner + stdlib-ast runtime/
├── reporter/           Terminal, JSON, markdown, and file output
├── coverage/           SDK surface coverage (CLI-only; JS/TS; never scored)
│   └── collect.ts      oxc-parser pass over provider files → used method paths
├── plugin/             Everything here ships in dist/plugin.js (lint-only)
│   ├── index.ts        Oxlint plugin — imports providers/*/rules/js/
│   ├── gate.ts         Wraps every rule; anchors.ts + client-tracker.ts feed it
│   ├── anchors.ts      Aggregates providers/*/anchor.ts
│   ├── installed-version.ts  Resolves a project's installed SDK version
│   └── rule-registry.ts  Reads meta.docs from each JS rule
└── providers/
    ├── index.ts        Registers all provider manifests
    ├── _shared/ast.ts  Provider-agnostic ESTree helpers — use, never re-copy
    └── <name>/
        ├── manifest.ts   Detection + rules[] (+ optional surface)
        ├── anchor.ts     Gate evidence — REQUIRED, else every rule no-ops
        ├── utils.ts       Provider-SEMANTIC helpers only
        ├── compatibility.ts  Optional — hand-verified removals; declare on the manifest
        ├── rules/js/     Oxlint / ESTree rules
        ├── rules/python/ stdlib-ast rules (same rule keys)
        └── README.md
```

### Data flow

```
cli.ts
  └─ scan()                    scanner.ts
       ├─ classify each file   engines/classify.ts
       ├─ detectProviders()    detector.ts + manifests
       ├─ collectCoverage()    coverage/ (JS files only)
       ├─ runJsEngine()        oxlint + providers/*/rules/js
       ├─ runPythonEngine()    python -m runtime + providers/*/rules/python
       └─ ScanResult[] (merged)
  └─ buildReport()             reporter/report-builder.ts
  └─ emitReport()
```

Detection reads **manifests only**. Engines produce diagnostics; reporting merges them with manifest metadata and rule docs from `plugin/rule-registry.ts`.

### The JS engine (`src/engines/js/runner.ts`)

**oxlint is pinned exact.** It is the engine, and its file-walking and ignore
semantics are load-bearing — the same reasoning that pins `oxc-parser`. A range
here is not a convenience, it is an untested dependency: the lockfile pinned
1.68.0 for the suite while `^1.68.0` resolved to 1.79.0 on a fresh install, so
every test ran against a version no user had. That gap hid a real bug for as
long as it existed. Bump it deliberately and re-run `pnpm test:unit`.

**The engine lints the file list, never a directory.** `scanner.ts`'s walk is
the single answer to "what gets scanned" — it skips dot directories, applies
`SKIP_DIR_NAMES`, classifies language, and its count is what the report prints.
Handing oxlint `.` gave that question a second answer, and the two disagreed:
oxlint 1.79 does not honour `ignorePatterns` when a JS plugin is registered, so
every dependency's shipped `.js` was linted and reported. A scan claimed
`filesScanned: 2` and returned 22 findings across 5 files, 15 of them inside
`node_modules`, which also wrecked the score with issues in code the developer
does not own.

Two guarantees, deliberately independent of any oxlint version:

- `batchFileArgs` passes `input.files` explicitly, chunked under the argv limit
  (ARG_MAX covers the environment block too, so the budget is conservative; a
  single over-budget path still gets its own batch rather than being dropped).
- `mapDiagnosticToResult` drops any diagnostic naming a file outside the walked
  set. A finding in code the developer does not own is worse than no finding.

`ignorePatterns` stays in the generated config as a second line of defence, not
as the mechanism. `tests/scanner-skip-dependency-dirs.test.ts` builds the tree
at runtime — a committed fixture containing `node_modules/` would be swallowed
by `.gitignore` — and its dependency copies are plain JS on purpose: a type
annotation in a `.js` file does not parse, and an unparseable file yields no
diagnostics, which would make the suite pass no matter what the engine did.

### SDK surface coverage (`src/coverage/`)

Coverage records which SDK method paths a codebase actually calls (`report.coverage`, plus `sdk_used`/`unknown_sdk_calls` on the `provider_scanned` telemetry event). Rules that must never be broken:

- Coverage is **not a rule**: never in `findings[]`, never affects the score, and no output may contain counts, ratios, or "X of Y" — using a small part of an API is a fit, not a gap.
- Surface method lists in `manifest.ts` → `surface.methods` are **hand-written and verified against the SDK's published types/docs** — never auto-derived from package exports. `pnpm check:surface` guards them against SDK drift.
- Client identity is **verified, never assumed from names**: a binding counts only when it traces to the SDK (same-file construction, or an import resolved to a project module that verifiably exports a client/constructor). Unverifiable wrapper imports are dropped.
- Coverage is skipped entirely (section omitted, not empty) when a provider was detected from a URL string alone.
- Undercounting stays measurable: calls on a verified client outside the surface manifest are counted (never named) as `unknown_sdk_calls` in telemetry. The report itself carries no counts.
- Coverage runs in the CLI via its own `oxc-parser` pass — **`src/plugin/index.ts` must never import from `src/coverage/`** (dist/plugin.js stays lint-only). `oxc-parser` is pinned exact (0.x native dep) — bump it deliberately and re-run the coverage tests.
- **Coverage must never fail a scan**: `walkAst` is iterative (deep ASTs blow the call stack) and `parseFile` wraps parse *and* walk, dropping unanalysable files rather than propagating. An informational feature must not be able to take down the tool.
- Coverage is **JS/TS only** — never feed `.py` files into `collectCoverage`.
- Notables (hand-written unused-capability pointers) were deliberately dropped from v1: too heuristic-heavy to scale across providers. If they return, they must be justified by telemetry data, fire only on positive code evidence, and scope suppression signals to the provider.

### Shared AST helpers (`src/providers/_shared/ast.ts`)

Generic ESTree primitives live in one module. Import them; never paste a copy
into a provider's `utils.ts`.

| Helper | Contract |
|---|---|
| `startOffset` / `endOffset` / `contains` | Node spans; falls back to line×1e6+col when byte offsets are absent |
| `isInsideTestFile` | Test files hold deliberate anti-patterns — rules skip them |
| `findProperty` | ObjectExpression property by name; a computed Identifier key does **not** match |
| `memberPropName` | Takes a **MemberExpression** — the `y` in `x.y` |
| `callPropName` | Takes a **CallExpression** — the `y` in `x.y()` |
| `someDescendant` | Boolean subtree search |

`memberPropName` and `callPropName` were once one name with two contracts in
different providers. Keep them apart.

What stays in a provider's `utils.ts`: anything naming an SDK
(`isResendSendCall`), and the recursive searches whose contracts genuinely
differ — twilio's `findInSubtree` (returns node, depth cap 40), tiptap's `walk`
(early-exit visitor), agentmail's `mentionedNames`. Merging those changes
behaviour; it does not remove duplication.

### SDK version tracking

`surface.verified` in a manifest records `{version, commit, at, sourceDir}` — the
SDK revision a human last read. The manifest is the source of truth, not npm.

```bash
pnpm check:surface                                   # method drift vs npm @latest
node scripts/check-sdk-surface.mjs --local s2=<path>  # + git-diff the SDK source
pnpm sdk:watch                                        # weekly pass over every clone
```

`--local` points at a package directory inside an SDK git clone, auto-pulls it
(never when dirty), and lists every source commit since `verified.commit`.
A method-name diff only catches added/removed symbols; most breaking changes are
logic changes behind an unchanged signature. Reading those commits is a human
job — never infer a rule or a `compatibility.ts` entry from a changelog.

Version drift is reported, never fatal. Only method drift exits 1.

**What `check:surface` can and cannot see.** It compares the manifest's method
list against the SDK's published `.d.ts`, so it catches additions (`missing from
manifest`) *and* removals (`stale in manifest`) — both exit 1. It cannot see a
rename as a rename (one missing + one stale, unlinked), a signature or default
change, or any behaviour change behind an unchanged signature. It also compares
against `@latest` only — it has no notion of the version a user has installed.
That question belongs to `plugin/installed-version.ts` + `sdk-versions.ts` at
scan time, and to `compatibility.ts` for hand-verified removals.

`scripts/sdk-watch.mjs` (`pnpm sdk:watch`, `.claude/skills/sdk-watch`) is the
weekly version of the `--local` pass across every cloned SDK at once: pull,
list commits since the baseline scoped to that provider's client source, rank
them, write `docs/sdk-watch/<date>.md`. Clone root: `--clones` →
`$API_DOCTOR_SDK_DIR` → `../official_sdks`. It keeps **two** baselines apart on
purpose — `surface.verified.commit` is the revision a human read and only a
human moves it; `.api-doctor/sdk-watch.json` is the HEAD last reported, moved
every run so a weekly report does not re-list the same commits. Collapsing them
would let an unread watch run masquerade as a verification. The script writes
a report and nothing else: it never edits a manifest, never adds a
`compatibility.ts` entry, never proposes a rule.

A scan shows the installed version per provider next to that baseline
(`src/sdk-versions.ts`). It states both numbers and stops — api-doctor never
recommends an upgrade.

### Compatibility (the 4th category)

Code versus the SDK version the project has **installed**. A compatibility
finding is a call that will fail at runtime against what is actually in
`node_modules` — never a suggestion to upgrade. Code on a deliberately pinned
old version using that version's symbols is correct and stays silent forever.

A provider gains compatibility with **data plus prose, never new AST code**:

```
providers/<name>/compatibility.ts   removals + `export const <name>Compatibility`
providers/<name>/manifest.ts        `compatibility: <name>Compatibility` + a rules[] entry
providers/<name>/rules/js/removed-symbol.ts
                                    createRemovedSymbolRule({ packageName, removals, … })
plugin/index.ts                     register the rule
```

`providers/_shared/removed-symbol.ts` holds the detection for every provider:
named imports and require-destructuring from the provider's package, calls of
those bindings, and member calls on a namespace import. A bare call is flagged
only when the binding traces to the SDK import, so a project's own helper
sharing the name never matches. It stays silent whenever the installed version
cannot be resolved — unresolvable must never be read as "latest". Fork this
file and those precision guarantees start drifting apart per provider.

Declaring `compatibility` on the manifest is the **whole** registration.
`providers/index.ts` derives `allRemovals`, `removalsBySymbol`,
`compatProviders`, and the message→symbol lookup from the manifests, so
telemetry and the reporter's Verify line pick a new provider up with no edit.
There is deliberately no central registry file — that was `compat-registry.ts`,
and it was one more list to forget.

Findings render their facts into a message string, so the structured removal is
recovered from the message by `symbolFromMessage`. That is safe only because it
matches a **closed vocabulary**: an unrecognised leading token yields null
rather than a guess.

`wireIdentical`, `evidence` and `verifyHint` are hand-verified against both
published tarballs — implementation, not the type diff. Never infer one from a
changelog, a rename, or `pnpm sdk:watch` output.

### The agent skill (`src/skill.ts`)

**There is no `install` command.** A setup step the user has to discover is a
setup step most users never run, so the scan writes the skill itself. `install`
existed, wrote four files, and was deleted along with its `install_command_run`
telemetry event — do not re-add either.

**Two locations, one file.** `.agents/skills/api-doctor/SKILL.md` is canonical
— the cross-tool [Agent Skills](https://agentpatterns.ai/standards/agent-skills-standard/)
location, read by Codex as its primary skills dir, by Cursor and Gemini CLI
alongside their own, and by Copilot via the same standard. The bundled source
is `skills/api-doctor/SKILL.md` in this package (shipped via `files`), copied
verbatim; its YAML frontmatter (`name`, `description`) is what makes it
discoverable at all, so never strip it.

`.claude/skills/api-doctor/SKILL.md` is a **symlink** at that copy, because
Claude Code discovers skills only from `~/.claude/skills/`, the project
`.claude/skills/`, plugins, and enterprise dirs — it reads neither `.agents/`
nor `AGENTS.md`, so without the link `/api-doctor` never appears there. Where
symlinks are not permitted (Windows without developer mode) a pointer file with
its own frontmatter takes its place: both routes end at one editable file.

The two paths are checked **independently**, so a project installed before the
link existed gains it on the next scan without the canonical copy being
touched. Only link at a file that exists — a dangling symlink in someone's
`.claude/` is worse than no skill.

Three rules hold the write down to something a scan is allowed to do:

- **Only when a provider was detected.** Pointing the CLI at an unrelated
  directory leaves no trace.
- **Never overwrite.** Once the file is in the project it belongs to the
  project; a scan silently reverting someone's edits is worse than a skill one
  version behind. `created` is true only on the run that wrote it, which is why
  the footer notice prints exactly once.
- **Never throws.** Every failure is swallowed — an unwritable directory must
  not turn a working scan into a crash. `--no-skill` opts out entirely, and CLI
  tests that scan committed fixtures pass it so the repo stays clean.

### The fix phase (`src/fix.ts`, `runFixPhase` in `cli.ts`)

**There is no `fix` subcommand.** Scanning and fixing are the default command,
so `npx @api-doctor/cli .` is the whole product surface. After the report
prints, a run with **error-severity findings in any category** shows an
arrow-key menu (`src/select.ts`) of Claude Code / Cursor / Codex / Skip. The
scan prints *before* the handoff because the agent session takes over the
terminal; on exit that is what the user scrolls back to.

Two rules define the handoff:

- **Paste, not submit.** The prompt goes to the clipboard (`src/clipboard.ts`)
  and the agent opens with an empty input and no prompt argument (`stdio:
  'inherit'`, no bypass flags — a launcher, not an autonomous agent). Never
  change this to pass the prompt as argv; a window that starts working by
  itself is exactly what the design refuses. There is no way to pre-fill an
  agent's input without submitting: no CLI offers a flag for it, and typing a
  **multi-line** prompt into a TUI submits it at the first newline.
- **The handoff is gated on a keypress** (`waitForAcknowledgement` in
  `select.ts`). The agent's TUI clears the screen the instant it starts, so
  everything `describeHandoff` prints was previously written and never read —
  users reached the session not knowing the prompt was on their clipboard. The
  gate is the only way to know a message about to be wiped was seen. It
  no-ops when `canPrompt()` is false, and resolves on stdin `end`/`close` too:
  hanging before the agent opens is the one failure here with no way out.
- **`readsSkill` on a `FixAgent` is set from where that agent actually reads
  skills, never assumed.** It gates the "or just type `/api-doctor`" line —
  Claude Code and Cursor find the installed skill, Codex discovers skills by
  description rather than a slash command, so naming one there would be an
  instruction that does not work.
- **The prompt is an index, not a dossier.** With a report file on disk it lists
  one line per error (`file:line — message`) and tells the agent to read
  `.api-doctor/report.json` for guidance, docs links, and snippets — structured
  data beats paragraphs, and the human pasting it still sees the whole list.
  `--no-report` falls back to inlining every detail, because then the prompt is
  the only copy.
- **Verification lives in the prompt.** The CLI does **not** re-scan after the
  session — it prints `describeSessionEnd()` and exits with the status of the
  scan it actually ran. The prompt tells the agent to run `VERIFY_COMMAND`
  (`npx @api-doctor/cli@latest .`, pinned to the published CLI so it works in
  any project) and keep going until the errors are gone and nothing new
  appeared. The loop is still AST → agent → AST; the agent drives it, inside
  the session where it can act on the result. Do not re-add an outcome diff
  here: it graded work the agent had already graded, one terminal away from
  being able to do anything about it.

`resolveFixMode` is the single decision point: `--no-fix` always wins (CI needs
one flag that cannot block), `--fix [agent]` runs unattended, `--fix-dry-run`
prints the prompt, and everything else only offers where both stdin and stdout
are TTYs. `--fix` with `--format` is a hard error, not a silent skip.

Adding an agent means one entry in `FIX_AGENTS` — id, label, PATH command,
install URL. Anything needing a prompt argument to open does not belong there.

The prompt tells the agent **not to commit, stage, or push**, and to end with a
one-line-per-file summary of what changed and why. That summary is what the
developer reads before reviewing the diff, since there is no commit message.

Two invariants:

- The prompt carries the finding's **intent** (message, fix guidance, docsUrl) and
  never what the rule matches on. Handing over the matcher teaches the agent to
  satisfy the matcher instead of the requirement. `tests/fix.test.ts` asserts the
  prompt contains no `AST`/`oxlint`/visitor vocabulary — keep it that way when
  editing the wording.
- Pass/fail is behavioural — the rule stops firing and nothing new appears —
  never "the code looks like this snippet".

If a legitimate fix cannot pass, the rule is too narrow. Fix the rule.

### Three names that must stay in sync

```
manifest rules[].key        →  resend-missing-idempotency-key
plugin/index.ts object key  →  resend-missing-idempotency-key
oxlint rule id              →  api-doctor/resend-missing-idempotency-key
Python RULE_KEY             →  resend-missing-idempotency-key
```

### Test layout

```
tests/
├── fixtures/<provider>/<rule-key>-broken/   should flag (2+ files each)
├── fixtures/<provider>/<rule-key>-fixed/    should not flag
├── fixtures/<provider>/docs-examples/       verbatim official doc samples
├── rules/<rule-key>.test.ts                 one vitest file per rule
├── scanner.test.ts / scanner-python.test.ts end-to-end scan()
├── helpers/lint-rule.ts                     oxlint harness
└── helpers/lint-python-rule.ts              Python runtime harness
```

Fixture files may be named `*.test.ts` to exercise test-file detection; vitest excludes `tests/fixtures/**`.

### Test suite policy

The test suite is the contract for rule behavior — **never edit existing tests or fixtures to make a failing run pass**. If a test fails, the bug is in the rule or source code; fix it there. Adding new tests and fixtures for new rules is expected (see the checklists below). The only legitimate reason to change an existing test is that the intended behavior itself changed — in that case, call the change out explicitly in the PR description and explain why the old expectation was wrong; never adjust expectations silently.

## Adding a rule (checklist)

1. `src/providers/<name>/rules/js/<check>.ts` — AST visitors, **named export only** (the plugin imports named; a default export is dead weight)
2. Register in `src/plugin/index.ts` — import `../providers/<name>/rules/js/<check>.js`
3. Add entry to `src/providers/<name>/manifest.ts` → `rules[]` (set `languages` when Python applies)
4. Optional Python port: `src/providers/<name>/rules/python/<check>.py` with `RULE_KEY` + `check(tree, path, source)`
5. Rule registry coverage via plugin import (automatic)
6. `tests/fixtures/<name>/<rule-key>-broken/` and `-fixed/` (JS and/or `.py`)
7. `tests/rules/<rule-key>.test.ts`
8. `pnpm build && pnpm test:unit`

`scanner.ts` reads manifests automatically — do not edit it when adding rules.

## Adding a new provider (checklist)

1. `src/providers/<name>/manifest.ts` — detection signals + `rules[]`
2. **`src/providers/<name>/anchor.ts`** — derive `packages`/`urlSubstrings` from the manifest, never restate them
3. `src/providers/<name>/rules/js/*.ts` — one file per JS/TS check
4. `src/providers/<name>/utils.ts` — provider-semantic helpers only (generic ones live in `_shared/ast.ts`)
5. `src/providers/<name>/README.md` — rule catalog by category
6. Register manifest in `src/providers/index.ts`
7. **Register anchor in `src/plugin/anchors.ts`** — skip this and the gate silently drops every rule
8. Register JS rules in `src/plugin/index.ts`
9. Fixtures and tests under `tests/`
10. `tests/fixtures/<name>/docs-examples/` — verbatim official doc samples
11. `pnpm build && pnpm test` and `pnpm check:links`

Steps 1, 6, 7, 8 are four separate registries. Nothing checks them against each
other — a provider missing from any one fails quietly, not loudly.

## Rule implementation notes

- Use AST visitors, never regex over raw source text as the primary detector.
- JS: ESTree visitors (`CallExpression`, `ImportDeclaration`, `Program:exit`); track file-level state in `create()` closures.
- Python: `ast.parse` + `check(tree, path, source) -> list[Diagnostic]`; export `RULE_KEY`.
- Generic AST helpers come from `_shared/ast.ts`. Provider-semantic ones go in that provider's `utils.ts` / `utils.py`.
- Reference: `src/providers/resend/rules/js/webhook-signature.ts` and `rules/python/api_key_hardcoded.py`
- Rules are gated: a finding only fires when `anchor.ts` evidence ties the file to the provider. A rule that never fires end-to-end is usually a missing anchor, not a broken visitor.

## Known gaps

Facts a change here would otherwise have to rediscover:

- **Nothing tests the four registries** (manifest / plugin / anchors / providers index). They are 137/137 aligned by hand today.
- **`buildParsedFiles` runs twice per surface-provider** (`coverage/collect.ts` — `collectCoverage` and `collectClientBindings` each call it with the same input). Memoizing halves in-process AST work.
- **Rule counts in READMEs are hand-maintained** and drift (root README's Resend count is one behind).
- **`providers.find(p => p.name === …)`** is repeated at ~10 sites; no `providerByName` map exists.
- **package.json is parsed by three separate implementations** (`detector.ts`, `plugin/installed-version.ts`, `cli.ts`) with different field sets.
