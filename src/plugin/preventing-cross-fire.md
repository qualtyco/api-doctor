# Preventing cross-fire: how rules stay scoped to their own provider

**Cross-fire** is a rule from provider A reporting a finding on code that belongs
to provider B (or to no provider at all): a Twilio webhook rule flagging a Stripe
webhook route, a Browserbase session rule flagging
`stripe.checkout.sessions.create(...)`, a Resend rule flagging a Postmark
facade's `.emails.send(...)`. This document explains the two layers that prevent
it, with a worked example of how a call is traced to its owning client.

## Why it happened

Two design gaps compounded:

1. **Rule enablement was repo-wide.** Detecting a provider anywhere in the repo
   (even only in `package.json`) armed all of its rules against every file.
2. **Rules matched shapes, not owners.** Rules keyed on member shapes
   (`x.emails.send`, `x.sessions.create`, any POST route reading `req.body`)
   without verifying that `x` was actually their provider's client.

## The three layers

Layers 1 and 2 live inside the oxlint plugin (`dist/plugin.js`), so they apply
identically to CLI scans and standalone plugin users. Layer 3 runs in the CLI
process — where module resolution is available — and hands its result to the
plugin as extra evidence. No rule is rewritten for any of them — every rule is
wrapped centrally at registration (`gateAll` in `src/plugin/index.ts`).

### Layer 1 — the file gate (`src/plugin/gate.ts`)

For each rule × file, the gate:

1. Hands the rule a wrapped `context` whose `report()` writes to a buffer
   instead of oxlint. The rule runs unmodified; nothing escapes yet.
2. Feeds a **client tracker** (below) with every import, `require`, variable
   declaration, construction, assignment, class field, and string literal in
   the file, via merged visitors.
3. At `Program:exit`, flushes the buffered reports **only if the file shows
   evidence of that rule's provider**. Otherwise they are discarded.

A file that never references Twilio cannot produce a Twilio finding, period.

What counts as evidence is defined per provider in
`src/providers/<name>/anchor.ts` — the union of:

| Axis | Example (resend) |
|---|---|
| SDK package import/require (prefix match) | `import { Resend } from 'resend'` |
| Client construction / factory call | `new Resend(key)` |
| Provider-named wrapper binding | `import { resend } from '@/lib/resend'` |
| Provider URL substring in any literal | `api.resend.com` |
| Provider token pattern in any literal | `RESEND_API_KEY`, `svix-signature`, `email.bounced` |
| Provider identifier pattern (opt-in) | twilio: `streamSid` as a property key or member access |

The token/URL axes are why webhook-handler files that never import the SDK
still get checked — evidence is a union, and the fix for a legitimate finding
being suppressed is always **widening that provider's anchor**, never opting a
rule out of the gate. `identifierPattern` is the narrowest axis: it exists for
protocol-level integrations (a Twilio Media Streams handler speaking the wire
format over a raw WebSocket) whose only tell is the provider's field names in
identifier position — keep entries whole-name anchored, never substrings.

`anchor.ts` derives `packages` and `urlSubstrings` from the provider's own
manifest (single source of truth); constructor names, name patterns, and token
patterns are hand-written SDK knowledge. Each provider owns its anchor in its
own folder; `src/plugin/anchors.ts` only aggregates them, mirroring
`src/providers/index.ts`.

### Layer 2 — per-call ownership (`src/plugin/client-tracker.ts`)

The gate alone cannot fix a file that imports several providers — it passes
every gate. So before flushing, the gate runs every buffered diagnostic
through a post-filter:

```ts
if (node && tracker.deniedFor(node, anchor.provider)) continue;
```

`deniedFor` is deliberately asymmetric — **it suppresses only on positive
contrary evidence**. It unwinds the reported node to the receiver the call was
made on and drops the finding only when that receiver is verifiably another
provider's client (or on the CLI's traced non-client list). "Cannot tell" —
the normal case in real code — always reports. Three refinements keep the
denial honest:

- **No receiver, no denial.** A bare call (`setCookie(token)`, `fetch(url)`)
  carries no receiver claim to refute: the rule flagged its arguments or data
  flow, and foreign attribution of the callee proves nothing about the
  finding.
- **The enclosing-call fallback never crosses a function boundary.** A report
  with no receiver of its own (a CatchClause, an options literal) falls back
  to the call that contains it — but a call that wraps the *function*
  containing the node (`internalAction({ handler: … })`, `router.post(…)`) is
  scaffolding, not the flagged expression, and must not claim it.
