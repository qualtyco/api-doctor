# SDK surface coverage

Coverage answers one question for a provider: **which of this SDK's documented methods does the scanned codebase actually call?** The result is informational output for the developer and  more importantly telemetry for the provider (`sdk_used`, `unknown_sdk_calls` on the `provider_scanned` event), which
shows whether AI agents are discovering the provider's API beyond the one or
two obvious endpoints.

Coverage is **not a rule**. It never appears in `findings[]`, never affects the score, and never emits counts, ratios, or "X of Y" phrasing. A codebase that uses 2 of 101 methods is a perfect fit, not "2% coverage" most integrations only really need a tiny slice of an API/SDK.

## Terminology

**Surface** — the full set of documented, callable method paths an SDK
exposes, written as dotted paths from the client: `emails.send`,
`batch.send`, `domains.verify`. Each provider's surface lives in its manifest
(`src/providers/<name>/manifest.ts` → `surface.methods`) and is
**hand-written and verified against the SDK's published types and docs** —
never auto-derived from package exports. Where the provider publishes an
OpenAPI spec (e.g. `src/providers/resend/openapi_resend.yaml`) the list is
cross-checked against it too. `pnpm check:surface` diffs these lists against
the latest published SDK types so drift is caught, not guessed.
The surface is a *closed vocabulary*: only paths on this list can ever appear
in output or telemetry, which is what makes the telemetry privacy-safe by
construction (no user code, file paths, or arguments can leak through it).

**Coverage** — the subset of the surface this codebase calls, collected by
parsing the scanned files (`collect.ts`). A method counts only when it is
*called* (not merely referenced) *on a verified client* — a binding that
provably traces back to the SDK: constructed in the same file from an SDK
import, or imported from a project module that verifiably exports such a
client. A variable that merely *looks* like a client (named `resend`, right
call shape) is never trusted on its name alone. The report carries the
result as `report.coverage[]`: `{ provider, used }`.

**Unknown SDK calls** — calls on a *verified* client that we could not match
to a method in the surface manifest: the SDK grew a method we haven't listed
yet, or the code uses a low-level escape hatch like `resend.post(...)`.
Counted as a bare number in telemetry only (`unknown_sdk_calls`), stripped
from the report. This keeps undercounting measurable: without it, "unused"
and "undetectable" look identical in the data. Near-zero across scans means
`sdk_used` can be trusted at face value; a rising count means the surface
list has drifted behind the SDK.

## How it runs

```
scan()  (src/scanner.ts)
  ├─ oxlint plugin ──→ findings (rules, scored)          existing path
  └─ collectCoverage(detected, filesContent)             this directory
       │   own oxc-parser pass, in-process, CLI-only
       ├─→ report.coverage        names only, no counts (report-builder strips them)
       ├─→ terminal / markdown    "Resend surface" section (reporter/)
       └─→ telemetry              sdk_used, unknown_sdk_calls
```

Per provider, `collect.ts`:

1. **Gates.** Runs only when the manifest has a `surface` block and detection
  did not come from URL strings alone (`source !== 'url-patterns'`). When
   nothing qualifies it returns `undefined` — the report omits the section
   entirely rather than emitting an empty one.
2. **Verifies clients.** Finds `new Resend(...)` traced to an SDK import
  (handles renamed imports, aliases, `this.x = new Resend()`, namespace and
   CJS imports), and resolves wrapper imports (`import { resend } from  '@/lib/resend'`) to a scanned module that verifiably exports a client.
   Unresolvable or ambiguous imports are dropped, not guessed.
3. **Records calls.** Builds the dotted path of each call on a verified
  client; paths in the surface go into `used`, paths outside it increment
   `unknownSdkCalls`.

Known punts (documented in `collect.ts`): destructured resources
(`const { emails } = resend`), clients passed as parameters / DI,
wrappers outside the scanned tree, deep re-export chains, computed
non-literal access, `.call/.apply/.bind`.

## Hard rules

- Never in `findings[]`, never affects the score, no counts/ratios in output.
- Surface lists are hand-written; `pnpm check:surface` guards them.
- Client identity is verified, never assumed from a name.
- `src/plugin/index.ts` must never import from this directory —
`dist/plugin.js` stays lint-only.
- **Coverage must never fail a scan.** `walkAst` is iterative on purpose (a
generated file with thousands of concatenated literals nests deeply enough to
blow the call stack), and `parseFile` wraps both the parse and the walk — an
unanalysable file is dropped from coverage, never propagated. Do not rewrite
the walker recursively.
- An entry with nothing used still reaches telemetry ("scanned, found nothing"
is a real signal) but is dropped from the report, which renders no empty
sections.



## Adding coverage for a provider

1. `surface` block in the provider's manifest — verify every method path
  against the SDK's published types, then add the provider to
   `scripts/check-sdk-surface.mjs` and run `pnpm check:surface`.
2. Tests: collector cases in `tests/coverage/`, fixtures under
  `tests/fixtures/<name>/coverage-*`, and `pnpm check:links` for any docs
   URLs.

No per-provider detection code: the collector in `collect.ts` is shared, so a
new provider is a verified method list, not a new heuristics project.

