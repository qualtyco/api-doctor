/**
 * Hand-verified removals in the `agentmail` SDK, consumed by the
 * agentmail-removed-method compatibility rule.
 *
 * AgentMail's break is a method path, not an exported symbol: the import
 * (`import { AgentMailClient } from 'agentmail'`) is unchanged and still
 * valid, and what disappeared is a method on a resource client. That is why
 * these live in `methodRemovals` rather than `removals` — see
 * `_shared/removed-method.ts` for why the two need different detection.
 *
 * The rule fires only on a mismatch between code and the INSTALLED version —
 * it never suggests upgrading. A project pinned to 0.5.11 calling
 * `metrics.query()` is correct and stays silent forever.
 *
 * Every entry is verified by hand against the published tarballs
 * (implementation, not just the type diff). `wireIdentical` means the old and
 * new call issue the same HTTP method to the same URL path with the same
 * arguments, and must never be inferred from a rename alone.
 *
 * The `MethodRemoval` shape and the rules for writing `verifyHint` live in
 * src/types.ts — this file is the AgentMail data and nothing else.
 */
import type { MethodRemoval, ProviderCompatibility } from '../../types.js';

export const AGENTMAIL_PACKAGE = 'agentmail';

/**
 * `metrics.query` appears at three paths on the client — the account-level
 * `metrics`, and the `metrics` sub-resource of both `inboxes` and `pods` — and
 * all three were regenerated together in 0.5.12. The rule matches on trailing
 * segments, so one `metrics.query` entry covers `client.metrics.query()`,
 * `client.inboxes.metrics.query()` and `client.pods.metrics.query()` alike.
 */
export const agentmailMethodRemovals: MethodRemoval[] = [
  {
    path: 'metrics.query',
    removedIn: '0.5.12',
    replacements: ['metrics.queryEvents', 'metrics.queryUsage'],
    kind: 'split',
    // One endpoint became two DIFFERENT endpoints — the defining case for
    // wireIdentical: false. Neither successor is the old request.
    wireIdentical: false,
    verifiedAt: '2026-08-19',
    evidence:
      'npm pack agentmail 0.5.11 vs 0.5.12. Types: dist/cjs/api/resources/metrics/client/Client.d.ts declares `query` in 0.5.11 and `queryEvents` + `queryUsage` in 0.5.12 (same change under inboxes/resources/metrics and pods/resources/metrics). Implementation compared in the matching Client.js: 0.5.11 `__query` builds `GET /v0/metrics`; 0.5.12 `__queryEvents` builds `GET /v0/metrics/events` and `__queryUsage` builds `GET /v0/metrics/usage`. `metrics.list` had already become `metrics.query` in 0.5.0.',
    verifyHint:
      'Not a rename — the single /v0/metrics endpoint became two, so the response shape differs per successor and neither is a drop-in. `queryEvents` keeps the old `period`/`limit`/`descending` query parameters and returns event rows; `queryUsage` returns usage aggregates and takes a `usageTypes` parameter the old call had no equivalent for. Pick by what the call site reads off the response, then check the field names on it — an event row and a usage row do not share them.',
  },
];

/**
 * Manifest-facing record. Declaring this on `agentmailManifest.compatibility`
 * is the only registration step.
 *
 * `removals` is empty and stays that way until someone hand-verifies an
 * exported-symbol removal: 0.4.20 → 0.5.20 was additive at the package's
 * export surface (dist/cjs/exports.d.ts is byte-identical across the two), and
 * an empty list is the honest record of that.
 */
export const agentmailCompatibility: ProviderCompatibility = {
  package: AGENTMAIL_PACKAGE,
  removals: [],
  methodRemovals: agentmailMethodRemovals,
};