- **Rules reporting via `loc` only** (no `node`) skip the per-call check and
  degrade to the file gate — the safe direction.

Rules that want ownership checks at match time can still ask the same tracker
directly via `context.providerTracker` (`tracker.belongsTo(callNode,
'resend')`), but no rule is required to: the post-filter covers all of them.

### Layer 3 — cross-file client resolution (CLI only)

A per-file tracker goes dark on the dominant production layout:

```ts
// lib/db.ts
export const db = createClient(url, key)

// routes/user.ts — the word "supabase" appears nowhere here
import { db } from '../lib/db'
await db.from('users').insert(...)    // real bug, must still be reported
```

`collectClientBindings()` (`src/coverage/collect.ts`) runs in the CLI process,
follows clients from where they are constructed through exports, imports,
re-exports, factory functions and destructuring, and emits per provider and
per file a `yes` list (bindings verified as clients) and a `no` list (bindings
positively traced to a non-provider origin — another vendor's package, a
project module exporting no client). The JS engine writes the map to a temp
file and points the oxlint subprocess at it via `API_DOCTOR_CLIENT_MODULES`;
`src/plugin/client-modules.ts` loads it once and seeds the tracker before any
visitor runs.

The contract is **additive**: `yes` entries add verified-tier bindings and
file evidence; the sole denial channel is the narrow `no` list, consumed only
by `deniedFor` under the receiver-claim rules above. A missing, unreadable or
partial map degrades exactly to the tracker's own single-file behaviour — it
can never silence a rule on its own. Standalone plugin users (no CLI, no map)
simply run layers 1–2.

## How a client is detected and traced

The tracker is a single-pass static binding analysis over the file being
linted. It tracks **all providers at once**. Consider a file with three
clients:

```ts
import twilio from 'twilio';                          // (1)
import { Resend } from 'resend';                      // (1)
import { createClient } from '@supabase/supabase-js'; // (1)

const tw = twilio(SID, TOKEN);                        // (2)
const mailer = new Resend(KEY);                       // (2)
const supabase = createClient(URL, KEY);              // (2)
const client = tw;                                    // (3)

class Notifier {
  api = new Resend(KEY);                              // (4)
  async run() {
    await this.api.emails.send({ ... });              // → resend
    await client.calls.create({ ... });               // → twilio
    await supabase.from('t').select().single();       // → supabase
  }
}
```

**(1) Imports seed constructor names.** Each import source is checked against
every anchor's `packages` (prefix-matching, so `firebase/auth` matches
`firebase`). `Resend` from `'resend'` becomes a known Resend constructor *in
this file*; renames are followed (`import { Resend as R }` → `R`). Twilio's
default export is itself a factory (`defaultIsFactory` in its anchor), so the
default-import local is registered too. `createClient` counts only because it
came from `@supabase/*` — the same name imported from anywhere else registers
nothing.

**(2) Constructions bind variables.** A declarator (or assignment) whose init
is `new <known-ctor>(...)` or `<known-factory>(...)` puts the variable in that
provider's verified set: `tw` → twilio, `mailer` → resend, `supabase` →
supabase.

**(3) Aliases propagate.** `const client = tw` copies ownership. This runs
incrementally during the walk and again as a fixed-point at `Program:exit`, so
chains resolve regardless of declaration order.

**(4) Class fields and `this` assignments.** `api = new Resend(KEY)` (or
`this.api = new Resend(KEY)` in a constructor) registers `api` so
`this.api.emails.send()` resolves later.

**Resolving a call** unwinds the callee to its **root**:
`client.calls.create(...)` → strip `.create`, `.calls` → root `client`.
Fluent chains unwind through call links: `supabase.from('t').select().single()`
→ root `supabase`. `this.api.emails.send()` roots at `this` + first segment
`api`. Inline constructions (`new Resend(k).emails.send()`) stop at the
construction itself. The root is then looked up in every provider's sets.

## The ownership tiers

`belongsTo(call, P)` answers through three tiers, strictest first:

1. **Verified** — the root traces to P's constructor/factory/alias/class
   field. Passes for P; **fails for every other provider** (negative
   anchoring). This is why Twilio's rule skips `bb.sessions.create()` and
   Browserbase's rules skip `stripe.checkout.sessions.create()` when those
   clients are constructed in the same file.
2. **Named** — the root (or its wrapper-import source) matches P's
   `clientNamePattern` / `wrapperSourcePattern`, e.g.
   `import { resend } from './lib/resend'`. Wrapper-heavy codebases keep
   their findings; a single-file tracker cannot see into the wrapper module,
   so the name is accepted as evidence (same policy the s2/agentmail trackers
   shipped with).
3. **File-evidence fallback** — the root is untraceable (function parameter,
   DI, destructured resource). Passes only if the file has direct evidence of
   P **and** no other provider verifiably or nominally owns the root. This
   keeps single-provider files behaving exactly as before the gate existed.

The failure mode is deliberately asymmetric: when the tracker cannot decide,
it degrades toward the file-evidence fallback — never toward claiming another
provider's verified client. Ambiguity produces a conservative maybe, not a
cross-fire.

## Known limits

- **Untracked SDKs** (Prisma, Stripe, knex, …) have no anchor, so their calls
  are "unknown" roots — tier 3 can still claim them when the file carries the
  asking provider's evidence and the shape matches. Planned tightening: when a
  provider has a `surface.methods` manifest, restrict tier 3 to call paths in
  that surface (a method list must *restrict* ownership, never *prove* it —
  method names collide across SDKs).
- **Plain data objects** can't be attributed: `user.user_metadata.role` has no
  traceable client, so e.g. supabase/auth0 overlap on `user_metadata` inside a
  genuinely mixed file is contained by the gate but not per-call attribution.
- **A name alone opens the gate.** A binding literally named `supabase`
  (`const supabase = makeOrm(...)`) reaches the named tier with no
  construction evidence — the price of keeping framework DI patterns
  (SvelteKit's `const { supabase } = locals`) reportable. The CLI's `no` list
  closes this when the origin is traceable; a look-alike in a file the CLI
  never parses can still cross-fire.
- **Provider affinity does not flow through project classes.** A file whose
  only link to Twilio is importing a project class that wraps the protocol
  (`import StreamSocket from './StreamSocket'`) carries no evidence of its
  own: the binding pass follows *clients*, not arbitrary provider-adjacent
  types. Such files stay silent (see `AudioInterceptor.ts` in the twilio
  sample corpus — one real pacing finding is knowingly lost there).
- **Star re-exports, dynamic `import()`, `globalThis` stashes and untyped
  client parameters** stop the cross-file chain — all of these degrade to
  the in-file tracker, costing coverage, never correctness.
- The in-file tracker is **single-file by design**; everything cross-module
  lives in the CLI (`src/coverage/collect.ts`), which the plugin must never
  import — the handoff is a JSON file, keeping `dist/plugin.js` lint-only.

## Extending it

- **New provider** → add `src/providers/<name>/anchor.ts` and register it in
  `src/plugin/anchors.ts` (`gateAll` throws at load if a rule key has no
  anchor, so forgetting is loud).
- **New rule** → nothing. The file gate and the `deniedFor` post-filter apply
  to every registered rule automatically. A rule may *additionally* consult
  `context.providerTracker.belongsTo(node, '<provider>')` at match time when
  its shape is generic enough to want early discrimination, but this is an
  optimization, not a requirement.
- **A real finding got suppressed** → widen that provider's anchor (tokens,
  URL substrings, constructor names, identifier patterns). Do not add gate
  opt-outs.
- **Do not wrap `context` in a Proxy** — oxlint's context has a
  non-configurable `report` own property on a `preventExtensions`'d object; a
  `get` trap substituting it violates Proxy invariants and every rule throws.
  The gate uses `Object.create(context)` shadowing instead.

## Regression tests

- `tests/rules/cross-provider.test.ts` — mixed 5-SDK file (each rule flags
  only its own provider's call), wrapper-import attribution, and a
  no-provider file where formerly-generic rules must stay silent.
- `tests/client-tracker.test.ts` — unit tests for the tiers, alias
  resolution, fluent-chain unwinding, and negative anchoring.
- `tests/client-modules-gate.test.ts` — the CLI map's `yes`/`no` contract and
  the `deniedFor` refinements (bare calls never denied, no denial across a
  function boundary).
- `tests/scanner-crossfire.test.ts` — end-to-end through `scan()`: the
  neutral-named `lib/db.ts` wrapper keeps its finding, higher-order wrappers
  and data-flow rules survive the denial channel, the traced look-alike ORM
  stays suppressed, and identifier-position evidence anchors a protocol file.
